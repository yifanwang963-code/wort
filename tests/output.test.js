import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { addWord, getWords, startOutputTraining, answerOutputTraining, exportBackup, getStudyState, startStudy, rateStudy, setNewWordPaused } from '../src/db.js'
import { outputCandidates, wrongBook, answerMatches, cardMode, clozePrompt } from '../src/output.js'
import { reviewProgress } from '../src/learning.js'
import { reviewForecast, currentStreak, levelOverview } from '../src/overview.js'

const now = new Date(2026,10,2,12)
const noun = {german:'Apfel',article:'der',chinese:'苹果',partOfSpeech:'名词'}
async function raw(operation) {
  await getWords()
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('wort-daily',3)
    request.onsuccess=()=>{
      const db=request.result, tx=db.transaction(['words','settings','packs'],'readwrite')
      operation(tx)
      tx.oncomplete=()=>{db.close();resolve()}
      tx.onabort=()=>{db.close();reject(tx.error)}
    }
    request.onerror=()=>reject(request.error)
  })
}
beforeEach(()=>raw((tx)=>{
  for(const name of ['words','settings','packs'])tx.objectStore(name).clear()
  tx.objectStore('settings').put({key:'dailyLimit',value:10})
  tx.objectStore('settings').put({key:'importOrder',value:0})
}))
async function learningWord(fields, progress={}) {
  const word=await addWord(fields)
  await raw((tx)=>tx.objectStore('words').put({...word,status:'学习中',dueAt:now.getTime()+86400000,intervalDays:3,ease:2.5,reps:2,lapses:0,...progress}))
  return word.id
}

test('queue uses only learning words, prioritizes lapses, caps at ten and filters article mode',async()=>{
  const items=Array.from({length:12},(_,i)=>({id:`${i}`,german:`W${i}`,article:i%2?'':'der',partOfSpeech:i%2?'动词':'名词',status:'学习中',lapses:i,importOrder:i}))
  items.push({id:'new',status:'未学',lapses:99},{id:'mastered',status:'已掌握',lapses:99})
  assert.deepEqual(outputCandidates(items).map((word)=>word.id),['11','10','9','8','7','6','5','4','3','2'])
  assert.equal(outputCandidates(items,true).length,10)
  assert.deepEqual(outputCandidates(items,false,'article').map((word)=>word.id),['10','8','6','4','2','0'])
  assert.deepEqual(wrongBook(items).slice(0,2).map((word)=>word.id),['mastered','new'])
  assert.equal(cardMode(items[1],2,'mixed'),'translation')
})

test('answers require exact capitalization, umlauts and noun article',()=>{
  assert.equal(answerMatches(noun,'translation',' der  Apfel '),true)
  assert.equal(answerMatches(noun,'dictation','Der Apfel'),false)
  assert.equal(answerMatches(noun,'translation','der apfel'),false)
  assert.equal(answerMatches(noun,'dictation','Apfel'),false)
  assert.equal(answerMatches({...noun,german:'Mädchen',article:'das'},'translation','das Madchen'),false)
  assert.equal(answerMatches(noun,'article','der'),true)
  assert.equal(answerMatches(noun,'article','die'),false)
})

test('correct answer preserves SRS; wrong answer uses forgot atomically and round resumes',async()=>{
  const first=await learningWord(noun,{lapses:3,ease:1.4})
  await learningWord({...noun,german:'Buch',article:'das'},{lapses:2})
  await learningWord({...noun,german:'neu'},{lapses:0})
  const initial=(await getWords()).find((word)=>word.id===first)
  const started=await startOutputTraining('mixed')
  assert.equal(started.session.queue[0].id,first)
  assert.equal(started.session.queue.length,3)
  const right=await answerOutputTraining(started.session.id,0,'der Apfel',now)
  assert.equal(right.feedback.correct,true)
  assert.deepEqual((await getWords()).find((word)=>word.id===first),initial)
  const resumed=await startOutputTraining()
  assert.equal(resumed.session.index,1)
  const target=resumed.words.find((word)=>word.id===resumed.session.queue[1].id)
  const beforeStudy=await getStudyState(now)
  const wrong=await answerOutputTraining(resumed.session.id,1,'wrong',now)
  assert.equal(wrong.feedback.correct,false)
  const updated=(await getWords()).find((word)=>word.id===target.id)
  assert.deepEqual(updated,{...target,...reviewProgress(target,'forgot',now)})
  assert.deepEqual((await getStudyState(now)).session,beforeStudy.session)
  await assert.rejects(answerOutputTraining(resumed.session.id,1,'wrong',now),/进度已变化/)
  const backup=await exportBackup(now)
  assert.equal(backup.settings.find((record)=>record.key==='outputSession').value.index,2)
})

test('wrong-book round excludes mastered words and completed answers leave no session',async()=>{
  await learningWord(noun,{lapses:2})
  await learningWord({...noun,german:'Buch',article:'das'},{lapses:0})
  const session=(await startOutputTraining('article',true,true)).session
  assert.equal(session.queue.length,1)
  const finished=await answerOutputTraining(session.id,session.version,'der',now)
  assert.equal(finished.completed,true)
  assert.equal(finished.session,null)
  assert.equal((await exportBackup(now)).settings.find((record)=>record.key==='outputSession'),undefined)
})

