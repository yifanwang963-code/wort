import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { addWord, getWords, getStudyState, setVacation, endVacation, startStudy, recordBackupExport, dismissBackupReminder, exportBackup } from '../src/db.js'
import { redistributeVacation, levelPrompt, backupReminderDue, parseLocalDate } from '../src/continuity.js'
import { currentStreak, reviewForecast } from '../src/overview.js'
import { dayKey } from '../src/learning.js'

const at=(day)=>new Date(2026,10,day,12)
const due=(day)=>new Date(2026,10,day).getTime()
const sample={german:'Haus',article:'das',chinese:'房子',partOfSpeech:'名词'}
async function raw(operation) {
  await getWords()
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('wort-daily',3)
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction(['words','settings','packs'],'readwrite')
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
async function learningWord(name,date){const word=await addWord({...sample,german:name});await raw((tx)=>tx.objectStore('words').put({...word,status:'学习中',dueAt:due(date),intervalDays:3}));return word.id}

test('vacation suppresses new learning and holiday dues, then redistributes once in due order',async()=>{
  for(let i=0;i<5;i++)await learningWord(`Wort${i}`,i<2?3:i<4?4:5)
  await setVacation('2026-11-03','2026-11-05',at(2))
  assert.equal((await getStudyState(at(4))).vacation.end,'2026-11-05')
  assert.equal((await startStudy('review',at(4))).session,null)
  await addWord({...sample,german:'Neu'})
  assert.equal((await startStudy('learn',at(4))).session,null)
  const finished=await getStudyState(at(6))
  assert.equal(finished.vacation,null)
  assert.deepEqual(finished.vacationHistory,[{start:'2026-11-03',end:'2026-11-05'}])
  const sorted=finished.words.filter((word)=>word.status==='学习中').sort((a,b)=>a.importOrder-b.importOrder)
  assert.deepEqual(sorted.map((word)=>dayKey(new Date(word.dueAt))),['2026-11-06','2026-11-06','2026-11-07','2026-11-07','2026-11-08'])
  assert.deepEqual((await getStudyState(at(7))).words,finished.words)
  const backup=await exportBackup(at(7))
  assert.equal(backup.settings.filter((setting)=>setting.key==='vacationHistory').length,1)
})

test('early end uses actual days; unexpired original due dates stay in place',async()=>{
  await learningWord('Alt',3)
  await learningWord('Heute',4)
  await learningWord('Spaeter',6)
  await setVacation('2026-11-03','2026-11-08',at(2))
  assert.equal(await endVacation(at(4)),1)
  const state=await getStudyState(at(4))
  const byName=Object.fromEntries(state.words.map((word)=>[word.german,dayKey(new Date(word.dueAt))]))
  assert.deepEqual(byName,{Alt:'2026-11-04',Heute:'2026-11-04',Spaeter:'2026-11-06'})
  assert.deepEqual(state.vacationHistory,[{start:'2026-11-03',end:'2026-11-03'}])
  assert.equal((await startStudy('review',at(4))).session.wordIds.length,2)
})

test('frozen streak skips vacation dates and invalid dates are rejected',async()=>{
  assert.equal(parseLocalDate('2026-02-30'),null)
  await assert.rejects(setVacation('2026-11-08','2026-11-03',at(2)),/日期/)
  const history=[{start:'2026-11-03',end:'2026-11-05'}]
  assert.equal(currentStreak(['2026-11-02'],at(4),[],history[0]),1)
  assert.equal(currentStreak(['2026-11-02','2026-11-06'],at(6),history),2)
  assert.equal(currentStreak(['2026-11-01'],at(6),history),0)
})

test('forecast shows holiday dues after return, spread across three days',()=>{
  const words=Array.from({length:5},(_,index)=>({id:String(index),status:'学习中',dueAt:due(index<2?3:index<4?4:5),importOrder:index+1}))
  const forecast=reviewForecast(words,at(2),{start:'2026-11-03',end:'2026-11-05'})
  assert.deepEqual(forecast.map((day)=>day.count),[0,0,0,2,2,1,0])
})

test('level warning uses current level and next level at 49, not 50',()=>{
  const words=[...Array.from({length:50},()=>({level:'A1',status:'未学'})),{level:'A2',status:'未学'}]
  assert.equal(levelPrompt(words),null)
  words[0].status='学习中'
  assert.deepEqual(levelPrompt(words),{current:'A1',next:'A2',remaining:49})
  for(const word of words.filter((word)=>word.level==='A1'))word.status='已掌握'
  assert.deepEqual(levelPrompt(words),{current:'A2',next:'B1',remaining:1})
})

test('backup reminder starts after seven days, dismisses for seven and export resets',async()=>{
  const first=await getStudyState(at(2))
  assert.equal(first.backupReminder,false)
  assert.equal((await getStudyState(at(10))).backupReminder,true)
  await dismissBackupReminder(at(10))
  assert.equal((await getStudyState(at(16))).backupReminder,false)
  assert.equal((await getStudyState(at(18))).backupReminder,true)
  await recordBackupExport(at(18))
  assert.equal((await getStudyState(at(18))).backupReminder,false)
  assert.equal((await getStudyState(at(26))).backupReminder,true)
  assert.equal(backupReminderDue(at(18).getTime(),at(2).getTime(),null,at(26)),true)
})
