import { grammarA1 } from './data/grammarA1.js'
import grammarA1More from './data/grammarA1More.json' with { type: 'json' }
import grammarA1Cases from './data/grammarA1Cases.json' with { type: 'json' }
import pronunciationA1 from './data/pronunciationA1.json' with { type: 'json' }
import grammarA1Finish from './data/grammarA1Finish.json' with { type: 'json' }
import languageToolsA1 from './data/languageToolsA1.json' with { type: 'json' }
import grammarA2Part1 from './data/grammarA2Part1.json' with { type: 'json' }
import grammarA2Part2 from './data/grammarA2Part2.json' with { type: 'json' }
import grammarA2Part3 from './data/grammarA2Part3.json' with { type: 'json' }
import grammarB1Part1 from './data/grammarB1Part1.json' with { type: 'json' }
import grammarB1Part2 from './data/grammarB1Part2.json' with { type: 'json' }
import grammarB1Part3 from './data/grammarB1Part3.json' with { type: 'json' }
import grammarB2Part1 from './data/grammarB2Part1.json' with { type: 'json' }
import grammarB2Part2 from './data/grammarB2Part2.json' with { type: 'json' }
import grammarB2Part3 from './data/grammarB2Part3.json' with { type: 'json' }
import {expandGrammarUnits} from './grammar-expansion.js'

export const grammarUnits = [...expandGrammarUnits([...pronunciationA1,...languageToolsA1,...grammarA1,...grammarA1More.filter((unit)=>unit.id!=='g-a1-00'),...grammarA1Cases,...grammarA1Finish]),...grammarA2Part1,...grammarA2Part2,...grammarA2Part3,...grammarB1Part1,...grammarB1Part2,...grammarB1Part3,...grammarB2Part1,...grammarB2Part2,...grammarB2Part3]
export const grammarKeywords = {
  'g-a1-p1': ['字母','发音','拼读','Alphabet'],
  'g-a1-p2': ['发音','元音','长音','短音','Vokale'],
  'g-a1-p3': ['发音','双元音','ei','au','eu','ie'],
  'g-a1-p4': ['发音','辅音','Konsonanten','ch','sch','pf','qu'],
  'g-a1-p5': ['发音','音节','重音','拼写','Akzent'],
  'g-a1-p6': ['发音','语调','连读','韵律','Satzmelodie'],
  'g-a1-19': ['数字','价格','Zahlen','Preise'],
  'g-a1-20': ['日期','时间','Datum','Uhrzeit'],
  'g-a1-21': ['问候','介绍','个人信息','Begrüßung'],
  'g-a1-22': ['请求','感谢','道歉','邀请','交际'],
  'g-a1-01': ['lernen','sein','haben','变位'],
  'g-a1-02': ['fahren','essen','lesen','元音变化'],
  'g-a1-03': ['情态','können','müssen','wollen','dürfen','möchten'],
  'g-a1-04': ['可分','aufstehen','einkaufen','fernsehen'],
  'g-a1-05': ['命令','Imperativ','Komm','Lies'],
  'g-a1-06': ['完成时','Perfekt','Partizip','gefahren'],
  'g-a1-07': ['冠词','复数','Artikel','Plural','der','die','das'],
  'g-a1-08': ['主格','宾格','Nominativ','Akkusativ','den','einen'],
  'g-a1-09': ['否定','kein','nicht','keinen'],
  'g-a1-10': ['物主','mein','dein','sein','ihr','unser','euer'],
}

export function findGrammarUnits(query) {
  const term=query.trim().toLocaleLowerCase()
  if (!term) return grammarUnits
  return grammarUnits.filter((unit)=>[unit.title,unit.titleDe,...(grammarKeywords[unit.id] ?? [])].some((value)=>value.toLocaleLowerCase().includes(term)))
}

const umlauts = (value) => value.replace(/ae/gi,(match)=>match[0]==='A'?'Ä':'ä')
  .replace(/oe/gi,(match)=>match[0]==='O'?'Ö':'ö')
  .replace(/ue/gi,(match)=>match[0]==='U'?'Ü':'ü')
  .replace(/ss/gi,(match)=>match[0]==='S'?'ẞ':'ß')
const firstLower = (value) => value.length ? value[0].toLocaleLowerCase('de-DE')+value.slice(1) : value
const spaces = (value) => [...value].filter((letter)=>letter===' ').length

export function gradeFill(input, answer) {
  if (input === answer) return {correct:true,minor:[]}
  const minor=[]
  let attempt=input
  if (firstLower(attempt)===firstLower(answer) && attempt!==answer) return {correct:true,minor:['首字母大小写']}
  const converted=umlauts(attempt), target=umlauts(answer)
  if (converted!==attempt || target!==answer) {
    if (converted===target) return {correct:true,minor:['变音字母写法']}
    attempt=converted
    minor.push('变音字母写法')
  }
  if (firstLower(attempt)===firstLower(target) && attempt!==target) {
    attempt=firstLower(attempt)
    minor.push('首字母大小写')
  }
  if (attempt===firstLower(target)) return {correct:true,minor}
  if (Math.abs(spaces(attempt)-spaces(target))===1 && attempt.replaceAll(' ','')===target.replaceAll(' ','')) {
    minor.push('多打/漏打一个空格')
    return {correct:true,minor}
  }
  return {correct:false,minor:[]}
}

const normalizeDictation = (value) => value.trim().replace(/[.!?。！？]+$/u,'').replace(/\s+/gu,' ')
export function gradeDictation(input,answer) {
  const attempt=normalizeDictation(input),target=normalizeDictation(answer)
  if(attempt===target)return {correct:true,minor:[]}
  const converted=umlauts(attempt),expected=umlauts(target)
  if(converted.toLocaleLowerCase('de-DE')!==expected.toLocaleLowerCase('de-DE'))return {correct:false,minor:[]}
  const minor=[]
  if(attempt.toLocaleLowerCase('de-DE')!==target.toLocaleLowerCase('de-DE'))minor.push('变音字母写法')
  if(converted!==expected)minor.push('大小写')
  return {correct:true,minor}
}

export function gradeExercise(exercise, answer) {
  if (exercise.type==='fill' || exercise.type==='listen_fill') {
    if(exercise.blankAnswers){
      if(!Array.isArray(answer)||answer.length!==exercise.blankAnswers.length)return {correct:false,minor:[]}
      const grades=exercise.blankAnswers.map((expected,index)=>gradeFill(answer[index],expected))
      return {correct:grades.every((grade)=>grade.correct),minor:grades.flatMap((grade)=>grade.minor)}
    }
    if(exercise.acceptedAnswers){
      const grades=exercise.acceptedAnswers.map((expected)=>gradeFill(answer,expected))
      return grades.find((grade)=>grade.correct)??{correct:false,minor:[]}
    }
    return gradeFill(answer,exercise.answer)
  }
  if (exercise.type==='listen_dictation') return gradeDictation(answer,exercise.answer)
  if (exercise.type==='choice' || exercise.type==='listen_choice') return {correct:answer===exercise.answer,minor:[]}
  if (exercise.type==='classify') return {correct:exercise.items.every((item,index)=>answer[index]===item.group),minor:[]}
  if (exercise.type==='order') return {correct:answer.length===exercise.answer.length && answer.every((index,position)=>exercise.tokens[index]===exercise.answer[position]),minor:[]}
  throw new Error('未知语法题型。')
}
