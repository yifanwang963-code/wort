import {test} from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {grammarScenarios,completedScenarioWordKeys} from '../src/grammar-scenarios.js'
import {gradeExercise} from '../src/grammar.js'
import {A2_SCENARIO_ORDER} from '../src/a2-curriculum.js'
import {adjacentLesson,scenarioLessonsForLevel} from '../src/grammar-navigation.js'
import {wordKey} from '../src/word-model.js'
import {clearGrammarProgress,getGrammarProgress,saveGrammarResult} from '../src/grammar-progress.js'
import {exportBackup,restoreBackup} from '../src/db.js'

const memory=new Map()
globalThis.localStorage={getItem:(key)=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:(key)=>memory.delete(key)}
const scenes=scenarioLessonsForLevel('A2')

function answerIndices(exercise){
  const available=exercise.tokens.map((_,index)=>index)
  return exercise.answer.map((token)=>{
    const position=available.findIndex((index)=>exercise.tokens[index]===token)
    assert.notEqual(position,-1)
    return available.splice(position,1)[0]
  })
}

test('A2-4 has ten ordered scenes with five sections, dialogue audio and ten gradeable questions each',()=>{
  assert.deepEqual(scenes.map((scene)=>scene.id),A2_SCENARIO_ORDER)
  assert.deepEqual(scenes.map((scene)=>scene.order),Array.from({length:10},(_,index)=>index+1))
  for(const scene of scenes){
    assert.ok(scene.sceneIntro&&scene.dialogue.length&&scene.table.rows.length&&scene.speaking)
    assert.equal(scene.exercises.length,10)
    assert.equal(scene.audioChips[0].items.length,scene.dialogue.length)
    assert.ok(scene.dialogue.every((line)=>line.audio===line.text))
    assert.ok(scene.exercises.filter((exercise)=>exercise.type.startsWith('listen_')).every((exercise)=>exercise.audio))
    for(const exercise of scene.exercises){
      const answer=exercise.type==='order'?answerIndices(exercise):exercise.answer
      assert.equal(gradeExercise(exercise,answer).correct,true,`${scene.id}: ${exercise.q}`)
    }
  }
  assert.deepEqual(scenes[3].prerequisites,['g-a2-02','g-a2-03','g-a2-17'])
  assert.deepEqual(Object.values(adjacentLesson(scenes[0])).map((scene)=>scene?.id),[undefined,'s-a2-02'])
  assert.deepEqual(Object.values(adjacentLesson(scenes.at(-1))).map((scene)=>scene?.id),['s-a2-09',undefined])
  assert.equal(grammarScenarios.filter((scene)=>scene.level==='A1').length,10)
})

test('exact A2 dialogue words are marked only after completion without changing vocabulary or old backups',async()=>{
  const key1=wordKey({german:'Magen',article:'der'})
  const key2=wordKey({german:'Schlafzimmer',article:'das'})
  clearGrammarProgress()
  assert.equal(completedScenarioWordKeys(getGrammarProgress(),'A2').size,0)
  const before=await exportBackup()
  saveGrammarResult('s-a2-01',8)
  saveGrammarResult('s-a2-02',9)
  const marked=completedScenarioWordKeys(getGrammarProgress(),'A2')
  assert.equal(marked.has(key1),true)
  assert.equal(marked.has(key2),true)
  assert.equal(completedScenarioWordKeys(getGrammarProgress(),'A1').has(key1),false)
  const after=await exportBackup()
  assert.deepEqual(after.words,before.words)
  await restoreBackup(before)
  assert.equal(completedScenarioWordKeys(getGrammarProgress(),'A2').size,0)
  await restoreBackup(after)
  assert.equal(completedScenarioWordKeys(getGrammarProgress(),'A2').has(key1),true)
})
