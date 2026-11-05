import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {a1ExitData,gradeA1Grammar,gradeA1Choices,gradeA1Writing,gradeA1Speaking,createA1VocabularyTest,gradeA1Vocabulary} from '../src/a1-exit.js'
import {A1_EXIT_GATES,a1ExitComplete,getA1ExitProgress,saveA1ExitResult,clearA1ExitProgress} from '../src/a1-exit-progress.js'
import {exportBackup,restoreBackup,clearAllData} from '../src/db.js'

const storage=new Map()
globalThis.localStorage={getItem:(key)=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:(key)=>storage.delete(key)}
const correctGrammar=a1ExitData.grammar.map((question)=>question.type==='order'?question.answer.map((token)=>question.tokens.indexOf(token)):question.answer)
const correctChoices=(parts)=>parts.flatMap((part)=>part.clips?part.clips.flatMap((clip)=>clip.questions.map((question)=>question.answer)):part.questions.map((question)=>question.answer))

test('A1 exit content and six pass thresholds',()=>{
  assert.equal(a1ExitData.grammar.length,30)
  assert.equal(correctChoices(a1ExitData.listening).length,10)
  assert.equal(correctChoices(a1ExitData.reading).length,8)
  assert.equal(gradeA1Grammar(correctGrammar).passed,true)
  const wrong=[...correctGrammar];wrong[14]='dich';wrong[23]='denn'
  assert.equal(gradeA1Grammar(wrong).score,28)
  assert.equal(gradeA1Grammar(wrong).caseScore,8)
  assert.equal(gradeA1Grammar(wrong).passed,true)
  const badCase=[...correctGrammar];for(const index of [11,12,13])badCase[index]='wrong'
  assert.equal(gradeA1Grammar(badCase).passed,false)
  const badTense=[...correctGrammar];for(const index of [5,6])badTense[index]='wrong'
  assert.equal(gradeA1Grammar(badTense).passed,false)
  const listening=correctChoices(a1ExitData.listening)
  assert.deepEqual(listening.slice(6,8),[1,1])
  assert.equal(gradeA1Choices(a1ExitData.listening,listening,6).passed,true)
  assert.equal(gradeA1Choices(a1ExitData.reading,correctChoices(a1ExitData.reading),5).passed,true)
  assert.equal(gradeA1Writing(['filled form','filled message'],[[true,true,true,false],[true,true,true,true]]).passed,false)
  assert.equal(gradeA1Writing(['filled form','filled message'],[[true,true,true,true],[true,true,true,true]]).passed,true)
  assert.equal(gradeA1Speaking(['达成','达成','勉强']).passed,false)
  assert.equal(gradeA1Speaking(['达成','达成','达成']).passed,true)
})

test('A1 vocabulary samples 100 from each layer and does not write SRS',()=>{
  const words=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a1.json',import.meta.url),'utf8')).words
  const testSet=createA1VocabularyTest(words)
  assert.equal(testSet.core.length,100);assert.equal(testSet.recognition.length,100)
  assert.ok(testSet.core.every((word)=>word.layer==='核心主动'))
  assert.ok(testSet.recognition.every((question)=>question.options.length===4&&question.options[question.answer]===question.word.chinese))
  const core=testSet.core.map((word)=>[word.article,word.german].filter(Boolean).join(' '))
  const recognition=testSet.recognition.map((question)=>question.answer)
  assert.equal(gradeA1Vocabulary(testSet,core,recognition).passed,true)
  core[0]='wrong';assert.equal(gradeA1Vocabulary(testSet,core,recognition).coreScore,99)
  const snapshot=JSON.stringify(words)
  gradeA1Vocabulary(testSet,core,recognition)
  assert.equal(JSON.stringify(words),snapshot)
})

test('six results, latest attempt count and backup restoration',async()=>{
  await clearAllData();clearA1ExitProgress()
  for(const gate of A1_EXIT_GATES)saveA1ExitResult(gate,{score:1,total:1,passed:true})
  assert.equal(a1ExitComplete(getA1ExitProgress()),true)
  const backup=await exportBackup()
  assert.equal(backup.a1Exit.grammar.attempts,1)
  saveA1ExitResult('grammar',{score:0,total:1,passed:false})
  assert.equal(a1ExitComplete(getA1ExitProgress()),false)
  await restoreBackup(backup)
  assert.equal(a1ExitComplete(getA1ExitProgress()),true)
  assert.equal(getA1ExitProgress().grammar.attempts,1)
})
