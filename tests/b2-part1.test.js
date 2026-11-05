import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gradeExercise,grammarUnits} from '../src/grammar.js'
import {adjacentLesson,availableGrammarLevels,visibleGrammarLessons} from '../src/grammar-navigation.js'

const units=JSON.parse(readFileSync(new URL('../src/data/grammarB2Part1.json',import.meta.url),'utf8'))
const ids=['p-b2-01','g-b2-01','t-b2-01','g-b2-02','g-b2-03','t-b2-02','g-b2-04','g-b2-05']

test('B2-1 adds the eight lessons in the established order',()=>{
  assert.deepEqual(units.map((unit)=>unit.id),ids)
  assert.deepEqual(units.map((unit)=>unit.order),[1,2,3,4,5,6,7,8])
  assert.ok(units.every((unit)=>unit.level==='B2'&&unit.table.rows.length>0
    &&unit.rules.length>0&&unit.examples.length>0&&unit.pitfalls.length>0
    &&unit.exercises.length===16&&unit.reading.text&&unit.writing.task&&unit.writing.sample))
  assert.deepEqual(availableGrammarLevels(),['A1','A2','B1','B2'])
  assert.deepEqual(visibleGrammarLessons('B2','').units.slice(0,8).map((unit)=>unit.id),ids)
  assert.equal(grammarUnits.filter((unit)=>unit.level==='B2').length,24)
  assert.equal(adjacentLesson(units[0]).previous,null)
  assert.equal(adjacentLesson(units[0]).next.id,ids[1])
  assert.equal(adjacentLesson(units[7]).previous.id,ids[6])
  assert.equal(adjacentLesson(units[7]).next.id,'g-b2-06')
})

test('all 128 B2-1 supplied answers grade and listening items have audio',()=>{
  for(const unit of units){
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
})
