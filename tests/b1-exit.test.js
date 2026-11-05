import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {gradeExercise} from '../src/grammar.js'
import {b1ExitData,b1ListeningSegments,B1_EXIT_GATES,B1_GRAMMAR_GROUPS,createB1GrammarTest,gradeB1Grammar,gradeB1Choices,gradeB1Writing,gradeB1Speaking,createB1VocabularyTest,gradeB1Vocabulary} from '../src/b1-exit.js'
import {B1_EXIT_KEY,b1ExitComplete,getB1ExitProgress,saveB1ExitResult} from '../src/b1-exit-progress.js'
import {getA1ExitProgress,saveA1ExitResult} from '../src/a1-exit-progress.js'
import {getA2ExitProgress,saveA2ExitResult} from '../src/a2-exit-progress.js'
import {clearAllData,exportBackup,restoreBackup} from '../src/db.js'

const memory=new Map()
globalThis.localStorage={getItem:(key)=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:(key)=>memory.delete(key)}

function correctAnswer(question){
  if(question.type==='choice')return question.answer
  if(question.type==='fill')return question.answer
  if(question.type==='order')return question.answer.map((token)=>question.tokens.indexOf(token))
  if(question.type==='classify')return question.items.map((item)=>item.group)
  throw new Error(`Unexpected question type ${question.type}`)
}
function wrongAnswer(question){
  if(question.type==='choice')return (question.answer+1)%question.options.length
  if(question.type==='fill')return 'xyz'
  if(question.type==='order')return [...correctAnswer(question)].reverse()
  if(question.type==='classify')return question.items.map((item)=>(item.group+1)%question.groups.length)
}

test('B1-5 transcribes the six assessment sections and forty sampled grammar questions per run',()=>{
  assert.equal(b1ExitData.grammar.length,60)
  assert.deepEqual(b1ExitData.listening.map((part)=>part.questions.length),[3,2,3,2,2,2])
  assert.deepEqual(b1ExitData.reading.map((part)=>part.questions.length),[2,3,2,2,3])
  assert.deepEqual(b1ExitData.writing.map((part)=>part.checks.length),[4,4])
  assert.equal(b1ExitData.speaking.length,3)
  for(const random of [()=>0.17,()=>0.83]){
    const sample=createB1GrammarTest(random)
    assert.equal(sample.length,40)
    assert.equal(new Set(sample).size,40)
    assert.deepEqual(B1_GRAMMAR_GROUPS.map((group)=>sample.filter((question)=>question.group===group).length),[10,10,10,10])
  }
  for(const question of b1ExitData.grammar)assert.equal(gradeExercise(question,correctAnswer(question)).correct,true,`${question.group} ${question.number}`)
  assert.match(b1ExitData.reading[4].text,/Mit freundlichen Grüßen\nPersonalabteilung/u)
  assert.match(b1ExitData.writing[1].sample,/Mit freundlichen Grüßen\nLan Wang/u)
})

test('B1 grammar requires both 32/40 total and 7/10 in all four groups',()=>{
  const sample=createB1GrammarTest(()=>0.34)
  const correct=sample.map(correctAnswer)
  const withWrong=(positions)=>sample.map((question,index)=>positions.includes(index)?wrongAnswer(question):correct[index])
  const pass=withWrong([0,1,2,10,11,12,20,21])
  assert.equal(gradeB1Grammar(sample,pass).score,32)
  assert.equal(gradeB1Grammar(sample,pass).passed,true)
  const groupFail=withWrong([0,1,2,3,10,20,30])
  assert.equal(gradeB1Grammar(sample,groupFail).score,33)
  assert.equal(gradeB1Grammar(sample,groupFail).groupScores[B1_GRAMMAR_GROUPS[0]],6)
  assert.equal(gradeB1Grammar(sample,groupFail).passed,false)
  assert.equal(gradeB1Grammar(sample,withWrong([0,1,2,10,11,12,20,21,22])).passed,false)
})

