import { dayKey } from './learning.js'
import { wordKey } from './word-model.js'

export const DEFAULT_STUDY_OPTIONS = { newOrder: 'sequential', reviewOrder: 'due', autoSpeak: false, speechRate: 1, voiceURI: 'auto' }

export function chooseNewWords(words, limit, keys = null, order = 'sequential', random = Math.random) {
  const indexed = keys ? new Map(keys.map((key, index) => [key,index])) : null
  const pool = words.filter((word) => (word.status ?? '未学') === '未学' && (!indexed || indexed.has(wordKey(word))))
  pool.sort((a,b) => indexed
    ? indexed.get(wordKey(a)) - indexed.get(wordKey(b)) || a.importOrder - b.importOrder
    : (a.importOrder ?? a.createdAt) - (b.importOrder ?? b.createdAt) || a.id.localeCompare(b.id))
  if (order === 'random') {
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1))
      ;[pool[index],pool[other]] = [pool[other],pool[index]]
    }
  }
  return pool.slice(0,Math.max(0,Math.floor(Number(limit)||0)))
}

export function orderReviews(queue, order = 'due', random = Math.random) {
  if (order !== 'random') return queue
  const groups = new Map()
  for (const word of queue) {
    const date = dayKey(new Date(word.dueAt))
    if (!groups.has(date)) groups.set(date,[])
    groups.get(date).push(word)
  }
  return [...groups.values()].flatMap((group)=>{
    const shuffled = [...group]
    for (let index=shuffled.length-1;index>0;index--) {
      const other = Math.floor(random()*(index+1))
      ;[shuffled[index],shuffled[other]]=[shuffled[other],shuffled[index]]
    }
    return shuffled
  })
}
