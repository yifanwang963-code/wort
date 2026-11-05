import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {clearAllData,getStudyState,getWords,importWords,savePack,setCurrentWordbook} from '../src/db.js'
import {parseWordPack} from '../src/import.js'
import {wordKey} from '../src/word-model.js'
import {WORD_BOOKS} from '../src/wordbooks.js'

globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
const text=readFileSync(new URL('../public/wordbooks/goethe-b1.json',import.meta.url),'utf8')
const b1=JSON.parse(text)
const a1=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a1.json',import.meta.url),'utf8'))
const a2=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a2.json',import.meta.url),'utf8'))
const rows=(words)=>words.map((value,index)=>({row:index+1,value}))

test('B1-0 reviewed book has 1,740 unique layered words and the specified fragments',()=>{
  const low=new Set([...a1.words,...a2.words].map(wordKey))
  assert.equal(b1.count,1740)
  assert.equal(b1.words.length,1740)
  assert.equal(new Set(b1.words.map(wordKey)).size,1740)
  assert.equal(b1.words.filter((word)=>low.has(wordKey(word))).length,0)
  assert.deepEqual(Object.fromEntries(['核心主动','被动认读','扩展认读'].map((layer)=>[layer,b1.words.filter((word)=>word.layer===layer).length])),{'核心主动':1070,'被动认读':569,'扩展认读':101})
  const fragments=['-weise','aller-','Bio-','Doppel-','Groß-','Haupt-','miss-','Not-','Schwieger-','Speise-/Speise','Spezial-','un-','unter-','über-']
  assert.ok(fragments.every((german)=>b1.words.some((word)=>word.german===german&&word.partOfSpeech==='短语'&&word.layer==='扩展认读')))
  assert.equal(b1.words.filter((word)=>word.partOfSpeech==='名词'&&!word.plural).length,93)
  assert.equal(WORD_BOOKS.find((book)=>book.level==='B1').count,1740)
  assert.equal(parseWordPack(text,'goethe-b1.json').words.length,1740)
})

test('old B1 book upgrades and corrected Schülerin keeps its ID and learning progress',async()=>{
  await getWords();await clearAllData()
  const corrected=b1.words.find((word)=>word.german==='Schülerin')
  assert.equal(corrected.article,'die')
  const oldSch={...corrected,article:'der'}
  const oldExtras=['danach','fühlen','hungrig','her','herein'].map((german)=>[...a1.words,...a2.words].find((word)=>word.german===german))
  assert.ok(oldExtras.every(Boolean))
  const legacy={...b1,id:'builtin:goethe-b1',count:1745,words:[...b1.words.map((word)=>word.german==='Schülerin'?oldSch:word),...oldExtras]}
  assert.equal(legacy.words.length,1745)
  await savePack(legacy)
  await setCurrentWordbook(legacy.id)
  await importWords(rows([oldSch]),'B1')
  const prior=(await getWords())[0]
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('wort-daily',3);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
  await new Promise((resolve,reject)=>{const tx=db.transaction('words','readwrite');tx.objectStore('words').put({...prior,status:'学习中',dueAt:1700000000000,intervalDays:7,ease:2.3,reps:4,lapses:2});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
  db.close()
  const upgraded=await savePack({...b1,id:legacy.id})
  assert.equal(upgraded.upgraded,true)
  assert.equal((await getStudyState()).currentWordbook.keys.length,1740)
  const imported=await importWords(rows(b1.words),'B1')
  assert.deepEqual([imported.added,imported.skipped],[1739,1])
  const migrated=(await getWords()).find((word)=>word.german==='Schülerin')
  assert.deepEqual([migrated.id,migrated.article,migrated.status,migrated.dueAt,migrated.intervalDays,migrated.ease,migrated.reps,migrated.lapses,migrated.importOrder,migrated.layer],
    [prior.id,'die','学习中',1700000000000,7,2.3,4,2,prior.importOrder,corrected.layer])
  assert.equal((await getWords()).filter((word)=>word.german==='Schülerin').length,1)
  const repeated=await importWords(rows(b1.words),'B1')
  assert.deepEqual([repeated.added,repeated.skipped],[0,1740])
})
