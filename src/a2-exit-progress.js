import { announceDataChange } from './data-events.js'

import {A2_EXIT_GATES} from './a2-exit.js'

export const A2_EXIT_KEY='wort-a2-exit-v1'
const record=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
export function validateA2ExitProgress(value){
  if(!record(value))throw new Error('备份校验失败：A2 出口成绩格式无效。')
  for(const [gate,entry] of Object.entries(value)){
    if(!A2_EXIT_GATES.includes(gate)||!record(entry)||!Number.isSafeInteger(entry.attempts)||entry.attempts<1||typeof entry.passedEver!=='boolean')
      throw new Error('备份校验失败：A2 出口成绩格式无效。')
    for(const result of [entry.latest,entry.best])if(!record(result)||typeof result.passed!=='boolean'||!Number.isFinite(result.score)
      ||typeof result.at!=='string'||!Number.isFinite(Date.parse(result.at)))throw new Error('备份校验失败：A2 出口成绩格式无效。')
  }
  return value
}
export function getA2ExitProgress(){
  if(!globalThis.localStorage)return {}
  try{return validateA2ExitProgress(JSON.parse(localStorage.getItem(A2_EXIT_KEY)||'{}'))}
  catch{return {}}
}
export function replaceA2ExitProgress(value){
  if(globalThis.localStorage){localStorage.setItem(A2_EXIT_KEY,JSON.stringify(validateA2ExitProgress(value)));announceDataChange()}
}
export function clearA2ExitProgress(){if(globalThis.localStorage){localStorage.removeItem(A2_EXIT_KEY);announceDataChange()}}
export function saveA2ExitResult(gate,result,now=new Date()){
  if(!A2_EXIT_GATES.includes(gate)||typeof result?.passed!=='boolean'||!Number.isFinite(result.score))throw new Error('A2 出口成绩无效。')
  const prior=getA2ExitProgress()
  const latest={...result,at:now.toISOString()}
  const previousBest=prior[gate]?.best
  const best=!previousBest||result.score>previousBest.score?latest:previousBest
  const next={...prior,[gate]:{attempts:(prior[gate]?.attempts??0)+1,latest,best,passedEver:!!prior[gate]?.passedEver||result.passed}}
  replaceA2ExitProgress(next)
  return next[gate]
}
export function a2ExitComplete(progress){return A2_EXIT_GATES.every((gate)=>progress[gate]?.passedEver===true)}
