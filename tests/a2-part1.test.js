import {test} from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {grammarUnits,gradeExercise} from '../src/grammar.js'
import {A2_UNIT_ORDER} from '../src/a2-curriculum.js'
import {finalGrammarOrder} from '../src/grammar-expansion.js'
import {getGrammarProgress,saveGrammarResult,clearGrammarProgress} from '../src/grammar-progress.js'
import {clearAllData,exportBackup,restoreBackup} from '../src/db.js'

const memory=new Map()
globalThis.localStorage={getItem:(key)=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:(key)=>memory.delete(key)}
const a2=grammarUnits.filter((unit)=>unit.level==='A2')

test('A2-1 nine units follow A2-0 order without changing A1 order',()=>{
  assert.deepEqual(grammarUnits.filter((unit)=>unit.level==='A1').map((unit)=>unit.id),finalGrammarOrder)
  assert.deepEqual(a2.slice(0,9).map((unit)=>unit.id),A2_UNIT_ORDER.slice(0,9))
  assert.deepEqual(a2.slice(0,9).map((unit)=>unit.order),[1,2,3,4,5,6,7,8,9])
  assert.deepEqual(a2.slice(0,9).map((unit)=>unit.exercises.length),[16,15,18,16,18,16,16,17,16])
  for(const unit of a2.slice(0,9)){
    assert.ok(unit.table.headers.length>0&&unit.table.rows.length>0)
    assert.ok(unit.rules.length&&unit.examples.length&&unit.pitfalls.length)
    assert.ok(unit.reading.text&&unit.reading.tasks&&unit.writing.task&&unit.writing.sample&&unit.writing.selfcheck)
    for(const exercise of unit.exercises){
      const answer=exercise.type==='order'?exercise.answer.map((token)=>exercise.tokens.indexOf(token))
        :exercise.type==='classify'?exercise.items.map((item)=>item.group):exercise.answer
      assert.equal(gradeExercise(exercise,answer).correct,true,`${unit.id}: ${exercise.q}`)
    }
  }
})

test('A2 adjective tables and audio metadata retain highlighted endings and chain readings',()=>{
  for(const id of ['g-a2-04','g-a2-05']){
    const unit=a2.find((entry)=>entry.id===id)
    assert.deepEqual(unit.table.headers.length,5)
    assert.deepEqual(unit.table.rows.length,3)
    assert.equal(unit.table.hl.length,12)
  }
  for(const id of ['g-a2-01','g-a2-03']){
    const unit=a2.find((entry)=>entry.id===id)
    assert.equal(unit.audioChips[0].items.length,8)
    assert.ok(unit.audioChips[0].items.every((item)=>item.speak.includes('，')))
  }
  assert.ok(a2[1].examples.some((example)=>example.audioParts?.length>1))
  assert.equal(a2[0].exercises[4].optionAudio,true)
  assert.equal(a2[0].exercises[13].options[a2[0].exercises[13].answer],'2 个')
  assert.equal(a2.find((unit)=>unit.id==='t-a2-03').reading.parts.length,2)
})

test('revised A2-1 includes 40 irregular verbs and the article-free recognition table and item',()=>{
  const verbs=a2.find((unit)=>unit.id==='g-a2-03').extraTables[0].rows
    .flatMap((row)=>[...row[1].matchAll(/([A-Za-zäöüß]+)→/gu)].map((match)=>match[1]))
    .filter((word)=>word!=='i')
  assert.equal(verbs.length,40)
  assert.equal(new Set(verbs).size,40)
  for(const word of ['schneiden','schwimmen','sinken','fliegen','ziehen','hängen','lassen'])assert.ok(verbs.includes(word))
  const unit=a2.find((entry)=>entry.id==='g-a2-05')
  assert.equal(unit.extraTables.length,2)
  assert.deepEqual(unit.extraTables[1].headers,['格','m','f','n','pl'])
  assert.equal(unit.extraTables[1].rows.length,3)
  assert.equal(unit.extraTables[1].hl.length,12)
  assert.ok(unit.extensionContent[0].startsWith('读法要点：无冠词时'))
  assert.equal(unit.exercises.length,17)
  assert.equal(unit.exercises[16].type,'choice')
  assert.equal(unit.exercises[16].answer,0)
})

test('A2 scores use existing grammar key and preserve A1 results',()=>{
  clearGrammarProgress()
  saveGrammarResult('g-a1-p1',15)
  saveGrammarResult('p-a2-01',14)
  assert.equal(getGrammarProgress()['g-a1-p1'].bestScore,15)
  assert.equal(getGrammarProgress()['p-a2-01'].bestScore,14)
  assert.ok(memory.has('wort-grammar-v1'))
})

test('old backup restores without A2 score and a new backup preserves both levels',async()=>{
  await clearAllData()
  saveGrammarResult('g-a1-p1',15)
  const old=await exportBackup()
  saveGrammarResult('p-a2-01',14)
  const current=await exportBackup()
  await restoreBackup(old)
  assert.equal(getGrammarProgress()['g-a1-p1'].bestScore,15)
  assert.equal(getGrammarProgress()['p-a2-01'],undefined)
  await restoreBackup(current)
  assert.equal(getGrammarProgress()['g-a1-p1'].bestScore,15)
  assert.equal(getGrammarProgress()['p-a2-01'].bestScore,14)
})
