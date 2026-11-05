import { dayKey, dueInDays } from './learning.js'

export const LEVELS = ['A1','A2','B1','B2','C1','C2']
export function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return dayKey(date) === value ? date : null
}
export function isVacationDay(vacation, now = new Date()) {
  const key = dayKey(now)
  return !!vacation && vacation.start <= key && key <= vacation.end
}
export function vacationContains(vacation, timestamp) {
  return !!vacation && Number.isFinite(timestamp) && vacation.start <= dayKey(new Date(timestamp)) && dayKey(new Date(timestamp)) <= vacation.end
}
export function redistributeVacation(words, start, end) {
  const period = {start,end}
  const selected = words.filter((word) => word.status === '学习中' && vacationContains(period,word.dueAt))
    .sort((a,b)=>a.dueAt-b.dueAt || a.importOrder-b.importOrder || a.id.localeCompare(b.id))
  const changes = new Map()
  selected.forEach((word,index)=>changes.set(word.id,{...word,dueAt:dueInDays(1 + Math.floor(index * 3 / selected.length),parseLocalDate(end))}))
  return changes
}
export function levelPrompt(words) {
  const levels = LEVELS.filter((level)=>words.some((word)=>word.level===level))
  const current = levels.find((level)=>words.some((word)=>word.level===level && word.status==='未学')) ?? levels.at(-1)
  const next = LEVELS[LEVELS.indexOf(current)+1]
  if (!current || !next) return null
  const remaining = words.filter((word)=>word.level===current && word.status==='未学').length
  return remaining < 50 ? {current,next,remaining} : null
}
export function backupReminderDue(lastExportAt, baselineAt, dismissedAt, now = new Date()) {
  const week = 7 * 86400000
  const since = lastExportAt ?? baselineAt
  return Number.isFinite(since) && now.getTime()-since > week && (!Number.isFinite(dismissedAt) || now.getTime()-dismissedAt > week)
}
