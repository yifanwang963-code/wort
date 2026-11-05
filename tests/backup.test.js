import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { addWord, getWords, exportBackup, restoreBackup, setDailyLimit, startStudy, rateStudy, getStudyState, savePack } from '../src/db.js'
import { parseBackup, validateBackup, backupFilename } from '../src/backup.js'
import { parseImportFile, parseWordPack } from '../src/import.js'

const now = new Date(2026,9,30,12)
const sample = { german:'Apfel', article:'der', chinese:'苹果', partOfSpeech:'名词',plural:'Äpfel',exampleDe:'Ein Apfel.',exampleZh:'一个苹果。',unit:'1' }
async function raw(operation) {
  await getWords()
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('wort-daily',3)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['words','settings','packs'],'readwrite')
      operation(tx)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
    request.onerror = () => reject(request.error)
  })
}
beforeEach(() => raw((tx) => {
  for (const name of ['words','settings','packs']) tx.objectStore(name).clear()
  tx.objectStore('settings').put({key:'dailyLimit',value:10})
  tx.objectStore('settings').put({key:'importOrder',value:0})
}))

test('full backup roundtrip replaces every store and preserves duplicate words, progress, unknown fields, quota and active session', async () => {
  await setDailyLimit(2)
  await addWord(sample)
  await addWord(sample) // Manual duplicates are legitimate and must survive restoration.
  const third = await addWord({...sample,german:'Buch',article:'das'})
  let {session} = await startStudy('learn',now)
  ;({session} = await rateStudy(session.id,session.version,'known',now))
  await rateStudy(session.id,session.version,'known',now)
  await raw((tx) => tx.objectStore('words').put({...third,custom:{preserve:true},ease:1.2}))
  await savePack({id:'pack',name:'A1',level:'A1',words:[sample,sample],sourceCount:2})
  await setDailyLimit(3)
  const active = await startStudy('learn',now)
  await rateStudy(active.session.id,0,'unknown',now)
  const backup = parseBackup(JSON.stringify(await exportBackup(now)))
  assert.equal(backup.words.length,3)
  assert.equal(backup.settings.find((s)=>s.key==='learned:2026-10-30').value.length,2)
  await addWord({...sample,german:'extra'})
  await savePack({id:'extra',name:'extra',level:'B1',words:[sample]})
  await raw((tx) => tx.objectStore('settings').put({key:'extra',value:42}))
  await restoreBackup(backup)
  assert.deepEqual(await exportBackup(now),backup)
  const state = await getStudyState(now)
  assert.equal(state.learnedToday,2)
  assert.equal(state.dailyLimit,3)
  assert.equal(state.session.index,1)
  assert.equal(state.session.queue[1].repeat,true)
  await rateStudy(state.session.id,state.session.version,'known',now)
  assert.equal((await getStudyState(now)).learnedToday,3)
  assert.equal((await addWord({...sample,german:'new-after-restore'})).importOrder,4)
  assert.match(backupFilename(now),/^Wort-backup-2026-10-30-120000\.json$/)
})

test('invalid backups never mutate current records; backup files cannot be merged as word packs', async () => {
  await addWord(sample)
  const before = await exportBackup(now)
  for (const mutate of [
    (b)=>{b.format='pack'}, (b)=>{b.formatVersion=2}, (b)=>{b.databaseVersion=4},
    (b)=>{delete b.words[0].ease}, (b)=>{b.words.push(b.words[0])},
    (b)=>{b.words[0].status='unknown'}, (b)=>{b.settings=[]},
    (b)=>{b.settings.push({key:'studySession',value:{id:'x',mode:'learn',version:0,wordIds:['missing'],queue:[],index:0}})},
    (b)=>{b.packs=[{id:'bad'}]},
  ]) {
    const broken = structuredClone(before); mutate(broken)
    await assert.rejects(restoreBackup(broken),/备份/)
    assert.deepEqual(await exportBackup(now),before)
  }
  assert.throws(()=>parseBackup('{'),/JSON/)
  assert.throws(()=>parseBackup(JSON.stringify({name:'pack',level:'A1',words:[sample]})),/不是 Wort 整库备份/)
  assert.throws(()=>parseImportFile(JSON.stringify(before),'backup.json'),/备份与恢复/)
  assert.throws(()=>parseWordPack(JSON.stringify(before),'backup.json'),/备份与恢复/)
})

test('restore abort after clearing and inserting rolls back all stores', async () => {
  const empty = await exportBackup(now)
  await addWord(sample)
  await setDailyLimit(7)
  await savePack({id:'pack',name:'A1',level:'A1',words:[sample]})
  const before = await exportBackup(now)
  const originalAdd = IDBObjectStore.prototype.add
  IDBObjectStore.prototype.add = function (...args) {
    const request = originalAdd.apply(this,args)
    if (this.name === 'settings') this.transaction.abort()
    return request
  }
  try { await assert.rejects(restoreBackup(empty),/原有词库和设置保持不变/) }
  finally { IDBObjectStore.prototype.add = originalAdd }
  assert.deepEqual(await exportBackup(now),before)
})

test('an empty backup is valid and restores an empty library with original settings', async () => {
  const empty = validateBackup(await exportBackup(now))
  await addWord(sample)
  await setDailyLimit(0)
  await restoreBackup(empty)
  assert.deepEqual(await exportBackup(now),empty)
})
