import {test,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {grammarUnits,findGrammarUnits,gradeFill,gradeDictation,gradeExercise} from '../src/grammar.js'
import {finalGrammarOrder,grammarComparisons} from '../src/grammar-expansion.js'
import {grammarA1} from '../src/data/grammarA1.js'
import grammarA1More from '../src/data/grammarA1More.json' with {type:'json'}
import grammarA1Cases from '../src/data/grammarA1Cases.json' with {type:'json'}
import grammarA1Finish from '../src/data/grammarA1Finish.json' with {type:'json'}
import {grammarScenarios,completedScenarioWordKeys} from '../src/grammar-scenarios.js'
import {wordKey} from '../src/word-model.js'
import {tableCellAudio,tableCellSpeech,splitSentences,spokenWordCount} from '../src/grammar-audio.js'
import {getGrammarProgress,saveGrammarResult,GRAMMAR_KEY} from '../src/grammar-progress.js'
import {clearAllData,exportBackup,restoreBackup,getWords} from '../src/db.js'
import {parseBackup} from '../src/backup.js'

const values=new Map()
globalThis.localStorage={getItem:(key)=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:(key)=>values.delete(key)}
async function resetDatabase(){await getWords();await new Promise((resolve,reject)=>{const request=indexedDB.open('wort-daily',3);request.onsuccess=()=>{const db=request.result,tx=db.transaction(['words','settings','packs'],'readwrite');for(const name of ['words','settings','packs'])tx.objectStore(name).clear();tx.objectStore('settings').put({key:'dailyLimit',value:10});tx.objectStore('settings').put({key:'importOrder',value:0});tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)}};request.onerror=()=>reject(request.error)})}
beforeEach(async()=>{values.clear();await resetDatabase()})

const old1=grammarUnits.find((unit)=>unit.id==='g-a1-01')
const old2=grammarUnits.find((unit)=>unit.id==='g-a1-02')
const byId=(id)=>grammarUnits.find((unit)=>unit.id===id)
const pronunciationIds=['g-a1-p1','g-a1-p2','g-a1-p3','g-a1-p4','g-a1-p5','g-a1-p6']

test('package 3 follows its final thirty-two-unit table and preserves old question prefixes',()=>{
  const a1Units=grammarUnits.filter((unit)=>unit.level==='A1')
  assert.deepEqual(a1Units.map((unit)=>unit.id),finalGrammarOrder)
  assert.deepEqual(a1Units.map((unit)=>unit.order),Array.from({length:32},(_,i)=>i+1))
  for(const unit of a1Units){assert.equal(unit.reading.questions.length,unit.id==='g-a1-21'?3:2);for(const exercise of unit.exercises){if(exercise.options)assert.ok(exercise.answer<exercise.options.length)}}
  for(const unit of [old1,old2]){assert.deepEqual(new Set(unit.exercises.map((item)=>item.type)),new Set(['choice','fill','classify','order','listen_choice','listen_fill','listen_dictation']));assert.deepEqual(unit.exercises.slice(12,18).map((item)=>item.type),['listen_choice','listen_choice','listen_fill','listen_fill','listen_dictation','listen_dictation'])}
  for(const unit of grammarUnits.filter((item)=>/^g-a1-(0[3-9]|10)$/u.test(item.id)))assert.deepEqual(unit.exercises.slice(12,15).map((item)=>item.type),['listen_choice','listen_fill','listen_dictation'])
  assert.equal(old1.extraTables.length,2)
  assert.equal(old1.audioChips.length,0)
  assert.deepEqual(old2.audioChips.map((group)=>group.group),['a → ä','e → i','e → ie'])
  assert.equal(old2.audioChips[0].items[0].speak,'fahren, du fährst, er fährt')
  assert.deepEqual(old1.exercises.slice(12,18).map((item)=>item.audio),['lernst','ist','Wir spielen Fußball.','Sie ist Lehrerin.','Ich habe Zeit.','Er arbeitet heute.'])
  assert.deepEqual(old2.exercises.slice(12,18).map((item)=>item.audio),['fährt','liest','Er spricht Deutsch.','Du isst Brot.','Sie liest ein Buch.','Der Bus fährt um acht Uhr.'])
  assert.deepEqual(findGrammarUnits('sein').filter((unit)=>unit.level==='A1').map((unit)=>unit.id),['g-a1-01','g-a1-06','g-a1-11','g-a1-10'])
  assert.deepEqual(findGrammarUnits('fahren').map((unit)=>unit.id),['g-a1-02','g-a1-06'])
  assert.deepEqual(findGrammarUnits('冠词').filter((unit)=>unit.level==='A1').map((unit)=>unit.id),['g-a1-07'])
  assert.deepEqual(findGrammarUnits('Tom'),[])
})

