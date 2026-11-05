import {test} from 'node:test'
import assert from 'node:assert/strict'
import {grammarUnits,gradeExercise} from '../src/grammar.js'
import {grammarComparisons} from '../src/grammar-expansion.js'
import {A2_UNIT_ORDER,A2_COMPARISON_ORDER} from '../src/a2-curriculum.js'
import {adjacentLesson,visibleGrammarLessons} from '../src/grammar-navigation.js'
import {clearGrammarProgress,getGrammarProgress,saveGrammarResult} from '../src/grammar-progress.js'

const memory=new Map()
globalThis.localStorage={getItem:(key)=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:(key)=>memory.delete(key)}
const a2=grammarUnits.filter((unit)=>unit.level==='A2')
const end=a2.slice(17)
const comparisons=grammarComparisons.filter((unit)=>unit.id.startsWith('c-a2-'))

function answerIndices(exercise){
  const available=exercise.tokens.map((_,index)=>index)
  return exercise.answer.map((token)=>{
    const position=available.findIndex((index)=>exercise.tokens[index]===token)
    assert.notEqual(position,-1)
    return available.splice(position,1)[0]
  })
}

test('A2-3 completes the 29-lesson curriculum and five eight-question comparisons',()=>{
  assert.deepEqual(a2.map((unit)=>unit.id),A2_UNIT_ORDER)
  assert.deepEqual(end.map((unit)=>unit.order),Array.from({length:12},(_,index)=>index+18))
  assert.deepEqual(end.map((unit)=>unit.exercises.length),[16,16,16,16,16,16,16,16,16,16,18,16])
  assert.deepEqual(comparisons.map((unit)=>unit.id),A2_COMPARISON_ORDER)
  assert.ok(comparisons.every((unit)=>unit.exercises.length===8))
  const visible=visibleGrammarLessons('A2','')
  assert.equal(visible.units.length,29)
  assert.equal(visible.comparisons.length,5)
  for(const unit of end){
    assert.ok(unit.table.rows.length&&unit.rules.length&&unit.examples.length)
    assert.ok(unit.reading.text&&unit.reading.tasks&&unit.writing.task&&unit.writing.sample&&unit.writing.selfcheck)
    assert.ok(unit.exercises.filter((exercise)=>exercise.type.startsWith('listen_')).every((exercise)=>exercise.audio))
  }
})

test('new lessons and comparisons have playable cards and grade their supplied answers',()=>{
  for(const unit of [...end,...comparisons])for(const exercise of unit.exercises){
    const answer=exercise.type==='order'?answerIndices(exercise)
      :exercise.type==='classify'?exercise.items.map((item)=>item.group)
        :exercise.blankAnswers??exercise.acceptedAnswers?.[0]??exercise.answer
    assert.equal(gradeExercise(exercise,answer).correct,true,`${unit.id}: ${exercise.q}`)
  }
  const alternate=end.find((unit)=>unit.id==='g-a2-16').exercises[6]
  assert.equal(gradeExercise(alternate,'Könnten').correct,true)
  assert.equal(gradeExercise(alternate,'Kann').correct,false)
  const twoBlanks=comparisons[1].exercises[4]
  assert.equal(gradeExercise(twoBlanks,['Hast','gesehen']).correct,true)
  assert.equal(gradeExercise(twoBlanks,['Hat','gesehen']).correct,false)
})

test('email lines, package boundary navigation and prior scores are preserved',()=>{
  const email=end.find((unit)=>unit.id==='t-a2-01')
  assert.ok(email.writing.sample.includes('\nSehr geehrte Damen und Herren,\nich'))
  assert.ok(email.writing.sample.includes('\nMit freundlichen Grüßen\nLan Wang'))
  assert.ok(email.examples.at(-1).de.includes('Mit freundlichen Grüßen\nLan Wang'))
  assert.ok(!email.examples.at(-1).de.includes('Mit freundlichen Grüßen,'))
  assert.deepEqual(Object.values(adjacentLesson(a2[16])).map((unit)=>unit?.id),['g-a2-13','g-a2-14'])
  assert.deepEqual(Object.values(adjacentLesson(a2.at(-1))).map((unit)=>unit?.id),['g-a2-22','c-a2-1'])
  assert.deepEqual(Object.values(adjacentLesson(comparisons.at(-1))).map((unit)=>unit?.id),['c-a2-4',undefined])
  clearGrammarProgress()
  saveGrammarResult('t-a2-02',12)
  saveGrammarResult('g-a2-14',15)
  assert.equal(getGrammarProgress()['t-a2-02'].bestScore,12)
  assert.equal(getGrammarProgress()['g-a2-14'].bestScore,15)
})