test('B1 listening, reading, writing and speaking follow their own pass lines',()=>{
  const listening=b1ExitData.listening.flatMap((part)=>part.questions)
  const reading=b1ExitData.reading.flatMap((part)=>part.questions)
  const scored=(items,count)=>items.map((item,index)=>index<count?item.answer:(item.answer+1)%item.options.length)
  assert.equal(gradeB1Choices('listening',scored(listening,9)).passed,true)
  assert.equal(gradeB1Choices('listening',scored(listening,8)).passed,false)
  assert.equal(gradeB1Choices('reading',scored(reading,8)).passed,true)
  assert.equal(gradeB1Choices('reading',scored(reading,7)).passed,false)
  assert.match(b1ExitData.listening[2].text,/Ich hätte es bereut, wenn ich in der Schule geblieben wäre\./u)
  for(const part of b1ExitData.listening){
    const segments=b1ListeningSegments(part.text)
    assert.ok(segments.length>=1)
    assert.equal(segments.join(' ').replace(/\s+/gu,' '),part.text.replace(/\s+/gu,' ').trim())
  }
  assert.equal(gradeB1Writing(['论坛帖','正式信'],b1ExitData.writing.map((part)=>part.checks.map(()=>true))).passed,true)
  assert.equal(gradeB1Writing(['论坛帖','正式信'],[[true,true,true,true],[true,true,true,false]]).passed,false)
  assert.equal(gradeB1Speaking(['达成','出色','达成']).passed,true)
  assert.equal(gradeB1Speaking(['达成','未达成','出色']).passed,false)
})

test('B1 vocabulary samples 120 unique words from each specified layer pool and applies 102/108',()=>{
  const words=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-b1.json',import.meta.url),'utf8')).words
  const sample=createB1VocabularyTest(words,()=>0.43)
  assert.equal(sample.core.length,120)
  assert.equal(sample.recognition.length,120)
  assert.equal(new Set(sample.core.map((word)=>`${word.german}:${word.article}`)).size,120)
  assert.equal(new Set(sample.recognition.map((item)=>`${item.word.german}:${item.word.article}`)).size,120)
  assert.ok(sample.core.every((word)=>word.layer==='核心主动'))
  assert.ok(sample.recognition.every((item)=>['被动认读','扩展认读'].includes(item.word.layer)))
  const core=sample.core.map((word)=>[word.article,word.german].filter(Boolean).join(' '))
  const recognition=sample.recognition.map((item)=>item.answer)
  assert.equal(gradeB1Vocabulary(sample,core,recognition).passed,true)
  const limitCore=core.map((answer,index)=>index<102?answer:'wrong')
  const limitRecognition=recognition.map((answer,index)=>index<108?answer:(answer+1)%4)
  assert.equal(gradeB1Vocabulary(sample,limitCore,limitRecognition).passed,true)
  limitCore[101]='wrong'
  assert.equal(gradeB1Vocabulary(sample,limitCore,limitRecognition).passed,false)
})

test('B1 results retain latest and best, complete after six passes, and roundtrip old and new backups',async()=>{
  await clearAllData()
  const old=await exportBackup()
  delete old.b1Exit
  saveA1ExitResult('reading',{score:5,total:8,passed:true})
  saveA2ExitResult('reading',{score:6,total:10,passed:true})
  const priorA1=getA1ExitProgress(),priorA2=getA2ExitProgress()
  saveB1ExitResult('grammar',{score:32,total:40,passed:true},new Date('2026-11-01T00:00:00Z'))
  saveB1ExitResult('grammar',{score:34,total:40,passed:false},new Date('2026-11-02T00:00:00Z'))
  assert.equal(getB1ExitProgress().grammar.latest.score,34)
  assert.equal(getB1ExitProgress().grammar.best.score,34)
  assert.equal(getB1ExitProgress().grammar.passedEver,true)
  assert.deepEqual(getA1ExitProgress(),priorA1)
  assert.deepEqual(getA2ExitProgress(),priorA2)
  for(const gate of B1_EXIT_GATES.filter((name)=>name!=='grammar'))saveB1ExitResult(gate,{score:10,total:10,passed:true},new Date('2026-11-03T00:00:00Z'))
  assert.equal(b1ExitComplete(getB1ExitProgress()),true)
  assert.equal(getB1ExitProgress().b1Completed,true)
  assert.equal(getB1ExitProgress().completedAt,'2026-11-03T00:00:00.000Z')
  const current=await exportBackup()
  assert.ok(current.b1Exit.grammar)
  await restoreBackup(old)
  assert.deepEqual(getB1ExitProgress(),{})
  await restoreBackup(current)
  assert.equal(getB1ExitProgress().grammar.attempts,2)
  assert.equal(getB1ExitProgress().b1Completed,true)
  assert.ok(memory.has(B1_EXIT_KEY))
  await clearAllData()
  assert.deepEqual(getB1ExitProgress(),{})
})