test('table cells speak the right German phrase and sentences split without changing content',()=>{
  assert.equal(tableCellSpeech(old1.table,1,2),'du lernst')
  assert.equal(tableCellSpeech(old1.table,1,1),null)
  assert.equal(tableCellSpeech(old1.extraTables[0],0,2),'er sie es ist')
  assert.equal(tableCellSpeech(old2.table,0,3),'er fährt')
  assert.equal(tableCellSpeech(old2.table,0,1),'fahren')
  assert.equal(tableCellSpeech(old2.table,0,0),null)
  assert.equal(tableCellSpeech(grammarUnits[0].table,0,0),'A')
  assert.equal(tableCellSpeech(grammarUnits[0].table,0,1),null)
  assert.equal(tableCellSpeech(grammarUnits[0].table,0,2),'J')
  assert.equal(tableCellSpeech(grammarUnits[0].table,0,4),'S')
  assert.equal(tableCellSpeech(byId('g-a1-03').table,0,1),'ich kann')
  assert.equal(tableCellSpeech(byId('g-a1-04').table,0,2),'du stehst auf')
  assert.equal(tableCellSpeech(byId('g-a1-05').table,0,2),'du Komm!')
  assert.equal(tableCellSpeech(byId('g-a1-06').extraTables[0],5,5),'sein')
  assert.deepEqual(byId('g-a1-06').extraTables[0].hl,[[5,5],[6,5],[7,5],[8,5]])
  assert.equal(tableCellSpeech(byId('g-a1-07').table,0,0),null)
  assert.equal(tableCellSpeech(byId('g-a1-07').table,0,1),'der')
  assert.equal(tableCellSpeech(byId('g-a1-07').table,1,4),null)
  assert.equal(tableCellSpeech(byId('g-a1-07').extraTables[0],0,1),'der Tag die Tage')
  assert.equal(tableCellSpeech(byId('g-a1-08').table,1,1),'den')
  assert.deepEqual(byId('g-a1-08').table.hl,[[1,1],[3,1]])
  assert.deepEqual(byId('g-a1-09').extraTables[0].hl,[[1,1]])
  assert.deepEqual(byId('g-a1-10').extraTables[0].hl,[[1,1]])
  assert.equal(splitSentences(old1.reading.text).join(' '),old1.reading.text)
  assert.ok(splitSentences(grammarUnits[0].reading.text).length>=4)
  assert.equal(spokenWordCount('Der Bus fährt um acht Uhr.'),6)
})

test('listening grading keeps original fill rules and normalizes dictation punctuation and spaces',()=>{
  assert.deepEqual(gradeDictation('ich habe zeit','Ich habe Zeit.'),{correct:true,minor:['大小写']})
  assert.deepEqual(gradeDictation('Ich habe Zeit','Ich habe Zeit.'),{correct:true,minor:[]})
  assert.deepEqual(gradeDictation('Ich  habe   Zeit.','Ich habe Zeit.'),{correct:true,minor:[]})
  assert.deepEqual(gradeDictation('Ich habe Buch','Ich habe Zeit.'),{correct:false,minor:[]})
  assert.deepEqual(gradeDictation('Der Bus faehrt um acht Uhr','Der Bus fährt um acht Uhr.'),{correct:true,minor:['变音字母写法']})
  assert.equal(gradeExercise(old2.exercises[14],'Spricht').correct,true)
  assert.equal(gradeExercise(old1.exercises[12],1).correct,true)
})

test('fill allows only specified minor slips; duplicate classify texts stay distinct',()=>{
  assert.deepEqual(gradeFill('Lerne','lerne'),{correct:true,minor:['首字母大小写']})
  assert.deepEqual(gradeFill('schlaeft','schläft'),{correct:true,minor:['变音字母写法']})
  assert.equal(gradeFill('lerne ','lerne').correct,true)
  assert.equal(gradeFill('lernen','lerne').correct,false)
  assert.equal(gradeFill('lERne','lerne').correct,false)
  const classify=old1.exercises[8]
  assert.equal(classify.items[2].text,classify.items[3].text)
  assert.equal(gradeExercise(classify,[0,1,2,3,4,5]).correct,true)
  assert.equal(gradeExercise(classify,[0,1,3,2,4,5]).correct,false)
  assert.equal(gradeExercise(old1.exercises[9],[2,1,0]).correct,true)
})

