import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {grammarUnits,gradeExercise} from '../src/grammar.js'
import {adjacentLesson,grammarLessonsForLevel,visibleGrammarLessons} from '../src/grammar-navigation.js'

const part1=JSON.parse(readFileSync(new URL('../src/data/grammarB1Part1.json',import.meta.url),'utf8'))
const units=JSON.parse(readFileSync(new URL('../src/data/grammarB1Part2.json',import.meta.url),'utf8'))
const part3=JSON.parse(readFileSync(new URL('../src/data/grammarB1Part3.json',import.meta.url),'utf8'))
const ids=['g-b1-06','g-b1-07','g-b1-08','t-b1-02','g-b1-09','g-b1-10','g-b1-11','g-b1-12']

test('B1-2 adds eight units in order 9–16 and connects to B1-1',()=>{
  assert.deepEqual(units.map((unit)=>unit.id),ids)
  assert.deepEqual(units.map((unit)=>unit.order),[9,10,11,12,13,14,15,16])
  assert.ok(units.every((unit)=>unit.level==='B1'&&unit.table&&unit.rules.length&&unit.examples.length&&unit.pitfalls.length&&unit.reading.text&&unit.writing.task&&unit.exercises.length===16))
  assert.deepEqual(grammarUnits.filter((unit)=>unit.level==='B1').map((unit)=>unit.id),[...part1.map((unit)=>unit.id),...ids,...part3.map((unit)=>unit.id)])
  assert.deepEqual(visibleGrammarLessons('B1','').units.map((unit)=>unit.id),[...part1.map((unit)=>unit.id),...ids,...part3.map((unit)=>unit.id)])
  assert.equal(grammarLessonsForLevel('B1').length,30)
  assert.deepEqual(Object.values(adjacentLesson(part1.at(-1))).map((unit)=>unit?.id),['g-b1-04','g-b1-06'])
  assert.deepEqual(Object.values(adjacentLesson(units.at(-1))).map((unit)=>unit?.id),['g-b1-11','t-b1-04'])
  assert.equal(grammarUnits.filter((unit)=>unit.level==='A1').length,32)
  assert.equal(grammarUnits.filter((unit)=>unit.level==='A2').length,29)
})

test('all 128 supplied answers grade correctly and the three double blanks use two inputs',()=>{
  for(const unit of units)for(const exercise of unit.exercises){
    if(['choice','listen_choice'].includes(exercise.type))assert.equal(gradeExercise(exercise,exercise.answer).correct,true)
    else if(['fill','listen_fill','listen_dictation'].includes(exercise.type))
      assert.equal(gradeExercise(exercise,exercise.blankAnswers??exercise.answer).correct,true)
    else if(exercise.type==='classify')assert.equal(gradeExercise(exercise,exercise.items.map((item)=>item.group)).correct,true)
    else if(exercise.type==='order')assert.equal(gradeExercise(exercise,exercise.answer.map((token)=>exercise.tokens.indexOf(token))).correct,true)
    else assert.fail(`Unknown type ${exercise.type}`)
  }
  const byId=(id)=>units.find((unit)=>unit.id===id)
  assert.deepEqual(byId('g-b1-08').exercises[8].blankAnswers,['sodass','konnte'])
  assert.deepEqual(byId('g-b1-12').exercises[1].blankAnswers,['auf','ihn'])
  assert.deepEqual(byId('g-b1-12').exercises[7].blankAnswers,['Auf','wen'])
  assert.equal(gradeExercise(byId('g-b1-08').exercises[8],['sodass','konnte']).correct,true)
  assert.equal(gradeExercise(byId('g-b1-12').exercises[1],['auf','ihn']).correct,true)
  const relative=byId('g-b1-10').exercises[7]
  assert.equal(relative.q,'找对句')
  assert.equal(relative.options[1],'Die Frau, deren der Mann Arzt ist, wohnt hier.')
  assert.equal(gradeExercise(relative,1).correct,false)
})

test('each lesson carries its listening text and the two specified dictations match answers',()=>{
  for(const unit of units){
    const audio=unit.exercises.filter((exercise)=>exercise.type.startsWith('listen_'))
    assert.ok(audio.length>=3)
    assert.ok(['listen_choice','listen_fill','listen_dictation'].every((type)=>audio.some((exercise)=>exercise.type===type)))
    assert.ok(audio.every((exercise)=>exercise.audio))
    const dictation=audio.find((exercise)=>exercise.type==='listen_dictation')
    assert.equal(dictation.audio,dictation.answer)
  }
  assert.ok(units[0].exercises[15].answer.includes('sei gestern schon angekommen'))
  assert.ok(units[6].exercises[15].answer.includes('des Unfalls'))
})
