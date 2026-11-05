import data from './data/b2Exit.json' with {type:'json'}
import {gradeExercise,gradeFill} from './grammar.js'
import {gradeA1Choices} from './a1-exit.js'
import {splitSentences} from './grammar-audio.js'

export const b2ExitData=data
export const B2_EXIT_GATES=['grammar','listening','reading','writing','speaking','vocab']
export const B2_EXIT_LABELS={grammar:'语法总测',listening:'听力',reading:'阅读',writing:'写作',speaking:'口语',vocab:'词汇关'}
export const B2_EXIT_PASS_LINES={grammar:'内部项 · 总分 ≥38/48，四组各 ≥8/12',listening:'至少 8 / 12',reading:'至少 10 / 15',writing:'自评 · 双题要点与自查全完成',speaking:'自评 · 两部分均为「达成」',vocab:'内部项 · 核心输出 ≥128/150，认读 ≥135/150'}
export const B2_GRAMMAR_GROUPS=['A','B','C','D']
export function b2ListeningSegments(text){return text.split('\n').flatMap(line=>line.length>180?splitSentences(line):[line]).map(line=>line.trim()).filter(Boolean)}
function shuffle(values,random=Math.random){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
export function createB2GrammarTest(random=Math.random,previousIds=[]){
  const previous=new Set(previousIds)
  return B2_GRAMMAR_GROUPS.flatMap(group=>{
    const pool=data.grammar.filter(question=>question.group===group)
    if(pool.length!==18)throw new Error('B2 语法题库不完整。')
    const fresh=shuffle(pool.filter(question=>!previous.has(question.number)),random)
    const prior=shuffle(pool.filter(question=>previous.has(question.number)),random)
    return [...fresh,...prior].slice(0,12)
  })
}
export function gradeB2Grammar(test,answers){
  if(test.length!==48||answers.length!==48||Array.from(answers).some(answer=>answer===undefined))throw new Error('请完成全部 48 题。')
  const perGroup=Object.fromEntries(B2_GRAMMAR_GROUPS.map(group=>[group,0]))
  test.forEach((question,index)=>{if(gradeExercise(question,answers[index]).correct)perGroup[question.group]++})
  const score=Object.values(perGroup).reduce((sum,value)=>sum+value,0)
  return {score,total:48,perGroup,questionIds:test.map(question=>question.number),passed:score>=38&&B2_GRAMMAR_GROUPS.every(group=>perGroup[group]>=8)}
}
export function gradeB2Choices(gate,answers){
  if(gate==='listening')return gradeA1Choices(data.listening,answers,8)
  if(gate==='reading')return gradeA1Choices(data.reading,answers,10)
  throw new Error('未知测评项目。')
}
export function gradeB2Writing(values,checks,ratings=[]){
  const ready=Array.isArray(values)&&values.length===2&&values.every(value=>typeof value==='string'&&value.trim())
    &&Array.isArray(checks)&&checks.length===2&&checks.every((part,index)=>Array.isArray(part)&&part.length===data.writing[index].checks.length&&part.every(Boolean))
  return {score:ready?2:0,total:2,w1:{pointsCovered:!!ready,checklist:checks?.[0]??[],tier:ratings[0]??''},w2:{pointsCovered:!!ready,checklist:checks?.[1]??[],tier:ratings[1]??''},passed:!!ready}
}
export function gradeB2Speaking(ratings,checks){
  if(!Array.isArray(ratings)||ratings.length!==2||ratings.some(rating=>!['达成','基本达成','未达成'].includes(rating)))throw new Error('请先为两个部分评档。')
  const score=ratings.filter(rating=>rating==='达成').length
  return {score,total:2,s1:{tier:ratings[0],checklist:checks?.[0]??[]},s2:{tier:ratings[1],checklist:checks?.[1]??[]},passed:score===2}
}
export function createB2VocabularyTest(words,random=Math.random){
  const core=words.filter(word=>word.layer==='核心主动')
  const recognition=words.filter(word=>word.layer==='被动认读'||word.layer==='扩展认读')
  if(core.length!==664||recognition.length!==1352)throw new Error('B2 分层词书不完整。')
  return {core:shuffle(core,random).slice(0,150),recognition:shuffle(recognition,random).slice(0,150).map(word=>{
    const distractors=shuffle(recognition.filter(item=>item.chinese!==word.chinese),random)
    const options=shuffle([word.chinese,...new Set(distractors.map(item=>item.chinese))].slice(0,4),random)
    return {word,options,answer:options.indexOf(word.chinese)}
  })}
}
export function gradeB2Output(word,answer){
  const expected=[word.article,word.german].filter(Boolean).join(' ')
  if(gradeFill(answer.trim(),expected).correct)return 1
  if(word.article&&gradeFill(answer.trim().replace(/^(?:der|die|das)\s+/u,''),word.german).correct)return 0.5
  return 0
}
export function gradeB2Vocabulary(test,coreAnswers,recognitionAnswers){
  if(coreAnswers.length!==150||recognitionAnswers.length!==150||coreAnswers.some(answer=>typeof answer!=='string'||!answer.trim())||recognitionAnswers.some(answer=>!Number.isInteger(answer)))throw new Error('请完成两组各 150 题。')
  const output= test.core.reduce((sum,word,index)=>sum+gradeB2Output(word,coreAnswers[index]),0)
  const reading=test.recognition.filter((question,index)=>question.answer===recognitionAnswers[index]).length
  return {score:output+reading,total:300,output,reading,passed:output>=128&&reading>=135}
}
