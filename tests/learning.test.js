import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { addWord, getWords, getStudyState, startStudy, rateStudy, setDailyLimit } from '../src/db.js'
import { EMPTY_PROGRESS, dayKey, dueInDays, reviewProgress, reviewQueue, todayReviewCount, initialLearnedProgress } from '../src/learning.js'

const now = new Date(2026, 9, 29, 12)
const sample = {german:'Apfel',article:'der',chinese:'苹果',partOfSpeech:'名词'}
async function rawTransaction(callback) {
  await getWords()
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wort-daily', 3)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(['words','settings','packs'], 'readwrite')
      callback(tx)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  })
}
beforeEach(() => rawTransaction((tx) => { for (const name of ['words','settings','packs']) tx.objectStore(name).clear() }))

test('new word defaults, local midnight, month/year rollover and calendar quota keys', async () => {
  const word = await addWord(sample)
  for (const [key,value] of Object.entries(EMPTY_PROGRESS)) assert.equal(word[key],value)
  assert.equal(dueInDays(1,new Date(2026,11,31,23)),new Date(2027,0,1).getTime())
  assert.equal(dayKey(new Date(2026,0,2)), '2026-01-02')
  assert.deepEqual(initialLearnedProgress(now), {status:'学习中',dueAt:new Date(2026,9,30).getTime(),intervalDays:1,reps:0,lapses:0,ease:2.5})
})

test('review selection excludes unlearned/mastered/future/missing due dates; sorts oldest first', () => {
  const words = [
    {id:'late',status:'学习中',dueAt:now.getTime(),importOrder:2},
    {id:'early',status:'学习中',dueAt:dueInDays(-1,now),importOrder:1},
    {id:'later-today',status:'学习中',dueAt:now.getTime()+1000},
    {id:'tomorrow',status:'学习中',dueAt:dueInDays(1,now)},
    {id:'new',status:'未学',dueAt:0}, {id:'mastered',status:'已掌握',dueAt:0}, {id:'missing',status:'学习中',dueAt:null},
  ]
  assert.deepEqual(reviewQueue(words,now).map((word)=>word.id), ['early','late'])
  assert.equal(todayReviewCount(words,now),3)
})

test('forgot resets reps, adds lapse, clamps ease; hard rounds and leaves reps/lapses unchanged', () => {
  const word = {intervalDays:7,reps:4,lapses:2,ease:1.4}
  assert.deepEqual(reviewProgress(word,'forgot',now), {status:'学习中',intervalDays:1,reps:0,lapses:3,ease:1.3,dueAt:dueInDays(1,now)})
  const hard = reviewProgress({...word,intervalDays:3,ease:2.5},'hard',now)
  assert.deepEqual(hard,{status:'学习中',intervalDays:5,reps:4,lapses:2,ease:2.4,dueAt:dueInDays(5,now)})
  assert.equal(reviewProgress({...word,intervalDays:0},'hard',now).intervalDays,1)
  assert.equal(reviewProgress({...word,ease:1.3},'hard',now).ease,1.2)
})

test('remember follows 1/3/7/14/30/60 then ×1.8; mastery needs both conditions', () => {
  let word = initialLearnedProgress(now)
  const intervals = []
  for (let i=0;i<8;i++) { word = reviewProgress(word,'remember',now); intervals.push(word.intervalDays); assert.equal(word.reps,i+1) }
  assert.deepEqual(intervals,[1,3,7,14,30,60,108,194])
  assert.equal(reviewProgress({reps:4,intervalDays:30,ease:2.5,lapses:0},'remember',now).status,'学习中')
  assert.equal(reviewProgress({reps:5,intervalDays:30,ease:2.5,lapses:0},'remember',now).status,'已掌握')
})

