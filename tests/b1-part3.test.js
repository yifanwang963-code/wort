import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {grammarUnits,gradeExercise} from '../src/grammar.js'
import {grammarComparisons} from '../src/grammar-expansion.js'
import {adjacentLesson,grammarLessonsForLevel,visibleGrammarLessons} from '../src/grammar-navigation.js'

const lessons=JSON.parse(readFileSync(new URL('../src/data/grammarB1Part3.json',import.meta.url),'utf8'))
const comparisons=JSON.parse(readFileSync(new URL('../src/data/grammarComparisonsB1.json',import.meta.url),'utf8'))
const ids=['t-b1-04','g-b1-13','g-b1-14','g-b1-15','t-b1-01','t-b1-03','t-b1-05','g-b1-16']

test('B1-3 completes the 24 lessons and six comparisons in final order',()=>{
  assert.deepEqual(lessons.map((unit)=>unit.id),ids)
  assert.deepEqual(lessons.map((unit)=>unit.order),[17,18,19,20,21,22,23,24])
  assert.deepEqual(comparisons.map((unit)=>unit.id),['c-b1-1','c-b1-2','c-b1-3','c-b1-4','c-b1-5','c-b1-6'])
  assert.deepEqual(comparisons.map((unit)=>unit.order),[25,26,27,28,29,30])
  assert.equal(grammarUnits.filter((unit)=>unit.level==='B1').length,24)
  assert.equal(grammarComparisons.filter((unit)=>unit.level==='B1').length,6)
  assert.equal(grammarLessonsForLevel('B1').length,30)
  assert.deepEqual(visibleGrammarLessons('B1','').units.slice(16).map((unit)=>unit.id),ids)
  assert.deepEqual(Object.values(adjacentLesson(grammarUnits.find((unit)=>unit.id==='g-b1-12'))).map((unit)=>unit?.id),['g-b1-11','t-b1-04'])
  assert.deepEqual(Object.values(adjacentLesson(comparisons.at(-1))).map((unit)=>unit?.id),['c-b1-5',undefined])
})

test('all new lessons and comparisons retain their cards, tables and gradeable answers',()=>{
  assert.ok(lessons.every((unit)=>unit.table&&unit.rules.length&&unit.examples.length&&unit.pitfalls.length&&unit.reading.text&&unit.writing.task&&unit.exercises.length===16))
  assert.ok(comparisons.every((unit)=>unit.table?.rows.length&&unit.exercises.length===8))
  for(const unit of [...lessons,...comparisons])for(const exercise of unit.exercises){
    let response
    if(['choice','listen_choice'].includes(exercise.type))response=exercise.answer
    else if(['fill','listen_fill','listen_dictation'].includes(exercise.type))response=exercise.blankAnswers??exercise.answer
    else if(exercise.type==='classify')response=exercise.items.map((item)=>item.group)
    else if(exercise.type==='order')response=exercise.answer.map((token)=>exercise.tokens.indexOf(token))
    else assert.fail(`Unknown type: ${exercise.type}`)
    assert.equal(gradeExercise(exercise,response).correct,true,`${unit.id}: ${exercise.q}`)
  }
})

test('formal closing, specified comparison grading and dictations match the source',()=>{
  const letter=lessons[0]
  assert.equal(letter.reading.preserveLines,true)
  assert.match(letter.reading.text,/Mit freundlichen Grüßen\nLan Wang/u)
  assert.match(letter.writing.sample,/Mit freundlichen Grüßen\nLan Wang/u)
  assert.doesNotMatch(letter.reading.text+'\n'+letter.writing.sample,/Mit freundlichen Grüßen,/u)
  const virtual=comparisons[2].exercises[7]
  assert.equal(virtual.displayAnswer,'Das hättest du mir sagen müssen.')
  assert.equal(gradeExercise(virtual,virtual.answer.map((token)=>virtual.tokens.indexOf(token))).correct,true)
  const relative=comparisons[4].exercises[2]
  assert.ok(relative.options[2].includes('deren die Eltern'))
  assert.equal(gradeExercise(relative,2).correct,false)
  assert.ok(lessons[1].exercises[15].answer.includes('geschlossene'))
  assert.ok(lessons[6].exercises[15].answer.includes('eure'))
  for(const unit of [lessons[1],lessons[6]])assert.equal(unit.exercises[15].audio,unit.exercises[15].answer)
})
