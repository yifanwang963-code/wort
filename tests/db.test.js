import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { addWord, getWords, isSameLocalDay, normalizeWord } from '../src/db.js'

const sample = { german: ' Apfel ', article: 'der', plural: 'Äpfel', chinese: '苹果', partOfSpeech: '名词', exampleDe: 'Ich esse einen Apfel.', exampleZh: '我吃一个苹果。', unit: 'Lektion 1' }

beforeEach(async () => {
  await getWords()
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('wort-daily', 3)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('words', 'readwrite')
      transaction.objectStore('words').clear()
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => reject(transaction.error)
    }
  })
})

test('empty library and all word fields persist through a fresh database module', async () => {
  assert.deepEqual(await getWords(), [])
  const saved = await addWord(sample)
  assert.ok(saved.id)
  assert.equal(typeof saved.createdAt, 'number')
  assert.equal(saved.german, 'Apfel')
  const reloaded = await import('../src/db.js?reload')
  assert.deepEqual(await reloaded.getWords(), [saved])
  for (const key of Object.keys(sample)) assert.equal(saved[key], sample[key].trim())
})

test('validation rejects blank required fields and invalid noun articles without writing', async () => {
  await assert.rejects(addWord({ ...sample, chinese: '  ' }), /请填写/)
  await assert.rejects(addWord({ ...sample, article: '' }), /冠词/)
  await assert.rejects(addWord({ ...sample, article: 'other' }), /冠词/)
  assert.deepEqual(await getWords(), [])
})

test('non-nouns do not retain stale noun fields', () => {
  assert.deepEqual(normalizeWord({ german: ' lernen ', chinese: '学习', partOfSpeech: '动词', article: 'der', plural: 'stale' }), {
    german: 'lernen', chinese: '学习', partOfSpeech: '动词', article: '', plural: '', exampleDe: '', exampleZh: '', unit: '',
  })
})

test('an aborted write reports failure and does not leave a saved word', async () => {
  const originalAdd = IDBObjectStore.prototype.add
  IDBObjectStore.prototype.add = function (...args) {
    const request = originalAdd.apply(this, args)
    this.transaction.abort()
    return request
  }
  try { await assert.rejects(addWord(sample), /保存失败/) }
  finally { IDBObjectStore.prototype.add = originalAdd }
  assert.deepEqual(await getWords(), [])
})

test('today uses local calendar boundaries, including year transitions', () => {
  const today = new Date(2026, 0, 1, 12)
  assert.equal(isSameLocalDay(new Date(2026, 0, 1, 0).getTime(), today), true)
  assert.equal(isSameLocalDay(new Date(2026, 0, 1, 23, 59).getTime(), today), true)
  assert.equal(isSameLocalDay(new Date(2025, 11, 31, 23, 59).getTime(), today), false)
  assert.equal(isSameLocalDay(new Date(2026, 0, 2, 0).getTime(), today), false)
})

