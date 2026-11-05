import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'

test('v1 migration adds status/order and preserves every existing field', async () => {
  const old = { id:'original-id', createdAt:12345, german:'Apfel',article:'der',plural:'Äpfel',chinese:'苹果',partOfSpeech:'名词',exampleDe:'A',exampleZh:'B',unit:'1', custom:'preserved' }
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('wort-daily',1)
    request.onupgradeneeded = () => request.result.createObjectStore('words',{keyPath:'id'}).add(old)
    request.onsuccess = () => { request.result.close(); resolve() }
    request.onerror = () => reject(request.error)
  })
  const { getWords, getDailyLimit, addWord } = await import('../src/db.js')
  const words = await getWords()
  assert.deepEqual(words,[{...old,status:'未学',importOrder:1,dueAt:null,intervalDays:0,ease:2.5,reps:0,lapses:0}])
  assert.equal(await getDailyLimit(),10)
  const newWord = await addWord({...old,german:'Buch',article:'das'})
  assert.equal(newWord.importOrder,2)
  assert.equal(newWord.status,'未学')
})
