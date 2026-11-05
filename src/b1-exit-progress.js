import {B1_EXIT_GATES} from './b1-exit.js'

export const B1_EXIT_KEY='wort-b1-exit-v1'
const record=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
export function validateB1ExitProgress(value){
  if(!record(value))throw new Error('备份校验失败：B1 出口成绩格式无效。')
  for(const [gate,entry] of Object.entries(value)){
    if(['b1Completed','completedAt'].includes(gate))continue
    if(!B1_EXIT_GATES.includes(gate)||!record(entry)||!Number.isSafeInteger(entry.attempts)||entry.attempts<1||typeof entry.passedEver!=='boolean')throw new Error('备份校验失败：B1 出口成绩格式无效。')
    for(const result of [entry.latest,entry.best])if(!record(result)||typeof result.passed!=='boolean'||!Number.isFinite(result.score)||!Number.isFinite(result.total)
      ||typeof result.at!=='string'||!Number.isFinite(Date.parse(result.at)))throw new Error('备份校验失败：B1 出口成绩格式无效。')
  }
  if(value.b1Completed!==undefined&&value.b1Completed!==true)throw new Error('备份校验失败：B1 完成状态无效。')
  if(value.completedAt!==undefined&&(typeof value.completedAt!=='string'||!Number.isFinite(Date.parse(value.completedAt))))throw new Error('备份校验失败：B1 完成日期无效。')
  if(value.b1Completed&&(!B1_EXIT_GATES.every((gate)=>value[gate]?.passedEver)||!value.completedAt))throw new Error('备份校验失败：B1 完成记录不一致。')
  return value
}
export function getB1ExitProgress(){
  if(!globalThis.localStorage)return {}
  try{return validateB1ExitProgress(JSON.parse(localStorage.getItem(B1_EXIT_KEY)||'{}'))}
  catch{return {}}
}
export function replaceB1ExitProgress(value){globalThis.localStorage?.setItem(B1_EXIT_KEY,JSON.stringify(validateB1ExitProgress(value)))}
export function clearB1ExitProgress(){globalThis.localStorage?.removeItem(B1_EXIT_KEY)}
export function b1ExitComplete(progress){return B1_EXIT_GATES.every((gate)=>progress[gate]?.passedEver===true)}
export function saveB1ExitResult(gate,result,now=new Date()){
  if(!B1_EXIT_GATES.includes(gate)||typeof result?.passed!=='boolean'||!Number.isFinite(result.score)||!Number.isFinite(result.total))throw new Error('B1 出口成绩无效。')
  const prior=getB1ExitProgress()
  const latest={...result,at:now.toISOString()}
  const previousBest=prior[gate]?.best
  const best=!previousBest||result.score>previousBest.score?latest:previousBest
  const next={...prior,[gate]:{attempts:(prior[gate]?.attempts??0)+1,latest,best,passedEver:!!prior[gate]?.passedEver||result.passed}}
  if(b1ExitComplete(next)&&!next.b1Completed){next.b1Completed=true;next.completedAt=now.toISOString()}
  replaceB1ExitProgress(next)
  return next[gate]
}