test('noun and case exercises reuse classification, order, fill, and dictation grading',()=>{
  const noun=byId('g-a1-07').exercises[0]
  assert.deepEqual(noun.groups,['der','die','das'])
  assert.equal(noun.items.length,6)
  assert.equal(gradeExercise(noun,[0,1,2,0,1,2]).correct,true)
  assert.equal(gradeExercise(noun,[0,1,2,0,2,1]).correct,false)
  const negation=byId('g-a1-09')
  assert.equal(gradeExercise(negation.exercises[7],[1,2,4,0,3]).correct,true)
  assert.deepEqual(gradeExercise(negation.exercises[14],'Er kommt heute nicht'),{correct:true,minor:[]})
  assert.deepEqual(gradeExercise(negation.exercises[14],'er kommt heute nicht'),{correct:true,minor:['大小写']})
  const possessive=byId('g-a1-10')
  assert.equal(gradeExercise(possessive.exercises[3],'ihren').correct,true)
  assert.equal(gradeExercise(possessive.exercises[3],'seinen').correct,false)
  assert.match(possessive.exercises[3].explain,/Anna.*ihr/u)
})

test('best score persists, backup restores grammar, and old backup clears grammar progress',async()=>{
  saveGrammarResult('g-a1-01',7)
  saveGrammarResult('g-a1-01',5)
  assert.deepEqual(getGrammarProgress()['g-a1-01'],{done:true,bestScore:7,attempts:2})
  const backup=await exportBackup(new Date(2026,10,3))
  assert.deepEqual(backup.grammar,getGrammarProgress())
  saveGrammarResult('g-a1-02',9)
  await restoreBackup(backup)
  assert.deepEqual(getGrammarProgress(),backup.grammar)
  const old=structuredClone(backup);delete old.grammar
  assert.deepEqual(parseBackup(JSON.stringify(old)).grammar,{})
  await restoreBackup(old)
  assert.deepEqual(getGrammarProgress(),{})
  assert.equal(values.get(GRAMMAR_KEY),'{}')
})

test('backup restores progress for all thirty-two units and six comparisons',async()=>{
  for(const [index,unit] of [...grammarUnits,...grammarComparisons].entries())saveGrammarResult(unit.id,index+1)
  const backup=await exportBackup(new Date(2026,10,3))
  await clearAllData()
  await restoreBackup(backup)
  assert.deepEqual(Object.keys(getGrammarProgress()).sort(),[...grammarUnits,...grammarComparisons].map((unit)=>unit.id).sort())
  assert.equal(getGrammarProgress()['g-a1-01'].bestScore,10)
  assert.equal(getGrammarProgress()['g-a1-02'].bestScore,11)
})

test('completed legacy pronunciation migrates to P1 once and survives backup',async()=>{
  values.set(GRAMMAR_KEY,JSON.stringify({'g-a1-00':{done:true,bestScore:11,attempts:2},'g-a1-12':{done:true,bestScore:9,attempts:1}}))
  const progress=getGrammarProgress()
  assert.deepEqual(progress['g-a1-p1'],{done:true,bestScore:11,attempts:2})
  assert.deepEqual(progress['g-a1-00'],{done:true,bestScore:11,attempts:2})
  assert.deepEqual(progress['g-a1-12'],{done:true,bestScore:9,attempts:1})
  const backup=await exportBackup()
  await clearAllData()
  await restoreBackup(backup)
  assert.deepEqual(getGrammarProgress(),progress)
  values.set(GRAMMAR_KEY,JSON.stringify({'g-a1-00':{done:false,bestScore:3,attempts:1}}))
  assert.equal(getGrammarProgress()['g-a1-p1'],undefined)
})

test('package 1 follows the supplied exercise counts and alphabet chips',()=>{
  const expectedCounts=[16,18,16,20,16,14]
  pronunciationIds.forEach((id,index)=>{
    const unit=byId(id)
    assert.equal(unit.exercises.length,expectedCounts[index])
    assert.equal(unit.reading.questions.length,2)
  })
  assert.equal(byId('g-a1-p1').audioChips[0].items.length,30)
  assert.equal(byId('g-a1-p2').exercises[0].items.length,6)
  assert.equal(byId('g-a1-p2').exercises[1].items.length,6)
  assert.equal(byId('g-a1-p4').exercises[0].items.length,8)
  assert.equal(byId('g-a1-p6').exercises[9].answer,'Hast du Zeit?')
  assert.equal(byId('g-a1-p6').exercises[10].answer,'Er hat Zeit.')
})

test('package 2 key listening answers and form reading match the manuscript',()=>{
  const numbers=byId('g-a1-19'),time=byId('g-a1-20'),intro=byId('g-a1-21')
  assert.deepEqual(numbers.exercises.slice(0,4).map((e)=>e.audio),['dreizehn','dreißig','einundzwanzig','achtundvierzig'])
  assert.equal(numbers.exercises[8].audio,'zwei Euro fünfzig')
  assert.equal(numbers.exercises[9].answer,'zwölf')
  assert.equal(time.exercises[0].options[time.exercises[0].answer],'1:30')
  assert.match(intro.reading.text,/Name: Chen \/ Vorname: Wei/u)
  assert.equal(intro.reading.questions.length,3)
  assert.match(intro.writing.sample,/Ich heiße Chen Wei/u)
})