test('cloze prefers exact word form, then four-letter stem; requires position-specific capitalization',()=>{
  const exact={german:'lernen',exampleDe:'Ich lerne. Wir lernen heute.',status:'学习中'}
  assert.deepEqual(clozePrompt(exact),{sentence:'Ich lerne. Wir ____ heute.',answer:'lernen'})
  const stem={german:'gehen',exampleDe:'Gehe bitte nach Hause.',status:'学习中'}
  assert.deepEqual(clozePrompt(stem),{sentence:'____ bitte nach Hause.',answer:'Gehe'})
  assert.equal(answerMatches(stem,'cloze',' Gehe '),true)
  assert.equal(answerMatches(stem,'cloze','gehe'),false)
  assert.equal(clozePrompt({german:'laufen',exampleDe:'Er rennt schnell.'}),null)
  assert.equal(clozePrompt({german:'laufen',exampleDe:''}),null)
  const pool=[{...stem,id:'stem',importOrder:1},{id:'none',importOrder:2,german:'laufen',exampleDe:'Er rennt schnell.',status:'学习中'},{...exact,id:'exact',importOrder:3}]
  assert.equal(outputCandidates(pool,false,'cloze').length,2)
  assert.equal(cardMode({german:'laufen',exampleDe:''},3,'mixed'),'translation')
})

test('cloze wrong scores as forgot, correct preserves SRS and overview counters advance',async()=>{
  const id=await learningWord({...noun,german:'gehen',article:'',partOfSpeech:'动词',exampleDe:'Gehe nach Hause.',exampleZh:'回家去。'},{lapses:1})
  const first=await startOutputTraining('cloze',false,true)
  const original=(await getWords()).find((word)=>word.id===id)
  const wrong=await answerOutputTraining(first.session.id,0,'gehe',now)
  assert.equal(wrong.feedback.expected,'Gehe')
  assert.deepEqual((await getWords()).find((word)=>word.id===id),{...original,...reviewProgress(original,'forgot',now)})
  let state=await getStudyState(now)
  assert.equal(state.metrics.outputTotal,1)
  assert.equal(state.metrics.outputCorrect,0)
  assert.equal(currentStreak(state.metrics.activityDays,now),1)
  const second=await startOutputTraining('cloze',false,true)
  const before=(await getWords()).find((word)=>word.id===id)
  await answerOutputTraining(second.session.id,0,' Gehe ',now)
  assert.deepEqual((await getWords()).find((word)=>word.id===id),before)
  state=await getStudyState(now)
  assert.equal(state.metrics.outputTotal,2)
  assert.equal(state.metrics.outputCorrect,1)
})

test('pause affects only that local day and blocks new rounds; review count and activity remain separate',async()=>{
  await addWord(noun)
  assert.equal(await setNewWordPaused(true,now),true)
  assert.equal((await getStudyState(now)).pausedToday,true)
  assert.equal((await startStudy('learn',now)).session,null)
  assert.equal((await getStudyState(new Date(2026,10,3,12))).pausedToday,false)
  const learning=await startStudy('learn',new Date(2026,10,3,12))
  assert.equal(learning.session.wordIds.length,1)
  await assert.rejects(setNewWordPaused(true,new Date(2026,10,3,12)),/先完成/)
  await rateStudy(learning.session.id,0,'known',new Date(2026,10,3,12))
  assert.equal((await getStudyState(new Date(2026,10,3,12))).metrics.reviewCount,0)
  assert.equal(currentStreak((await getStudyState(new Date(2026,10,3,12))).metrics.activityDays,new Date(2026,10,3,12)),1)
  await setNewWordPaused(false,now)
  assert.equal((await getStudyState(now)).pausedToday,false)
})

test('forecast uses future calendar buckets and thresholds; overview percentages and streak are deterministic',()=>{
  const due=(day)=>new Date(2026,10,2+day).getTime()
  const words=[...Array.from({length:51},(_,i)=>({id:`a${i}`,status:'学习中',dueAt:due(1),level:'A1'})),
    ...Array.from({length:81},(_,i)=>({id:`b${i}`,status:'学习中',dueAt:due(2),level:'A1'})),
    {id:'c',status:'已掌握',dueAt:due(1),level:'A1'}, {id:'d',status:'未学',dueAt:due(3),level:'B1'}]
  const forecast=reviewForecast(words,now)
  assert.equal(forecast.length,7)
  assert.deepEqual(forecast.slice(0,3).map((day)=>[day.count,day.level]),[[51,'yellow'],[81,'red'],[0,'normal']])
  assert.deepEqual(levelOverview(words,'B1').map((item)=>[item.count,item.percent]),[[1,100],[0,0],[0,0]])
  assert.equal(currentStreak(['2026-10-31','2026-11-01'],now),2)
  assert.equal(currentStreak(['2026-10-31'],now),0)
})
