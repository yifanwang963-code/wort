import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gradeExercise} from '../src/grammar.js'
import {completedScenarioWordKeys,grammarScenarios} from '../src/grammar-scenarios.js'
import {adjacentLesson,scenarioLessonsForLevel} from '../src/grammar-navigation.js'
import {wordKey} from '../src/word-model.js'

const scenes=JSON.parse(readFileSync(new URL('../src/data/scenariosB1.json',import.meta.url),'utf8'))

test('B1-4 has ten scenes in source order, each with dialogue, expressions, ten questions and oral selfcheck',()=>{
  assert.deepEqual(scenes.map((scene)=>scene.id),Array.from({length:10},(_,index)=>`s-b1-${String(index+1).padStart(2,'0')}`))
  assert.deepEqual(scenes.map((scene)=>scene.order),[1,2,3,4,5,6,7,8,9,10])
  assert.deepEqual(scenarioLessonsForLevel('B1').map((scene)=>scene.id),scenes.map((scene)=>scene.id))
  assert.ok(scenes.every((scene)=>scene.level==='B1'&&scene.sceneIntro&&scene.dialogue.length>=8&&scene.table.rows.length>=5&&scene.exercises.length===10&&scene.speaking&&scene.speakingSample&&scene.speakingSelfcheck))
  assert.deepEqual(Object.values(adjacentLesson(scenes[0])).map((scene)=>scene?.id),[undefined,'s-b1-02'])
  assert.deepEqual(Object.values(adjacentLesson(scenes.at(-1))).map((scene)=>scene?.id),['s-b1-09',undefined])
  assert.equal(grammarScenarios.filter((scene)=>scene.level==='A1').length,10)
  assert.equal(grammarScenarios.filter((scene)=>scene.level==='A2').length,10)
})

test('all B1 scene answers grade, with the specified listening and exact-form vocabulary markers',()=>{
  for(const scene of scenes)for(const exercise of scene.exercises){
    const response=['choice','listen_choice'].includes(exercise.type)?exercise.answer
      :['fill','listen_fill'].includes(exercise.type)?exercise.answer
      :exercise.type==='order'?exercise.answer.map((token)=>exercise.tokens.indexOf(token))
      :exercise.type==='classify'?exercise.items.map((item)=>item.group):null
    assert.notEqual(response,null,`${scene.id}: ${exercise.type}`)
    assert.equal(gradeExercise(exercise,response).correct,true,`${scene.id}: ${exercise.q}`)
  }
  assert.equal(scenes[3].exercises[2].audio,'Bitte schicken Sie uns die Anzeige und die Rechnung per E-Mail.')
  assert.equal(scenes[3].exercises[2].options[0],'要发邮件提交两样材料：报警记录和发票')
  assert.equal(scenes[7].exercises[2].audio,'Ich hätte es bereut, wenn ich es nicht versucht hätte.')
  assert.deepEqual(scenes[8].exercises[0].options,['320.000、60.000','260.000、60.000','320.000、260.000'])
  assert.ok(scenes[0].sceneWords.includes('die Überweisung'))
  assert.ok(scenes[0].sceneWords.includes('das Risiko'))
  const keys=completedScenarioWordKeys({'s-b1-01':{done:true}},'B1')
  assert.ok(keys.has(wordKey({german:'Überweisung',article:'die'})))
  assert.ok(keys.has(wordKey({german:'Risiko',article:'das'})))
  assert.equal(completedScenarioWordKeys({},'B1').size,0)
})