test('new round uses remaining quota and import order, persists repeats, commits entire batch only on completion', async () => {
  const first = await addWord(sample)
  const second = await addWord({...sample,german:'Buch',article:'das'})
  await addWord({...sample,german:'Sonne',article:'die'})
  await setDailyLimit(2)
  let state = await startStudy('learn',now)
  assert.deepEqual(state.session.wordIds,[first.id,second.id])
  const original = state.session
  state = await rateStudy(original.id,0,'unknown',now)
  assert.equal(state.session.queue.length,3)
  assert.equal((await getWords()).filter((word)=>word.status==='未学').length,3)
  assert.equal((await getStudyState(now)).learnedToday,0)
  const fresh = await import('../src/db.js?resume-learning')
  assert.deepEqual((await fresh.startStudy('learn',now)).session,state.session)
  await assert.rejects(setDailyLimit(1),/先完成/)
  state = await rateStudy(state.session.id,state.session.version,'known',now)
  assert.equal(state.session.queue[state.session.index].id,first.id)
  assert.equal(state.session.queue[state.session.index].repeat,true)
  state = await rateStudy(state.session.id,state.session.version,'unknown',now)
  assert.equal(state.session,null)
  assert.equal(state.completed,2)
  for (const word of (await getWords()).filter((word)=>[first.id,second.id].includes(word.id))) {
    for (const [key,value] of Object.entries(initialLearnedProgress(now))) assert.equal(word[key],value)
  }
  assert.equal((await getStudyState(now)).learnedToday,2)
  assert.equal((await startStudy('learn',now)).session,null)
  const tomorrow = new Date(2026,9,30,12)
  assert.equal((await getStudyState(tomorrow)).learnedToday,0)
  assert.equal((await startStudy('learn',tomorrow)).session.wordIds.length,1)
})

test('review ratings save immediately, repeat exactly once and survive refresh; stale duplicate answers cannot score twice', async () => {
  const original = await addWord(sample)
  const review = {...original,status:'学习中',dueAt:dueInDays(-1,now),intervalDays:7,reps:3,lapses:2,ease:1.4}
  await rawTransaction((tx)=>tx.objectStore('words').put(review))
  let state = await startStudy('review',now)
  const firstSession = state.session
  state = await rateStudy(firstSession.id,0,'forgot',now)
  assert.deepEqual((await getWords())[0],{...review,...reviewProgress(review,'forgot',now)})
  await assert.rejects(rateStudy(firstSession.id,0,'forgot',now),/进度已变化/)
  assert.equal((await getWords())[0].lapses,3)
  assert.equal(state.session.queue.length,2)
  const resumed = await startStudy('review',now)
  assert.equal(resumed.session.index,1)
  state = await rateStudy(resumed.session.id,resumed.session.version,'forgot',now)
  assert.equal(state.session,null)
  assert.equal((await getWords())[0].lapses,4)
  assert.equal((await startStudy('review',now)).session,null)
})

test('concurrent tabs share one session and prevent mixing learn/review rounds', async () => {
  await addWord(sample)
  const [a,b] = await Promise.all([startStudy('learn',now),startStudy('learn',now)])
  assert.equal(a.session.id,b.session.id)
  await assert.rejects(startStudy('review',now),/先完成/)
  const results = await Promise.allSettled([rateStudy(a.session.id,0,'known',now),rateStudy(b.session.id,0,'known',now)])
  assert.equal(results.filter((result)=>result.status==='fulfilled').length,1)
  assert.equal((await getStudyState(now)).learnedToday,1)
})

test('storage failure rolls back review score and queue together and allows retry', async () => {
  const word = await addWord(sample)
  await rawTransaction((tx)=>tx.objectStore('words').put({...word,...initialLearnedProgress(now),dueAt:dueInDays(-1,now)}))
  const state = await startStudy('review',now)
  const before = await getWords()
  const originalPut = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === 'settings') throw new Error('模拟保存失败')
    return originalPut.apply(this,args)
  }
  try { await assert.rejects(rateStudy(state.session.id,0,'forgot',now),/保存失败/) }
  finally { IDBObjectStore.prototype.put = originalPut }
  assert.deepEqual(await getWords(),before)
  assert.deepEqual((await getStudyState(now)).session,state.session)
  const retry = await rateStudy(state.session.id,0,'forgot',now)
  assert.equal(retry.session.index,1)
})

test('finishing a round after midnight counts on completion day without changing word content', async () => {
  const original = await addWord(sample)
  const state = await startStudy('learn',new Date(2026,9,29,23,59))
  const end = new Date(2026,9,30,0,1)
  await rateStudy(state.session.id,0,'known',end)
  assert.equal((await getStudyState(now)).learnedToday,0)
  assert.equal((await getStudyState(end)).learnedToday,1)
  const learned = (await getWords())[0]
  assert.equal(learned.createdAt,original.createdAt)
  assert.equal(learned.importOrder,original.importOrder)
  assert.equal(learned.german,original.german)
  assert.equal(learned.dueAt,dueInDays(1,end))
})
