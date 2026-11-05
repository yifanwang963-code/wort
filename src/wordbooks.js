import { wordKey } from './word-model.js'

export const WORD_BOOKS = [
  { id: 'builtin:goethe-a1', name: '歌德 A1 词库', level: 'A1', count: 745, file: 'goethe-a1.json' },
  { id: 'builtin:goethe-a2', name: '歌德 A2 词库', level: 'A2', count: 556, file: 'goethe-a2.json' },
  { id: 'builtin:goethe-b1', name: '歌德 B1 词库', level: 'B1', count: 1740, file: 'goethe-b1.json' },
  { id: 'builtin:b2', name: 'B2 分层词书', level: 'B2', count: 2016, file: 'b2.json' },
]

export function bookById(id) { return WORD_BOOKS.find((book) => book.id === id) ?? null }
export function nextBook(id) { return WORD_BOOKS[WORD_BOOKS.findIndex((book) => book.id === id) + 1] ?? null }
export function bookWords(words, keys) {
  const included = new Set(keys ?? [])
  return words.filter((word) => included.has(wordKey(word)))
}
export function bookProgress(words, pack) {
  if (!pack) return { imported: 0, learned: 0, total: 0, percent: 0 }
  const keys = new Set(pack.words.map(wordKey))
  const members = bookWords(words, keys)
  const learned = members.filter((word) => word.status === '学习中' || word.status === '已掌握').length
  return { imported: members.length, learned, total: keys.size, percent: keys.size ? Math.round(learned / keys.size * 100) : 0 }
}
