import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {gradeExercise} from '../src/grammar.js'
import {b2ExitData,createB2GrammarTest,gradeB2Grammar,gradeB2Choices,gradeB2Writing,gradeB2Speaking,createB2VocabularyTest,gradeB2Output,gradeB2Vocabulary} from '../src/b2-exit.js'
import {b2ExitComplete,saveB2ExitResult,getB2ExitProgress,validateB2ExitProgress} from '../src/b2-exit-progress.js'
import {clearAllData,exportBackup,restoreBackup} from '../src/db.js'

test('B2-5 source quantities and all grammar answers',()=>{
  assert.equal(b2ExitData.grammar.length,72)
  assert.deepEqual(['A','B','C','D'].map(group=>b2ExitData.grammar.filter(q=>q.group===group).length),[18,18,18,18])
  assert.deepEqual(b2ExitData.listening.map(part=>part.questions.length),[3,3,3,3])
  assert.deepEqual(b2ExitData.reading.map(part=>part.questions.length),[4,3,3,3,2])
  assert.deepEqual(b2ExitData.writing.map(part=>part.checks.length),[5,4])
  assert.deepEqual(b2ExitData.speaking.map(part=>part.checks.length),[4,4])
  for(const q of b2ExitData.grammar)assert.equal(gradeExercise(q,q.answer).correct,true,q.number)
  for(const gate of ['listening','reading'])for(const part of b2ExitData[gate])for(const q of part.questions)assert.ok(q.options[q.answer],q.q)
})

test('grammar draws 12 per group and applies both pass lines',()=>{
  const test=createB2GrammarTest(()=>0.5)
  assert.deepEqual(['A','B','C','D'].map(group=>test.filter(q=>q.group===group).length),[12,12,12,12])
  const answers=test.map(q=>q.answer)
  assert.equal(gradeB2Grammar(test,answers).passed,true)
  const failed=[...answers]
  for(let i=0;i<5;i++)failed[i]=test[i].type==='choice'?2:'wrong'
  assert.equal(gradeB2Grammar(test,failed).passed,false)
  const second=createB2GrammarTest(()=>0.5,test.map(q=>q.number))
  for(const group of ['A','B','C','D'])assert.equal(second.filter(q=>q.group===group&&!test.some(old=>old.number===q.number)).length,6)
})

test('listening, reading, self ratings and vocabulary half-error',()=>{
  assert.equal(gradeB2Choices('listening',b2ExitData.listening.flatMap(p=>p.questions.map(q=>q.answer))).passed,true)
  assert.equal(gradeB2Choices('reading',b2ExitData.reading.flatMap(p=>p.questions.map(q=>q.answer))).passed,true)
  const writing=gradeB2Writing(['text','text'],b2ExitData.writing.map(p=>p.checks.map(()=>true)),['达成','基本达成'])
  assert.equal(writing.passed,true)
  assert.equal(writing.w2.tier,'基本达成')
  assert.equal(gradeB2Speaking(['达成','达成'],b2ExitData.speaking.map(p=>p.checks.map(()=>true))).passed,true)
  assert.equal(gradeB2Speaking(['基本达成','达成'],b2ExitData.speaking.map(p=>p.checks.map(()=>true))).passed,false)
  assert.equal(gradeB2Output({article:'die',german:'Schule'},'der Schule'),0.5)
  assert.equal(gradeB2Output({article:'die',german:'Schule'},'Schule'),0.5)
  assert.equal(gradeB2Output({article:'die',german:'Schule'},'die Schule'),1)
  const words=JSON.parse(readFileSync(new URL('../public/wordbooks/b2.json',import.meta.url),'utf8')).words
  const sample=createB2VocabularyTest(words,()=>0.4)
  assert.equal(sample.core.length,150)
  assert.equal(sample.recognition.length,150)
  assert.equal(new Set(sample.core.map(word=>`${word.german}:${word.article}`)).size,150)
  assert.equal(new Set(sample.recognition.map(item=>`${item.word.german}:${item.word.article}`)).size,150)
  const answers=sample.core.map(word=>[word.article,word.german].filter(Boolean).join(' '))
  const recognition=sample.recognition.map(q=>q.answer)
  assert.equal(gradeB2Vocabulary(sample,answers,recognition).passed,true)
  const threshold=answers.map((answer,index)=>index<128?answer:'wrong')
  assert.equal(gradeB2Vocabulary(sample,threshold,recognition).passed,true)
  threshold[127]='wrong'
  assert.equal(gradeB2Vocabulary(sample,threshold,recognition).passed,false)
})

test('B2 attempts remain available and six passes complete the level',()=>{
  const saved=globalThis.localStorage
  const data=new Map()
  globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}
  try{
    for(const gate of ['grammar','listening','reading','writing','speaking','vocab'])saveB2ExitResult(gate,{score:1,total:1,passed:true})
    const result=getB2ExitProgress()
    assert.equal(result.attempts.length,6)
    assert.equal(result.overallPass,true)
    assert.equal(b2ExitComplete(result),true)
    assert.deepEqual(validateB2ExitProgress(result),result)
  }finally{globalThis.localStorage=saved}
})

test('B2 exit survives backup restoration and older backups clear it safely',async()=>{
  const entries=new Map()
  globalThis.localStorage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)}
  await clearAllData()
  const old=await exportBackup()
  delete old.b2Exit
  saveB2ExitResult('grammar',{score:39,total:48,passed:true})
  const current=await exportBackup()
  assert.equal(current.b2Exit.grammar.score,39)
  await restoreBackup(old)
  assert.deepEqual(getB2ExitProgress(),{})
  await restoreBackup(current)
  assert.equal(getB2ExitProgress().grammar.score,39)
  await clearAllData()
  assert.deepEqual(getB2ExitProgress(),{})
})
