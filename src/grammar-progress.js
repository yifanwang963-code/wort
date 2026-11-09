import { announceDataChange } from './data-events.js'

export const GRAMMAR_KEY = 'wort-grammar-v1'

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }

export function validateGrammarProgress(value) {
  if (!isRecord(value)) throw new Error('备份校验失败：语法进度格式无效。')
  for (const [id, record] of Object.entries(value)) {
    if (!id || !isRecord(record) || typeof record.done !== 'boolean'
      || !Number.isSafeInteger(record.bestScore) || record.bestScore < 0
      || !Number.isSafeInteger(record.attempts) || record.attempts < 0) {
      throw new Error('备份校验失败：语法进度格式无效。')
    }
  }
  return value
}

export function getGrammarProgress() {
  if (!globalThis.localStorage) return {}
  try {
    const progress=validateGrammarProgress(JSON.parse(localStorage.getItem(GRAMMAR_KEY) || '{}'))
    if(progress['g-a1-00']?.done && !progress['g-a1-p1']) {
      progress['g-a1-p1']={...progress['g-a1-00']}
      localStorage.setItem(GRAMMAR_KEY,JSON.stringify(progress))
      announceDataChange()
    }
    return progress
  }
  catch { return {} }
}

export function replaceGrammarProgress(progress) {
  const valid = validateGrammarProgress(progress)
  if (globalThis.localStorage) { localStorage.setItem(GRAMMAR_KEY, JSON.stringify(valid)); announceDataChange() }
}

export function clearGrammarProgress() {
  if(globalThis.localStorage){localStorage.removeItem(GRAMMAR_KEY);announceDataChange()}
}

export function saveGrammarResult(unitId, score) {
  const progress = getGrammarProgress()
  const previous = progress[unitId] ?? {done:false,bestScore:0,attempts:0}
  const next = {...progress,[unitId]:{done:true,bestScore:Math.max(previous.bestScore,score),attempts:previous.attempts+1}}
  replaceGrammarProgress(next)
  return next[unitId]
}
