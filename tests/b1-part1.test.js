import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {grammarUnits,gradeExercise} from '../src/grammar.js'
import {adjacentLesson,availableGrammarLevels,grammarLessonsForLevel,visibleGrammarLessons,visibleScenarioLessons} from '../src/grammar-navigation.js'
import {getGrammarProgress,saveGrammarResult} from '../src/grammar-progress.js'
import {tableCellAudio} from '../src/grammar-audio.js'

const units=JSON.parse(readFileSync(new URL('../src/data/grammarB1Part1.json',import.meta.url),'utf8'))
const ids=['p-b1-01','p-b1-02','g-b1-01','g-b1-02','g-b1-03','t-b1-06','g-b1-04','g-b1-05']
const storage=new Map()
globalThis.localStorage={getItem:(key)=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:(key)=>storage.delete(key)}

test('B1-1 has eight lessons in B1-0 order, each with six sections and 16 questions',()=>{
  assert.deepEqual(units.map((unit)=>unit.id),ids)
  assert.deepEqual(units.map((unit)=>unit.order),[1,2,3,4,5,6,7,8])
  assert.ok(units.every((unit)=>unit.level==='B1'&&unit.table&&unit.rules.length&&unit.examples.length&&unit.pitfalls.length&&unit.reading.text&&unit.writing.task&&unit.exercises.length===16))
  assert.deepEqual(grammarUnits.filter((unit)=>unit.level==='B1').slice(0,8).map((unit)=>unit.id),ids)
  assert.deepEqual(availableGrammarLevels(),['A1','A2','B1','B2'])
  assert.deepEqual(visibleGrammarLessons('B1','').units.slice(0,8).map((unit)=>unit.id),ids)
  assert.equal(visibleScenarioLessons('B1','').length,10)
  assert.equal(grammarLessonsForLevel('B1').length,30)
  assert.equal(grammarUnits.filter((unit)=>unit.level==='A1').length,32)
  assert.equal(grammarUnits.filter((unit)=>unit.level==='A2').length,29)
  assert.deepEqual(Object.values(adjacentLesson(units[0])).map((unit)=>unit?.id),[undefined,'p-b1-02'])
  assert.deepEqual(Object.values(adjacentLesson(units.at(-1))).map((unit)=>unit?.id),['g-b1-04','g-b1-06'])
})

test('pronunciation emphasis, pause marks, audio and supplied answers survive transcription',()=>{
  assert.ok(units[0].examples[0].de.includes('**Brief**'))
  assert.ok(units[0].reading.text.includes('**Samstag** /'))
  assert.ok(units[1].reading.text.includes('**kleinen**'))
  assert.ok(units[0].writing.sample.includes('**Film**'))
  for(const unit of units){
    const listening=unit.exercises.filter((exercise)=>exercise.type.startsWith('listen_'))
    assert.ok(listening.length>=3)
    assert.ok(listening.every((exercise)=>exercise.audio))
    assert.ok(listening.some((exercise)=>exercise.type==='listen_choice'))
    assert.ok(listening.some((exercise)=>exercise.type==='listen_fill'))
    assert.ok(listening.some((exercise)=>exercise.type==='listen_dictation'))
    for(const exercise of unit.exercises){
      if(['choice','listen_choice'].includes(exercise.type))assert.equal(gradeExercise(exercise,exercise.answer).correct,true)
      else if(['fill','listen_fill','listen_dictation'].includes(exercise.type))
        assert.equal(gradeExercise(exercise,exercise.blankAnswers??exercise.answer).correct,true)
      else if(exercise.type==='classify')assert.equal(gradeExercise(exercise,exercise.items.map((item)=>item.group)).correct,true)
      else if(exercise.type==='order')assert.equal(gradeExercise(exercise,exercise.answer.map((token)=>exercise.tokens.indexOf(token))).correct,true)
      else assert.fail(`Unknown type ${exercise.type}`)
    }
  }
  const modal=units.find((unit)=>unit.id==='g-b1-02').exercises
  assert.equal(modal[4].options[modal[4].answer],'…, weil das Auto repariert werden muss.')
  assert.equal(gradeExercise(modal[4],0).correct,true)
  const past=units.find((unit)=>unit.id==='g-b1-04').exercises
  assert.equal(past[7].options[past[7].answer],'Ich hätte anrufen sollen.')
  assert.equal(gradeExercise(past[7],0).correct,true)
  assert.ok(tableCellAudio(units[0].table,1,0).length>0)
})

test('B1 scores use the existing grammar key without changing A1 or A2 scores',()=>{
  storage.clear()
  saveGrammarResult('g-a1-01',8)
  saveGrammarResult('g-a2-01',9)
  saveGrammarResult('g-b1-01',12)
  const progress=getGrammarProgress()
  assert.equal(progress['g-a1-01'].bestScore,8)
  assert.equal(progress['g-a2-01'].bestScore,9)
  assert.equal(progress['g-b1-01'].bestScore,12)
  assert.ok(storage.has('wort-grammar-v1'))
})
