import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { chooseNewWords, orderReviews, DEFAULT_STUDY_OPTIONS } from '../src/study-options.js'
import { addWord, clearAllData, getPacks, getReviewLog, getStudyState, getWords, rateStudy, setDailyLimit, setStudyOptions, startStudy } from '../src/db.js'
import { dueInDays } from '../src/learning.js'

const fields=(german)=>({german,article:'',plural:'',chinese:german,partOfSpeech:'动词',exampleDe:'',exampleZh:'',unit:''})
async function raw(operation){await getWords();return new Promise((resolve,reject)=>{const request=indexedDB.open('wort-daily',3);request.onsuccess=()=>{const db=request.result,tx=db.transaction(['words','settings','packs'],'readwrite');operation(tx);tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)}};request.onerror=()=>reject(request.error)})}
beforeEach(()=>raw((tx)=>{for(const name of ['words','settings','packs'])tx.objectStore(name).clear();tx.objectStore('settings').put({key:'dailyLimit',value:10});tx.objectStore('settings').put({key:'importOrder',value:0})}))

test('sequential new words follow original book order; random draws only from its unlearned pool',()=>{
  const words=[{id:'a',german:'a',article:'',status:'未学',importOrder:3},{id:'b',german:'b',article:'',status:'未学',importOrder:1},{id:'c',german:'c',article:'',status:'学习中',importOrder:2},{id:'d',german:'d',article:'',status:'未学',importOrder:4}]
  const keys=[JSON.stringify(['a','']),JSON.stringify(['c','']),JSON.stringify(['b',''])]
  assert.deepEqual(chooseNewWords(words,2,keys).map((word)=>word.german),['a','b'])
  assert.deepEqual(chooseNewWords(words,2,null).map((word)=>word.german),['b','a'])
  assert.deepEqual(chooseNewWords(words,2,keys,'random',()=>0).map((word)=>word.german),['b','a'])
})

test('review randomization never moves a later due day before an earlier day',()=>{
  const at=(day)=>new Date(2026,10,day).getTime()
  const queue=[{id:'a',dueAt:at(2)},{id:'b',dueAt:at(2)+1000},{id:'c',dueAt:at(3)},{id:'d',dueAt:at(3)+1000}]
  assert.deepEqual(orderReviews(queue,'random',()=>0).map((word)=>word.id),['b','a','d','c'])
  assert.deepEqual(orderReviews(queue,'due'),queue)
})

test('zero new-word limit skips learning; a limit above the pool takes only remaining words',async()=>{
  await addWord(fields('eins'))
  await addWord(fields('zwei'))
  await setDailyLimit(0)
  assert.equal((await startStudy('learn')).session,null)
  await setDailyLimit(100)
  assert.equal((await getStudyState()).dailyLimit,100)
  assert.equal((await startStudy('learn')).session.wordIds.length,2)
})

test('preferences persist, review ratings write a log, and clear removes all user data',async()=>{
  const saved=await setStudyOptions({newOrder:'random',reviewOrder:'random',autoSpeak:true,speechRate:0.8})
  assert.equal(saved.speechRate,0.8)
  await assert.rejects(setStudyOptions({speechRate:2}),/设置无效/)
  assert.deepEqual((await getStudyState()).studyOptions,saved)
  const word=await addWord(fields('lernen'))
  await raw((tx)=>tx.objectStore('words').put({...word,status:'学习中',dueAt:dueInDays(-1),intervalDays:1}))
  const session=(await startStudy('review')).session
  await rateStudy(session.id,session.version,'remember')
  const log=await getReviewLog()
  assert.equal(log.length,1)
  assert.equal(log[0].german,'lernen')
  assert.equal(log[0].rating,'remember')
  assert.equal(log[0].intervalDaysAfter,1)
  await clearAllData()
  assert.deepEqual(await getWords(),[])
  assert.deepEqual(await getPacks(),[])
  assert.deepEqual(await getReviewLog(),[])
  assert.deepEqual((await getStudyState()).studyOptions,DEFAULT_STUDY_OPTIONS)
})