test('package 3 replaces Dativ, adds sixty participles and preserves comparison answers',()=>{
  const dative=byId('g-a1-13')
  assert.equal(dative.title,'Der Dativ（与格）')
  assert.equal(dative.extraTables.length,2)
  assert.equal(dative.exercises.length,18)
  assert.equal(dative.exercises[2].options[dative.exercises[2].answer],'Ich danke dir.')
  assert.equal(dative.exercises[8].answer,'ihr')
  const perfect=byId('g-a1-06')
  assert.equal(perfect.exercises.length,27)
  assert.equal(perfect.audioChips.at(-1).group,'分词对')
  assert.equal(perfect.audioChips.at(-1).items.length,8)
  assert.equal(perfect.extraTables.at(-1).rows.reduce((sum,row)=>sum+row[2].split(', ').length,0)+8,60)
  for(const id of ['g-a1-26','g-a1-24','g-a1-23','g-a1-25'])assert.equal(byId(id).exercises.length,15)
  assert.deepEqual(grammarComparisons.slice(0,6).map((entry)=>entry.id),['c1','c2','c3','c4','c5','c6'])
  assert.equal(grammarComparisons[2].exercises[4].answer.join(' '),'Das ist kein Problem')
  assert.equal(grammarComparisons[1].exercises[5].explain,'ins 是 in das 的口语缩合形，已在 P6 与 g-a1-17 教过。')
  assert.equal(byId('g-a1-10').extraTables[0].rows.at(-1)[1],'meinem')
  assert.equal(byId('g-a1-12').table.rows.at(-1)[1],'mir')
  assert.equal(byId('g-a1-17').extraTables.at(-1).rows.length,9)
  for(const original of [...grammarA1,...grammarA1More,...grammarA1Cases,...grammarA1Finish].filter((unit)=>unit.id!=='g-a1-00'&&unit.id!=='g-a1-13')){
    assert.deepEqual(byId(original.id).exercises.slice(0,original.exercises.length),original.exercises)
  }
})

test('package 4 has ten scenario lessons, S2 dialogue and non-SRS scene markers',async()=>{
  assert.deepEqual(grammarScenarios.slice(0,10).map((entry)=>entry.id),Array.from({length:10},(_,i)=>`s-a1-${String(i+1).padStart(2,'0')}`))
  assert.deepEqual(grammarScenarios.slice(0,10).map((entry)=>entry.order),Array.from({length:10},(_,i)=>i+1))
  for(const unit of grammarScenarios.slice(0,10)){assert.equal(unit.exercises.length,8);assert.equal(unit.reading.questions.length,2);assert.ok(unit.speaking);assert.ok(unit.writing.sample)}
  const eating=grammarScenarios[1]
  assert.equal(eating.examples.length,7)
  assert.equal(eating.reading.questions[0].answer,1)
  assert.equal(eating.reading.questions[1].answer,1)
  const key=wordKey({german:'Familie',article:'die'})
  assert.equal(completedScenarioWordKeys({}).has(key),false)
  const before=await exportBackup()
  saveGrammarResult('s-a1-01',8)
  assert.equal(completedScenarioWordKeys(getGrammarProgress()).has(key),true)
  const after=await exportBackup()
  assert.deepEqual(after.words,before.words)
  await clearAllData();await restoreBackup(after)
  assert.equal(getGrammarProgress()['s-a1-01'].done,true)
  assert.equal(completedScenarioWordKeys(getGrammarProgress()).has(key),true)
})

test('invalid grammar backup is rejected before restoring words; clearing data removes grammar progress',async()=>{
  saveGrammarResult('g-a1-01',8)
  const backup=await exportBackup()
  const broken=structuredClone(backup);broken.grammar['g-a1-01'].bestScore=-1
  await assert.rejects(restoreBackup(broken),/语法进度格式无效/)
  assert.deepEqual(getGrammarProgress(),backup.grammar)
  await clearAllData()
  assert.deepEqual(getGrammarProgress(),{})
  assert.equal(values.has(GRAMMAR_KEY),false)
})

test('an aborted database restore also leaves the prior grammar progress intact',async()=>{
  saveGrammarResult('g-a1-01',4)
  const prior=getGrammarProgress()
  const backup=await exportBackup()
  backup.grammar={'g-a1-02':{done:true,bestScore:9,attempts:1}}
  const originalAdd=IDBObjectStore.prototype.add
  IDBObjectStore.prototype.add=function(...args){const request=originalAdd.apply(this,args);if(this.name==='settings')this.transaction.abort();return request}
  try {await assert.rejects(restoreBackup(backup),/恢复失败/)}
  finally {IDBObjectStore.prototype.add=originalAdd}
  assert.deepEqual(getGrammarProgress(),prior)
})
