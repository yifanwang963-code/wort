import data from './data/b1Exit.json' with {type:'json'}
import {gradeExercise,gradeFill} from './grammar.js'
import {gradeA1Choices} from './a1-exit.js'
import {splitSentences} from './grammar-audio.js'

export const b1ExitData=data
export const B1_EXIT_GATES=['grammar','listening','reading','writing','speaking','vocabulary']
export const B1_EXIT_LABELS={grammar:'语法总测',listening:'听力',reading:'阅读',writing:'写作',speaking:'口语',vocabulary:'词汇关'}
export const B1_EXIT_PASS_LINES={grammar:'总分 ≥32/40，四组各 ≥7/10',listening:'至少 9 / 14',reading:'至少 8 / 12',writing:'两篇要点全覆盖且自查全勾',speaking:'三部分均至少「达成」',vocabulary:'核心输出 ≥102/120，认读 ≥108/120'}
export const B1_GRAMMAR_GROUPS=['被动与时态综合','虚拟式','连接与逻辑','形式准确']
export const B1_GRAMMAR_REVIEW={
  被动与时态综合:['g-b1-01','g-b1-02','g-b1-03'],
  虚拟式:['g-b1-04','g-b1-05','g-b1-06','t-b1-06'],
  连接与逻辑:['g-b1-07','g-b1-08','g-b1-09','g-b1-10','g-b1-11','g-b1-12'],
  形式准确:['g-a2-04','g-a2-05','g-b1-11','g-b1-12','g-b1-13','g-b1-14','g-b1-15'],
}
export function b1ListeningSegments(text){
  return text.split('\n').flatMap((line)=>line.length>180?splitSentences(line):[line]).map((line)=>line.trim()).filter(Boolean)
}

function shuffle(values,random=Math.random){
  const out=[...values]
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out
}

export function createB1GrammarTest(random=Math.random){
  return B1_GRAMMAR_GROUPS.flatMap((group)=>{
    const pool=data.grammar.filter((question)=>question.group===group)
    if(pool.length!==15)throw new Error('B1 语法题库不完整。')
    return shuffle(pool,random).slice(0,10)
  })
}
export function gradeB1Grammar(test,answers){
  if(test.length!==40||answers.length!==40||Array.from(answers).some((answer)=>answer===undefined))throw new Error('请完成全部 40 题。')
  const groupScores=Object.fromEntries(B1_GRAMMAR_GROUPS.map((group)=>[group,0]))
  test.forEach((question,index)=>{if(gradeExercise(question,answers[index]).correct)groupScores[question.group]++})
  const score=Object.values(groupScores).reduce((sum,value)=>sum+value,0)
  return {score,total:40,groupScores,passed:score>=32&&B1_GRAMMAR_GROUPS.every((group)=>groupScores[group]>=7)}
}
export function gradeB1Choices(gate,answers){
  if(gate==='listening')return gradeA1Choices(data.listening,answers,9)
  if(gate==='reading')return gradeA1Choices(data.reading,answers,8)
  throw new Error('未知测评项目。')
}
export function gradeB1Writing(values,checks){
  const ready=Array.isArray(values)&&values.length===2&&values.every((value)=>typeof value==='string'&&value.trim())
    &&Array.isArray(checks)&&checks.length===2&&checks.every((part,index)=>Array.isArray(part)&&part.length===data.writing[index].checks.length&&part.every(Boolean))
  return {score:ready?2:0,total:2,passed:!!ready}
}
export function gradeB1Speaking(ratings){
  if(!Array.isArray(ratings)||ratings.length!==3||ratings.some((rating)=>!['未达成','达成','出色'].includes(rating)))throw new Error('请先为三个部分评档。')
  const score=ratings.filter((rating)=>rating!=='未达成').length
  return {score,total:3,passed:score===3}
}
export function createB1VocabularyTest(words,random=Math.random){
  const core=words.filter((word)=>word.layer==='核心主动')
  const recognition=words.filter((word)=>word.layer==='被动认读'||word.layer==='扩展认读')
  if(core.length!==1070||recognition.length!==670)throw new Error('B1 分层词书不完整。')
  return {
    core:shuffle(core,random).slice(0,120),
    recognition:shuffle(recognition,random).slice(0,120).map((word)=>{
      const distractors=shuffle(recognition.filter((item)=>item.chinese!==word.chinese),random)
      const options=shuffle([word.chinese,...new Set(distractors.map((item)=>item.chinese))].slice(0,4),random)
      return {word,options,answer:options.indexOf(word.chinese)}
    }),
  }
}
export function gradeB1Vocabulary(test,coreAnswers,recognitionAnswers){
  if(coreAnswers.length!==120||recognitionAnswers.length!==120||coreAnswers.some((answer)=>typeof answer!=='string'||!answer.trim())||recognitionAnswers.some((answer)=>!Number.isInteger(answer)))throw new Error('请完成两组各 120 题。')
  const coreScore=test.core.filter((word,index)=>gradeFill(coreAnswers[index],[word.article,word.german].filter(Boolean).join(' ')).correct).length
  const recognitionScore=test.recognition.filter((question,index)=>question.answer===recognitionAnswers[index]).length
  return {score:coreScore+recognitionScore,total:240,coreScore,recognitionScore,passed:coreScore>=102&&recognitionScore>=108}
}
