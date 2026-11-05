import data from './data/a1Exit.json' with {type:'json'}
import {gradeExercise,gradeFill} from './grammar.js'

export const a1ExitData=data
export const A1_EXIT_LABELS={grammar:'语法总测',listening:'听力测',reading:'阅读测',writing:'写作测',speaking:'口语测',vocabulary:'词汇关'}
export const A1_EXIT_PASS_LINES={grammar:'总分 ≥ 80%，格体系与时态组各 ≥ 75%',listening:'≥ 60%（至少 6 / 10）',reading:'≥ 60%（至少 5 / 8）',writing:'两部分完成且自查表全勾',speaking:'三部分均为「达成」',vocabulary:'核心产出 ≥ 85%，认读 ≥ 90%'}

export function gradeA1Grammar(answers){
  if(!Array.isArray(answers)||answers.length!==30)throw new Error('请完成全部 30 题。')
  const marks=data.grammar.map((exercise,index)=>gradeExercise(exercise,answers[index]).correct)
  const score=marks.filter(Boolean).length
  const caseScore=marks.slice(11,20).filter(Boolean).length
  const tenseScore=marks.slice(5,9).filter(Boolean).length
  return {score,total:30,caseScore,tenseScore,passed:score>=24&&caseScore>=7&&tenseScore>=3}
}
export function gradeA1Choices(parts,answers,required){
  const questions=parts.flatMap((part)=>part.clips?part.clips.flatMap((clip)=>clip.questions):part.questions)
  if(!Array.isArray(answers)||answers.length!==questions.length||answers.some((answer)=>!Number.isInteger(answer)))throw new Error('请完成全部题目。')
  const score=questions.filter((question,index)=>question.answer===answers[index]).length
  return {score,total:questions.length,passed:score>=required}
}
export function gradeA1Writing(values,checks){
  const ready=Array.isArray(values)&&values.length===2&&values.every((value)=>typeof value==='string'&&value.trim())
    &&Array.isArray(checks)&&checks.length===2&&checks.every((part)=>Array.isArray(part)&&part.length===4&&part.every(Boolean))
  return {score:ready?2:0,total:2,passed:!!ready}
}
export function gradeA1Speaking(ratings){
  const ready=Array.isArray(ratings)&&ratings.length===3&&ratings.every((rating)=>['达成','勉强','未达成'].includes(rating))
  if(!ready)throw new Error('请先为三个部分评档。')
  const score=ratings.filter((rating)=>rating==='达成').length
  return {score,total:3,passed:score===3}
}
function shuffle(values,random=Math.random){
  const out=[...values]
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out
}
export function createLayeredVocabularyTest(words,expectedCore,expectedRecognition,random=Math.random,label='分层'){
  const core=words.filter((word)=>word.layer==='核心主动')
  const recognition=words.filter((word)=>word.layer==='被动认读'||word.layer==='扩展认读')
  if(core.length!==expectedCore||recognition.length!==expectedRecognition)throw new Error(`${label}词书不完整。`)
  const coreQuestions=shuffle(core,random).slice(0,100)
  const recognitionQuestions=shuffle(recognition,random).slice(0,100).map((word)=>{
    const distractors=shuffle(recognition.filter((item)=>item.chinese!==word.chinese),random)
    const options=shuffle([word.chinese,...new Set(distractors.map((item)=>item.chinese))].slice(0,4),random)
    return {word,options,answer:options.indexOf(word.chinese)}
  })
  return {core:coreQuestions,recognition:recognitionQuestions}
}
export function createA1VocabularyTest(words,random=Math.random){
  return createLayeredVocabularyTest(words,340,405,random,'A1 分层')
}
export function gradeA1Vocabulary(test,coreAnswers,recognitionAnswers){
  if(coreAnswers.length!==100||recognitionAnswers.length!==100||coreAnswers.some((answer)=>typeof answer!=='string'||!answer.trim())||recognitionAnswers.some((answer)=>!Number.isInteger(answer)))throw new Error('请完成两组各 100 题。')
  const coreScore=test.core.filter((word,index)=>gradeFill(coreAnswers[index],[word.article,word.german].filter(Boolean).join(' ')).correct).length
  const recognitionScore=test.recognition.filter((question,index)=>question.answer===recognitionAnswers[index]).length
  return {score:coreScore+recognitionScore,total:200,coreScore,recognitionScore,passed:coreScore>=85&&recognitionScore>=90}
}
