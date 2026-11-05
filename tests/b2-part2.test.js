import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gradeExercise,grammarUnits} from '../src/grammar.js'
import {adjacentLesson,visibleGrammarLessons} from '../src/grammar-navigation.js'

const units=JSON.parse(readFileSync(new URL('../src/data/grammarB2Part2.json',import.meta.url),'utf8'))
const ids=['g-b2-06','t-b2-03','g-b2-07','g-b2-08','g-b2-09','t-b2-04','g-b2-10','g-b2-11']

test('B2-2 adds order 9–16 and navigation connects to B2-1',()=>{
  assert.deepEqual(units.map((unit)=>unit.id),ids)
  assert.deepEqual(units.map((unit)=>unit.order),[9,10,11,12,13,14,15,16])
  assert.ok(units.every((unit)=>unit.level==='B2'&&unit.table.rows.length>0
    &&unit.rules.length>0&&unit.examples.length>0&&unit.pitfalls.length>0
    &&unit.exercises.length===16&&unit.reading.text&&unit.writing.task&&unit.writing.sample))
  assert.deepEqual(visibleGrammarLessons('B2','').units.slice(0,16).map((unit)=>unit.id),
    ['p-b2-01','g-b2-01','t-b2-01','g-b2-02','g-b2-03','t-b2-02','g-b2-04','g-b2-05',...ids])
  assert.equal(grammarUnits.filter((unit)=>unit.level==='B2').length,24)
  assert.equal(adjacentLesson(grammarUnits.find((unit)=>unit.id==='g-b2-05')).next.id,ids[0])
  assert.equal(adjacentLesson(units[0]).previous.id,'g-b2-05')
  assert.equal(adjacentLesson(units.at(-1)).next.id,'t-b2-05')
  assert.equal(units[1].writingLabel,'口头任务')
})

test('all 128 B2-2 answers grade and the three corrected items remain usable',()=>{
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
  assert.match(units[0].exercises[8].q,/bleibt der Bahnhof geöffnet/u)
  assert.equal(units[3].exercises[11].tokens.includes('zu'),false)
  assert.equal(units[6].exercises[14].type,'fill')
})
