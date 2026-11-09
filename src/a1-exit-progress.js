import { announceDataChange } from './data-events.js'

export const A1_EXIT_KEY='wort-a1-exit-v1'
export const A1_EXIT_GATES=['grammar','listening','reading','writing','speaking','vocabulary']

const record=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
export function validateA1ExitProgress(value){
  if(!record(value))throw new Error('备份校验失败：A1 出口成绩格式无效。')
  for(const [gate,entry] of Object.entries(value)){
    if(!A1_EXIT_GATES.includes(gate)||!record(entry)||!Number.isSafeInteger(entry.attempts)||entry.attempts<1||!record(entry.latest)
      ||typeof entry.latest.passed!=='boolean'||!Number.isFinite(entry.latest.score)
      ||typeof entry.latest.at!=='string'||!Number.isFinite(Date.parse(entry.latest.at)))
      throw new Error('备份校验失败：A1 出口成绩格式无效。')
  }
  return value
}
export function getA1ExitProgress(){
  if(!globalThis.localStorage)return {}
  try{return validateA1ExitProgress(JSON.parse(localStorage.getItem(A1_EXIT_KEY)||'{}'))}
  catch{return {}}
}
export function replaceA1ExitProgress(value){
  const valid=validateA1ExitProgress(value)
  if(globalThis.localStorage){localStorage.setItem(A1_EXIT_KEY,JSON.stringify(valid));announceDataChange()}
}
export function clearA1ExitProgress(){if(globalThis.localStorage){localStorage.removeItem(A1_EXIT_KEY);announceDataChange()}}
export function saveA1ExitResult(gate,result,now=new Date()){
  if(!A1_EXIT_GATES.includes(gate)||typeof result?.passed!=='boolean'||!Number.isFinite(result.score))throw new Error('A1 出口成绩无效。')
  const prior=getA1ExitProgress()
  const next={...prior,[gate]:{attempts:(prior[gate]?.attempts??0)+1,latest:{...result,at:now.toISOString()}}}
  replaceA1ExitProgress(next)
  return next[gate]
}
export function a1ExitComplete(progress){return A1_EXIT_GATES.every((gate)=>progress[gate]?.latest?.passed===true)}
