import {findGrammarUnits,grammarUnits} from './grammar.js'
import {grammarComparisons} from './grammar-expansion.js'
import {grammarScenarios} from './grammar-scenarios.js'

export const GRAMMAR_LEVEL_KEY='wort-grammar-level'

export function lessonLevel(lesson){
  if(lesson.level)return lesson.level
  if(/^c\d+$/u.test(lesson.id))return 'A1'
  const match=/^c-([a-z]\d+)-/iu.exec(lesson.id)
  return match?.[1].toUpperCase()??null
}

export function availableGrammarLevels(units=grammarUnits,scenarios=grammarScenarios,comparisons=grammarComparisons){
  return [...new Set([...units,...scenarios,...comparisons].map(lessonLevel).filter(Boolean))]
}

export function grammarLessonsForLevel(level){
  return [...grammarUnits.filter((unit)=>lessonLevel(unit)===level),
    ...grammarComparisons.filter((unit)=>lessonLevel(unit)===level)]
}

export function scenarioLessonsForLevel(level){
  return grammarScenarios.filter((unit)=>lessonLevel(unit)===level)
}

export function visibleGrammarLessons(level,query){
  const term=query.trim().toLocaleLowerCase()
  return {
    units:findGrammarUnits(query).filter((unit)=>lessonLevel(unit)===level),
    comparisons:grammarComparisons.filter((unit)=>lessonLevel(unit)===level
      &&[unit.title,unit.id].some((value)=>value.toLocaleLowerCase().includes(term))),
  }
}

export function visibleScenarioLessons(level,query){
  const term=query.trim().toLocaleLowerCase()
  return scenarioLessonsForLevel(level).filter((unit)=>[unit.title,unit.titleDe,unit.recommended]
    .some((value)=>value?.toLocaleLowerCase().includes(term)))
}

export function adjacentLesson(lesson){
  const level=lessonLevel(lesson)
  const lessons=lesson.id.startsWith('s-')?scenarioLessonsForLevel(level):grammarLessonsForLevel(level)
  const index=lessons.findIndex((entry)=>entry.id===lesson.id)
  return {previous:index>0?lessons[index-1]:null,next:index>=0?lessons[index+1]??null:null}
}

export function readGrammarLevel(){
  const levels=availableGrammarLevels()
  try{const stored=globalThis.localStorage?.getItem(GRAMMAR_LEVEL_KEY);if(levels.includes(stored))return stored}
  catch{/* Storage may be unavailable. */}
  return levels.includes('A1')?'A1':levels[0]??'A1'
}

export function saveGrammarLevel(level){
  if(!availableGrammarLevels().includes(level))return
  try{globalThis.localStorage?.setItem(GRAMMAR_LEVEL_KEY,level)}
  catch{/* Selection remains usable for this visit. */}
}
