export const EMPTY_PROGRESS = { dueAt: null, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 }
const STEPS = [1, 3, 7, 14, 30, 60]

export function dayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function dueInDays(days, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days).getTime()
}

export function reviewQueue(words, now = new Date()) {
  return words.filter((word) => word.status === '学习中' && Number.isFinite(word.dueAt) && word.dueAt <= now.getTime())
    .sort((a, b) => a.dueAt - b.dueAt || a.importOrder - b.importOrder || a.id.localeCompare(b.id))
}

export function todayReviewCount(words, now = new Date()) {
  return words.filter((word) => word.status === '学习中' && Number.isFinite(word.dueAt) && word.dueAt < dueInDays(1, now)).length
}

export function initialLearnedProgress(now = new Date()) {
  return { status: '学习中', dueAt: dueInDays(1, now), intervalDays: 1, ease: 2.5, reps: 0, lapses: 0 }
}

export function reviewProgress(word, rating, now = new Date()) {
  let { intervalDays = 1, ease = 2.5, reps = 0, lapses = 0 } = word
  if (rating === 'forgot') {
    intervalDays = 1; reps = 0; lapses += 1; ease = Math.max(1.3, Math.round((ease - 0.2) * 100) / 100)
  } else if (rating === 'hard') {
    intervalDays = Math.max(1, Math.round(intervalDays * 1.5))
    ease = Math.round((ease - 0.1) * 100) / 100
  } else if (rating === 'remember') {
    intervalDays = reps < STEPS.length ? STEPS[reps] : Math.max(1, Math.round(intervalDays * 1.8))
    reps += 1
  } else throw new Error('无效的复习评分。')
  return { intervalDays, ease, reps, lapses, dueAt: dueInDays(intervalDays, now), status: reps >= 6 && intervalDays >= 60 ? '已掌握' : '学习中' }
}

export function advanceSession(session, repeat) {
  const queue = [...session.queue]
  const entry = queue[session.index]
  if (repeat && !entry.repeat) queue.push({ id: entry.id, repeat: true })
  return { ...session, queue, index: session.index + 1, version: session.version + 1 }
}
