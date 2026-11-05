import {test} from 'node:test'
import assert from 'node:assert/strict'
import {grammarUnits} from '../src/grammar.js'
import {grammarComparisons} from '../src/grammar-expansion.js'
import {grammarScenarios} from '../src/grammar-scenarios.js'
import {GRAMMAR_LEVEL_KEY,adjacentLesson,availableGrammarLevels,grammarLessonsForLevel,readGrammarLevel,saveGrammarLevel,scenarioLessonsForLevel,visibleGrammarLessons,visibleScenarioLessons} from '../src/grammar-navigation.js'

const data=new Map()
globalThis.localStorage={getItem:(key)=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:(key)=>data.delete(key)}

test('A1 through B2 lists, comparisons and search stay inside the selected level',()=>{
  assert.deepEqual(availableGrammarLevels(),['A1','A2','B1','B2'])
  const a2=visibleGrammarLessons('A2','')
  assert.equal(a2.units.length,29)
  assert.equal(a2.comparisons.length,5)
  assert.ok(a2.units.every((unit)=>unit.level==='A2'))
  const a1=visibleGrammarLessons('A1','')
  assert.equal(a1.units.length,32)
  assert.deepEqual(a1.comparisons.map((unit)=>unit.id),['c1','c2','c3','c4','c5','c6'])
  assert.equal(visibleGrammarLessons('A2','字母').units.length,0)
  assert.equal(visibleGrammarLessons('A1','字母').units.length,1)
  assert.equal(visibleScenarioLessons('A2','').length,10)
  assert.equal(visibleScenarioLessons('A1','').length,10)
  assert.equal(visibleScenarioLessons('A1','购物').length,1)
  assert.equal(visibleGrammarLessons('A1','c6').comparisons.length,1)
  assert.equal(grammarLessonsForLevel('A1').length,38)
  assert.equal(scenarioLessonsForLevel('A2').length,10)
})

test('B2 selector appears from its new content and disappears when that content is absent',()=>{
  assert.deepEqual(availableGrammarLevels(grammarUnits,grammarScenarios,grammarComparisons),['A1','A2','B1','B2'])
  assert.deepEqual(availableGrammarLevels(grammarUnits.filter((unit)=>unit.level!=='B2'),grammarScenarios.filter((unit)=>unit.level!=='B2'),grammarComparisons.filter((unit)=>unit.level!=='B2')),['A1','A2','B1'])
})

test('first, last and scenario links use their own list order',()=>{
  assert.deepEqual(Object.values(adjacentLesson(grammarUnits[0])).map((unit)=>unit?.id),[undefined,'g-a1-p2'])
  assert.deepEqual(Object.values(adjacentLesson(grammarComparisons[5])).map((unit)=>unit?.id),['c5',undefined])
  assert.deepEqual(Object.values(adjacentLesson(grammarUnits[31])).map((unit)=>unit?.id),['g-a1-18','c1'])
  assert.deepEqual(Object.values(adjacentLesson(grammarScenarios[0])).map((unit)=>unit?.id),[undefined,'s-a1-02'])
  assert.deepEqual(Object.values(adjacentLesson(grammarScenarios[9])).map((unit)=>unit?.id),['s-a1-09',undefined])
})

test('last selected grammar level is restored on a fresh page mount',()=>{
  data.clear()
  assert.equal(readGrammarLevel(),'A1')
  saveGrammarLevel('A2')
  assert.equal(data.get(GRAMMAR_LEVEL_KEY),'A2')
  assert.equal(readGrammarLevel(),'A2')
  saveGrammarLevel('B1')
  assert.equal(readGrammarLevel(),'B1')
})
