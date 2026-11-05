import {B2_EXIT_GATES} from './b2-exit.js'

export const B2_EXIT_KEY='wort-b2-exit-v1'
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
export function validateB2ExitProgress(value){
  if(!record(value))throw new Error('备份校验失败：B2 出口成绩格式无效。')
  if(value.attempts!==undefined&&!Array.isArray(value.attempts))throw new Error('备份校验失败：B2 尝试记录无效。')
  for(const attempt of value.attempts??[]){
    if(!record(attempt)||!B2_EXIT_GATES.includes(attempt.gate)||!record(attempt.result)||typeof attempt.result.passed!=='boolean'||!Number.isFinite(attempt.result.score)||!Number.isFinite(attempt.result.total)||!Number.isFinite(Date.parse(attempt.at)))throw new Error('备份校验失败：B2 尝试记录无效。')
  }
  for(const gate of B2_EXIT_GATES)if(value[gate]!==undefined){
    const result=value[gate]
    if(!record(result)||typeof result.passed!=='boolean'||typeof result.passedEver!=='boolean'||!Number.isFinite(result.score)||!Number.isFinite(result.total)||!Number.isFinite(Date.parse(result.at)))throw new Error('备份校验失败：B2 出口成绩格式无效。')
  }
  if(value.overallPass!==undefined&&typeof value.overallPass!=='boolean')throw new Error('备份校验失败：B2 完成状态无效。')
  if(value.lastAttemptAt!==undefined&&!Number.isFinite(Date.parse(value.lastAttemptAt)))throw new Error('备份校验失败：B2 完成日期无效。')
  return value
}
export function getB2ExitProgress(){
  if(!globalThis.localStorage)return {}
  try{return validateB2ExitProgress(JSON.parse(localStorage.getItem(B2_EXIT_KEY)||'{}'))}catch{return {}}
}
export function replaceB2ExitProgress(value){globalThis.localStorage?.setItem(B2_EXIT_KEY,JSON.stringify(validateB2ExitProgress(value)))}
export function clearB2ExitProgress(){globalThis.localStorage?.removeItem(B2_EXIT_KEY)}
export function b2ExitComplete(progress){return B2_EXIT_GATES.every(gate=>progress[gate]?.passedEver===true)}
export function saveB2ExitResult(gate,result,now=new Date()){
  if(!B2_EXIT_GATES.includes(gate)||typeof result?.passed!=='boolean'||!Number.isFinite(result.score)||!Number.isFinite(result.total))throw new Error('B2 出口成绩无效。')
  const prior=getB2ExitProgress(),at=now.toISOString()
  const latest={...result,pass:result.passed,at,passedEver:!!prior[gate]?.passedEver||result.passed}
  const next={...prior,[gate]:latest,attempts:[...(prior.attempts??[]),{gate,result,at}],lastAttemptAt:at}
  next.overallPass=b2ExitComplete(next)
  replaceB2ExitProgress(next)
  return latest
}
