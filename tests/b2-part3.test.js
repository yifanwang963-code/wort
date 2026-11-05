import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gradeExercise,grammarUnits} from '../src/grammar.js'
import {grammarComparisons} from '../src/grammar-expansion.js'
import {adjacentLesson,grammarLessonsForLevel,visibleGrammarLessons} from '../src/grammar-navigation.js'

const units=JSON.parse(readFileSync(new URL('../src/data/grammarB2Part3.json',import.meta.url),'utf8'))
const comparisons=JSON.parse(readFileSync(new URL('../src/data/grammarComparisonsB2.json',import.meta.url),'utf8'))
const ids=['t-b2-05','g-b2-12','g-b2-13','t-b2-06','g-b2-14','g-b2-15','t-b2-07','g-b2-16']
const comparisonIds=['c-b2-1','c-b2-2','c-b2-3','c-b2-4','c-b2-5','c-b2-6']

test('B2-3 completes 24 lessons and six comparisons in order',()=>{
  assert.deepEqual(units.map((unit)=>unit.id),ids)
  assert.deepEqual(units.map((unit)=>unit.order),[17,18,19,20,21,22,23,24])
  assert.deepEqual(comparisons.map((item)=>item.id),comparisonIds)
  assert.deepEqual(comparisons.map((item)=>item.order),[25,26,27,28,29,30])
  assert.ok(units.every((unit)=>unit.level==='B2'&&unit.table.rows.length
    &&unit.rules.length&&unit.examples.length&&unit.pitfalls.length
    &&unit.exercises.length===16&&unit.reading.text&&unit.writing.task))
  assert.ok(comparisons.every((item)=>item.level==='B2'&&item.table.rows.length&&item.exercises.length===8))
  assert.equal(grammarUnits.filter((unit)=>unit.level==='B2').length,24)
  assert.equal(grammarComparisons.filter((item)=>item.level==='B2').length,6)
  assert.equal(grammarLessonsForLevel('B2').length,30)
  assert.deepEqual(visibleGrammarLessons('B2','').units.slice(16).map((unit)=>unit.id),ids)
  assert.equal(adjacentLesson(grammarUnits.find((unit)=>unit.id==='g-b2-11')).next.id,ids[0])
  assert.equal(adjacentLesson(units.at(-1)).next.id,comparisonIds[0])
  assert.equal(adjacentLesson(comparisons.at(-1)).next,null)
})

test('all 176 B2-3 answers grade, including an unused distractor token',()=>{
  for(const unit of [...units,...comparisons]){
    for(const exercise of unit.exercises){
      const answer=exercise.type==='order'
        ?exercise.answer.map((token)=>exercise.tokens.indexOf(token))
        :exercise.answer
      assert.equal(gradeExercise(exercise,answer).correct,true,`${unit.id}: ${exercise.q}`)
      if(exercise.type.startsWith('listen_'))assert.ok(exercise.audio,`${unit.id}: missing audio`)
      if(['choice','listen_choice'].includes(exercise.type))assert.equal(exercise.options.length,3)
    }
  }
  assert.equal(units.reduce((count,unit)=>count+unit.exercises.length,0),128)
  assert.equal(comparisons.reduce((count,item)=>count+item.exercises.length,0),48)
  const withDistractor=units[2].exercises[13]
  assert.ok(withDistractor.tokens.includes('nicht'))
  assert.equal(withDistractor.answer.includes('nicht'),false)
  assert.equal(gradeExercise(withDistractor,[...withDistractor.answer.slice(0,4).map((token)=>withDistractor.tokens.indexOf(token)),withDistractor.tokens.indexOf('nicht')]).correct,false)
})

test('letter closings render on separate lines and the source without oral model adds none',()=>{
  assert.match(units[0].writing.sample,/Mit freundlichen Grüßen\nLan Wang/u)
  assert.match(units[3].writing.sample,/Mit freundlichen Grüßen\nBuchhaltung/u)
  assert.equal(units[2].writingLabel,'口头任务')
  assert.equal(units[2].writing.sample,'')
  assert.match(units[7].writing.sample,/Plan, der lange umstritten war,/u)
  assert.match(units[7].writing.sample,/Plan 带扩展定语和关系从句/u)
})
