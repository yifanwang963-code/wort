import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'

test('v2 upgrade preserves words, progress, custom limit, order counter and packs', async () => {
  const word = {id:'kept',german:'Buch',article:'das',chinese:'书',partOfSpeech:'名词',createdAt:1,importOrder:99,status:'已掌握',dueAt:123,intervalDays:60,ease:2.3,reps:6,lapses:2}
  await new Promise((resolve,reject)=>{
    const request=indexedDB.open('wort-daily',2)
    request.onupgradeneeded=()=>{
      const db=request.result
      db.createObjectStore('words',{keyPath:'id'}).put(word)
      const settings=db.createObjectStore('settings',{keyPath:'key'})
      settings.put({key:'dailyLimit',value:23});settings.put({key:'importOrder',value:99})
      db.createObjectStore('packs',{keyPath:'id'}).put({id:'p',name:'原词包',level:'A1',words:[]})
    }
    request.onsuccess=()=>{request.result.close();resolve()}
    request.onerror=()=>reject(request.error)
  })
  const db=await import('../src/db.js')
  assert.deepEqual(await db.getWords(),[word])
  assert.equal(await db.getDailyLimit(),23)
  assert.equal((await db.getPacks())[0].name,'原词包')
  assert.equal((await db.addWord({german:'lernen',chinese:'学',partOfSpeech:'动词'})).importOrder,100)
})
