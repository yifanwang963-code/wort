import { dueInDays, dayKey } from './learning.js'
import { isVacationDay, redistributeVacation } from './continuity.js'

export function reviewForecast(words, now = new Date(), vacation = null) {
  const shifted = vacation ? redistributeVacation(words, vacation.start, vacation.end) : new Map()
  return Array.from({ length: 7 }, (_, index) => {
    const from = dueInDays(index + 1, now), until = dueInDays(index + 2, now)
    const count = words.filter((word) => {
      const dueAt = shifted.get(word.id)?.dueAt ?? word.dueAt
      return word.status === '学习中' && Number.isFinite(dueAt) && dueAt >= from && dueAt < until
    }).length
    return { date: new Date(from), count, level: count > 80 ? 'red' : count > 50 ? 'yellow' : 'normal' }
  })
}

export function currentStreak(days, now = new Date(), vacationHistory = [], activeVacation = null) {
  const seen = new Set(days)
  const frozen = (date) => vacationHistory.some((period)=>isVacationDay(period,date)) || isVacationDay(activeVacation,date)
  let offset = seen.has(dayKey(now)) || frozen(now) ? 0 : 1
  let count = 0
  for (;;) {
    const date = new Date(dueInDays(-offset, now))
    if (frozen(date)) { offset++; continue }
    if (!seen.has(dayKey(date))) break
    count++; offset++
  }
  return count
}

export function levelOverview(words, level = 'all', outputPassedIds = []) {
  const selected = words.filter((word) => level === 'all' || (level === 'ungraded' ? !word.level : word.level === level))
  const total = selected.length
  const passed = new Set(outputPassedIds)
  const effectiveStatus=(word)=>word.status==='已掌握'&&word.layer==='核心主动'&&!passed.has(word.id)?'学习中':word.status
  return ['未学','学习中','已掌握'].map((status) => {
    const count = selected.filter((word) => effectiveStatus(word) === status).length
    return { status, count, percent: total ? Math.round(count / total * 100) : 0 }
  })
}
