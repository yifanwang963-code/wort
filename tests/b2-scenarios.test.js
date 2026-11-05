import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gradeExercise} from '../src/grammar.js'
import {grammarScenarios,completedScenarioWordKeys} from '../src/grammar-scenarios.js'
import {scenarioLessonsForLevel,adjacentLesson} from '../src/grammar-navigation.js'

const scenes=JSON.parse(readFileSync(new URL('../src/data/scenariosB2.json',import.meta.url),'utf8'))

test('B2-4 has ten scenes in order, with every prescribed section',()=>{
  assert.deepEqual(scenes.map(scene=>scene.id),Array.from({length:10},(_,i)=>`s-b2-${String(i+1).padStart(2,'0')}`))
  assert.deepEqual(scenarioLessonsForLevel('B2').map(scene=>scene.id),scenes.map(scene=>scene.id))
  assert.ok(scenes.every(scene=>scene.level==='B2'&&scene.sceneIntro&&scene.dialogue.length>=8&&scene.table.rows.length===5&&scene.exercises.length===10&&scene.speaking&&scene.speakingSample&&scene.speakingSelfcheck))
  assert.deepEqual(Object.values(adjacentLesson(scenes[0])).map(scene=>scene?.id),[undefined,'s-b2-02'])
  assert.deepEqual(Object.values(adjacentLesson(scenes.at(-1))).map(scene=>scene?.id),['s-b2-09',undefined])
  assert.ok(grammarScenarios.some(scene=>scene.id==='s-b2-01'))
})

test('all B2 scene answers are accepted by the existing grader',()=>{
  for(const scene of scenes)for(const exercise of scene.exercises){
    const response=['choice','listen_choice'].includes(exercise.type)?exercise.answer
      :exercise.type==='fill'?exercise.answer
      :exercise.type==='order'?exercise.answer.map(token=>exercise.tokens.indexOf(token)):null
    assert.notEqual(response,null,`${scene.id}: ${exercise.type}`)
    assert.equal(gradeExercise(exercise,response).correct,true,`${scene.id}: ${exercise.q}`)
  }
  assert.ok(scenes.some(scene=>scene.sceneWords.length>0))
  assert.ok(completedScenarioWordKeys({'s-b2-01':{done:true}},'B2').size>0)
  assert.equal(completedScenarioWordKeys({},'B2').size,0)
})
