import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {a2ExitData,A2_EXIT_GATES,createA2GrammarTest,gradeA2Grammar,gradeA2Choices,gradeA2Writing,gradeA2Speaking,createA2VocabularyTest,gradeA2Vocabulary} from '../src/a2-exit.js'
import {a2ExitComplete,clearA2ExitProgress,getA2ExitProgress,saveA2ExitResult,A2_EXIT_KEY} from '../src/a2-exit-progress.js'
import {clearAllData,exportBackup,restoreBackup} from '../src/db.js'

const memory=new Map()
globalThis.localStorage={getItem:(key)=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:(key)=>memory.delete(key)}

test('A2-5 transcribes all six sections and samples nine of twelve from each grammar group',()=>{
  assert.deepEqual(a2ExitData.grammar.map((question)=>question.group).filter((group,index,all)=>all.indexOf(group)===index),['时态组','从句组','词尾组','综合组'])
  assert.equal(a2ExitData.grammar.length,48)
  assert.deepEqual(a2ExitData.listening.map((part)=>part.questions.length),[3,3,2,2,2])
  assert.deepEqual(a2ExitData.reading.map((part)=>part.questions.length),[3,3,2,2])
  assert.deepEqual(a2ExitData.writing.map((part)=>part.checks.length),[8,6])
  assert.equal(a2ExitData.speaking.length,3)
  assert.equal(a2ExitData.grammar[0].q,'„Gestern ＿＿ ich einen Brief ＿＿."（口语）')
  assert.equal(a2ExitData.grammar[0].answer,0)
  const questions=createA2GrammarTest(()=>0.42)
  assert.equal(questions.length,36)
  assert.deepEqual(['时态组','从句组','词尾组','综合组'].map((group)=>questions.filter((question)=>question.group===group).length),[9,9,9,9])
  assert.equal(new Set(questions).size,36)
})

test('grammar has total and three group thresholds; listening, reading, writing and speaking use A2 pass lines',()=>{
  const questions=createA2GrammarTest(()=>0.42)
  const correct=questions.map((question)=>question.answer)
  const withErrors=(positions)=>correct.map((answer,index)=>positions.includes(index)?(answer+1)%questions[index].options.length:answer)
  const passing=withErrors([7,8,16,17,25,26,35])
  assert.deepEqual(gradeA2Grammar(questions,passing).groupScores,{时态组:7,从句组:7,词尾组:7,综合组:8})
  assert.equal(gradeA2Grammar(questions,passing).passed,true)
  assert.equal(gradeA2Grammar(questions,withErrors([6,7,8,25,26,34,35])).passed,false)
  assert.equal(gradeA2Grammar(questions,withErrors([7,8,16,17,25,26,34,35])).passed,false)
  const listening=a2ExitData.listening.flatMap((part)=>part.questions)
  const reading=a2ExitData.reading.flatMap((part)=>part.questions)
  const answers=(questions,correctCount)=>questions.map((question,index)=>index<correctCount?question.answer:(question.answer+1)%question.options.length)
  assert.equal(gradeA2Choices('listening',answers(listening,8)).passed,true)
  assert.equal(gradeA2Choices('listening',answers(listening,7)).passed,false)
  assert.equal(gradeA2Choices('reading',answers(reading,6)).passed,true)
  assert.equal(gradeA2Choices('reading',answers(reading,5)).passed,false)
  const checks=a2ExitData.writing.map((part)=>part.checks.map(()=>true))
  assert.equal(gradeA2Writing(['邮件','叙事'],checks).passed,true)
  checks[1][5]=false
  assert.equal(gradeA2Writing(['邮件','叙事'],checks).passed,false)
  assert.equal(gradeA2Speaking(['达成','达成','达成']).passed,true)
  assert.equal(gradeA2Speaking(['达成','基本达成','达成']).passed,false)
})

test('A2 vocabulary draws unique words from the required layers and applies 85/90 thresholds',()=>{
  const words=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a2.json',import.meta.url),'utf8')).words
  const sample=createA2VocabularyTest(words,()=>0.37)
  assert.equal(sample.core.length,100)
  assert.equal(sample.recognition.length,100)
  assert.equal(new Set(sample.core.map((word)=>`${word.article}:${word.german}`)).size,100)
  assert.equal(new Set(sample.recognition.map((question)=>`${question.word.article}:${question.word.german}`)).size,100)
  assert.ok(sample.core.every((word)=>word.layer==='核心主动'))
  assert.ok(sample.recognition.every((question)=>['被动认读','扩展认读'].includes(question.word.layer)))
  const core=sample.core.map((word)=>[word.article,word.german].filter(Boolean).join(' '))
  const recognition=sample.recognition.map((question)=>question.answer)
  assert.equal(gradeA2Vocabulary(sample,core,recognition).passed,true)
  const atLimit=core.map((answer,index)=>index<85?answer:'wrong')
  const recognitionAtLimit=recognition.map((answer,index)=>index<90?answer:(answer+1)%4)
  assert.equal(gradeA2Vocabulary(sample,atLimit,recognitionAtLimit).passed,true)
  atLimit[84]='wrong'
  assert.equal(gradeA2Vocabulary(sample,atLimit,recognitionAtLimit).passed,false)
})

test('A2 exit keeps the best numeric result, remembers a pass and roundtrips backups including old files',async()=>{
  await clearAllData()
  const old=await exportBackup()
  delete old.a2Exit
  saveA2ExitResult('grammar',{score:29,total:36,passed:true},new Date('2026-11-01'))
  saveA2ExitResult('grammar',{score:31,total:36,passed:false},new Date('2026-11-02'))
  assert.equal(getA2ExitProgress().grammar.best.score,31)
  assert.equal(getA2ExitProgress().grammar.passedEver,true)
  for(const gate of A2_EXIT_GATES.filter((gate)=>gate!=='grammar'))saveA2ExitResult(gate,{score:10,total:10,passed:true})
  assert.equal(a2ExitComplete(getA2ExitProgress()),true)
  const current=await exportBackup()
  assert.ok(current.a2Exit.grammar)
  await restoreBackup(old)
  assert.deepEqual(getA2ExitProgress(),{})
  await restoreBackup(current)
  assert.equal(a2ExitComplete(getA2ExitProgress()),true)
  assert.equal(getA2ExitProgress().grammar.attempts,2)
  assert.ok(memory.has(A2_EXIT_KEY))
  await clearAllData()
  assert.deepEqual(getA2ExitProgress(),{})
})
