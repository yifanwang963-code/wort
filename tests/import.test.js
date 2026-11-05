import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { parseCsv, parseImportFile, previewImport, parseWordPack } from '../src/import.js'
import { getWords, importWords, getDailyLimit, setDailyLimit, getPacks, savePack } from '../src/db.js'
import { selectDailyWords, wordKey } from '../src/word-model.js'

const noun = { german: 'Apfel', article: 'der', plural: 'Äpfel', chinese: '苹果', partOfSpeech: '名词', exampleDe: 'Ein Apfel.', exampleZh: '一个苹果。', unit: '1', level: 'A1' }
const rows = (values) => values.map((value, i) => ({ row: i + 1, value }))
beforeEach(async () => {
  await getWords()
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('wort-daily', 3)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(['words', 'packs', 'settings'], 'readwrite')
      for (const name of ['words', 'packs', 'settings']) tx.objectStore(name).clear()
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => reject(tx.error)
    }
  })
})

test('CSV handles BOM, CRLF, multiline, comma and escaped quotes with physical row numbers', () => {
  const parsed = parseCsv('\uFEFFgerman,article,chinese,partOfSpeech,exampleDe\r\nApfel,der,"苹果,水果",名词,"Er sagt: ""Hallo"".\r\nEin Apfel."\r\n\r\nlernen,,学习,动词,\r\n')
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].row, 2)
  assert.equal(parsed[1].row, 5)
  assert.equal(parsed[0].value.exampleDe, 'Er sagt: "Hallo".\nEin Apfel.')
  assert.equal(parsed[0].value.chinese, '苹果,水果')
  assert.equal(previewImport(parsed, []).ready, 2)
})

test('CSV and JSON report malformed files and row errors without silently coercing fields', () => {
  assert.throws(() => parseCsv('german,german,chinese,partOfSpeech\na,b,c,d'), /重复列名/)
  assert.throws(() => parseImportFile('{', 'words.json'), /JSON 格式错误/)
  assert.throws(() => parseImportFile('{}', 'words.json'), /words 数组/)
  assert.throws(() => parseImportFile('', 'words.txt'), /csv/)
  const csv = parseCsv('german,chinese,partOfSpeech\nlernen,学习\n"unclosed,学习,动词')
  assert.equal(previewImport(csv, []).errors, 2)
  assert.equal(previewImport(parseCsv('german,chinese,partOfSpeech\n,,\n\n'), []).errors, 1)
  const preview = previewImport(rows([null, { ...noun, chinese: 1 }, { ...noun, article: '' }, { ...noun, partOfSpeech: 'noun' }]), [])
  assert.equal(preview.errors, 4)
  assert.match(preview.entries[0].reason, /对象/)
  assert.match(preview.entries[1].reason, /字符串/)
})

test('preview separates existing and within-file duplicates and never writes before confirmation', async () => {
  const preview = previewImport(rows([noun, { ...noun, german: ' Apfel ' }, { ...noun, german: 'Buch', article: 'das' }, { ...noun, chinese: '' }]), [noun])
  assert.deepEqual([preview.total, preview.ready, preview.duplicates, preview.errors], [4, 1, 2, 1])
  assert.equal(previewImport(rows([noun, noun]), []).duplicates, 1)
  assert.deepEqual(await getWords(), [])
  assert.notEqual(wordKey({german:'Band',article:'der'}), wordKey({german:'Band',article:'das'}))
  assert.notEqual(wordKey({german:'Sie',article:''}), wordKey({german:'sie',article:''}))
})

test('concurrent imports recheck duplicates atomically; existing words and status are unchanged', async () => {
  const [first, second] = await Promise.all([importWords(rows([noun, noun])), importWords(rows([noun]))])
  assert.equal(first.added + second.added, 1)
  assert.equal(first.skipped + second.skipped, 2)
  const saved = (await getWords())[0]
  assert.equal(saved.status, '未学')
  assert.equal(saved.level, 'A1')
  const third = await importWords(rows([{ ...noun, chinese: '覆盖内容', status: '已掌握' }]))
  assert.equal(third.skipped, 1)
  assert.deepEqual((await getWords())[0], saved)
})

test('imports preserve input order across batches regardless of same timestamp and ignore supplied status/ids', async () => {
  const values = ['eins','zwei','drei'].map((german) => ({german, chinese:german, partOfSpeech:'数词', status:'已掌握', id:'external'}))
  await importWords(rows(values))
  await importWords(rows([{german:'vier',chinese:'四',partOfSpeech:'数词'}]))
  const saved = await getWords()
  assert.ok(saved.every((word) => word.status === '未学' && word.id !== 'external'))
  assert.deepEqual(selectDailyWords(saved, 2).map((word) => word.german), ['eins','zwei'])
  assert.deepEqual(selectDailyWords(saved.map((word) => ({...word, status: word.german === 'eins' ? '学习中' : word.german === 'zwei' ? '已掌握' : '未学'})), 10).map((word) => word.german), ['drei','vier'])
  assert.equal(selectDailyWords(saved, 0).length, 0)
  assert.equal(await getDailyLimit(), 10)
  await setDailyLimit(2)
  const fresh = await import('../src/db.js?settings-reload')
  assert.equal(await fresh.getDailyLimit(), 2)
  await assert.rejects(setDailyLimit(-1), /整数/)
  await assert.rejects(setDailyLimit(1.5), /整数/)
})

test('pack registration does not import; pack and bulk share dedup, levels and status rules', async () => {
  const pack = parseWordPack(JSON.stringify({ name: 'A1 示例', level: 'A1', words: [noun, noun, {german:'lernen',chinese:'学习',partOfSpeech:'动词'}] }), 'pack.json')
  await savePack(pack)
  assert.equal((await getPacks()).length, 1)
  assert.equal((await getWords()).length, 0)
  assert.equal((await savePack(pack)).exists, true)
  await assert.rejects(savePack({...pack,words:[noun]}), /同名/)
  const imported = await importWords(rows(pack.words), pack.level)
  assert.deepEqual([imported.added,imported.skipped], [2,1])
  assert.ok((await getWords()).every((word) => word.level === 'A1' && word.status === '未学'))
  const repeated = await importWords(rows(pack.words), pack.level)
  assert.deepEqual([repeated.added,repeated.skipped], [0,3])
  assert.throws(() => parseWordPack(JSON.stringify({name:'bad',level:'A1',words:[{german:'bad'}]}),'bad.json'), /第 1 条/)
})

test('a failure in the second row rolls back the entire batch and order counter', async () => {
  const original = IDBObjectStore.prototype.add
  let calls = 0
  IDBObjectStore.prototype.add = function (...args) {
    if (++calls === 2) throw new Error('simulated quota error')
    return original.apply(this, args)
  }
  try { await assert.rejects(importWords(rows([noun, {...noun,german:'Buch',article:'das'}])), /保存失败/) }
  finally { IDBObjectStore.prototype.add = original }
  assert.equal((await getWords()).length, 0)
  await importWords(rows([noun]))
  assert.equal((await getWords())[0].importOrder, 1)
})

