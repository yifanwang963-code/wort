import {test} from 'node:test'
import assert from 'node:assert/strict'
import {grammarUnits,gradeExercise} from '../src/grammar.js'
import {A2_UNIT_ORDER} from '../src/a2-curriculum.js'
import {adjacentLesson,visibleGrammarLessons} from '../src/grammar-navigation.js'
import {getGrammarProgress,saveGrammarResult,clearGrammarProgress} from '../src/grammar-progress.js'

const memory=new Map()
globalThis.localStorage={getItem:(key)=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:(key)=>memory.delete(key)}

const a2=grammarUnits.filter((unit)=>unit.level==='A2')
const middle=a2.slice(9,17)

test('A2-2 follows the final curriculum and all eight lessons have the supplied sections and question counts',()=>{
  assert.deepEqual(a2.slice(0,17).map((unit)=>unit.id),A2_UNIT_ORDER.slice(0,17))
  assert.deepEqual(middle.map((unit)=>unit.order),[10,11,12,13,14,15,16,17])
  assert.deepEqual(middle.map((unit)=>unit.exercises.length),[16,16,18,18,16,16,16,16])
  assert.equal(visibleGrammarLessons('A2','').units.length,29)
  for(const unit of middle){
    assert.ok(unit.table.rows.length&&unit.rules.length&&unit.examples.length)
    assert.ok(unit.reading.text&&unit.reading.tasks&&unit.writing.task&&unit.writing.sample&&unit.writing.selfcheck)
    assert.ok(unit.exercises.filter((exercise)=>exercise.type.startsWith('listen_')).every((exercise)=>exercise.audio))
    for(const exercise of unit.exercises){
      const answer=exercise.type==='order'?exercise.answer.map((token)=>exercise.tokens.indexOf(token))
        :exercise.type==='classify'?exercise.items.map((item)=>item.group):exercise.answer
      assert.equal(gradeExercise(exercise,answer).correct,true,`${unit.id}: ${exercise.q}`)
    }
  }
})

test('A2-2 classification keeps sentences with internal commas intact, and navigation crosses the package boundary',()=>{
  const time=middle.find((unit)=>unit.id==='g-a2-12').exercises.find((exercise)=>exercise.type==='classify')
  assert.deepEqual(time.items.map((item)=>item.text),[
    'Als ich zehn war, …','Als der Zug ankam, …',
    'Wenn ich Zeit habe, …','Immer wenn es regnet, …','Wenn ich früher krank war, …（反复）',
  ])
  assert.equal(middle.find((unit)=>unit.id==='g-a2-13').exercises.find((exercise)=>exercise.type==='classify').items.length,4)
  assert.deepEqual(Object.values(adjacentLesson(a2[8])).map((unit)=>unit?.id),['g-a2-05','g-a2-07'])
  assert.deepEqual(Object.values(adjacentLesson(middle.at(-1))).map((unit)=>unit?.id),['g-a2-13','g-a2-14'])
  assert.deepEqual(middle.at(-1).reading.parts.map((part)=>part.label),['留言一','留言二'])
})

test('A2-2 results use the existing progress storage without overwriting earlier scores',()=>{
  clearGrammarProgress()
  saveGrammarResult('g-a2-06',12)
  saveGrammarResult('g-a2-07',15)
  assert.equal(getGrammarProgress()['g-a2-06'].bestScore,12)
  assert.equal(getGrammarProgress()['g-a2-07'].bestScore,15)
})
