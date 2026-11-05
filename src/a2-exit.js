import data from './data/a2Exit.json' with {type:'json'}
import {gradeA1Choices,gradeA1Vocabulary,createLayeredVocabularyTest} from './a1-exit.js'

export const a2ExitData=data
export const A2_EXIT_GATES=['grammar','listening','reading','writing','speaking','vocabulary']
export const A2_EXIT_LABELS={grammar:'语法总测',listening:'听力测',reading:'阅读测',writing:'写作测',speaking:'口语测',vocabulary:'词汇关'}
export const A2_EXIT_PASS_LINES={grammar:'总分 ≥29/36，时态、从句、词尾各 ≥7/9',listening:'至少 8 / 12',reading:'至少 6 / 10',writing:'两篇自查清单全部勾选',speaking:'三部分均为「达成」',vocabulary:'核心产出 ≥85/100，认读 ≥90/100'}

function shuffle(values,random=Math.random){
  const out=[...values]
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out
}

export function createA2GrammarTest(random=Math.random){
  const questions=[]
  for(const group of ['时态组','从句组','词尾组','综合组']){
    const pool=data.grammar.filter((question)=>question.group===group)
    if(pool.length!==12)throw new Error('A2 语法题库不完整。')
    questions.push(...shuffle(pool,random).slice(0,9))
  }
  return questions
}

export function gradeA2Grammar(test,answers){
  if(test.length!==36||answers.length!==36||answers.some((answer)=>!Number.isInteger(answer)))throw new Error('请完成全部 36 题。')
  const scores={时态组:0,从句组:0,词尾组:0,综合组:0}
  test.forEach((question,index)=>{if(question.answer===answers[index])scores[question.group]++})
  const score=Object.values(scores).reduce((sum,count)=>sum+count,0)
  return {score,total:36,groupScores:scores,passed:score>=29&&['时态组','从句组','词尾组'].every((group)=>scores[group]>=7)}
}
export function gradeA2Choices(gate,answers){
  if(gate==='listening')return gradeA1Choices(data.listening,answers,8)
  if(gate==='reading')return gradeA1Choices(data.reading,answers,6)
  throw new Error('未知测评项目。')
}
export function gradeA2Writing(values,checks){
  const ready=Array.isArray(values)&&values.length===2&&values.every((value)=>typeof value==='string'&&value.trim())
    &&Array.isArray(checks)&&checks.length===2&&checks.every((part,index)=>Array.isArray(part)&&part.length===data.writing[index].checks.length&&part.every(Boolean))
  return {score:ready?2:0,total:2,passed:!!ready}
}
export function gradeA2Speaking(ratings){
  if(!Array.isArray(ratings)||ratings.length!==3||ratings.some((rating)=>!['达成','基本达成','未达成'].includes(rating)))throw new Error('请先为三个部分评档。')
  const score=ratings.filter((rating)=>rating==='达成').length
  return {score,total:3,passed:score===3}
}
export function createA2VocabularyTest(words,random=Math.random){
  return createLayeredVocabularyTest(words,355,201,random,'A2 分层')
}
export const gradeA2Vocabulary=gradeA1Vocabulary
