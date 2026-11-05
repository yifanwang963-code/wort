import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {clearAllData,getWords,importWords,savePack,setCurrentWordbook,getStudyState} from '../src/db.js'
import {parseWordPack} from '../src/import.js'
import {wordKey} from '../src/word-model.js'
import {WORD_BOOKS} from '../src/wordbooks.js'

globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
const text=readFileSync(new URL('../public/wordbooks/b2.json',import.meta.url),'utf8')
const book=JSON.parse(text)
const earlier=['goethe-a1','goethe-a2','goethe-b1'].flatMap((name)=>
  JSON.parse(readFileSync(new URL(`../public/wordbooks/${name}.json`,import.meta.url),'utf8')).words)
const rows=(words)=>words.map((value,index)=>({row:index+1,value}))

test('B2 complete book has 2016 net-new layered words and valid examples',()=>{
  const earlierKeys=new Set(earlier.map(wordKey))
  assert.equal(book.level,'B2')
  assert.equal(book.count,2016)
  assert.equal(book.words.length,2016)
  assert.equal(new Set(book.words.map(wordKey)).size,2016)
  assert.ok(book.words.every((word)=>!earlierKeys.has(wordKey(word))))
  assert.deepEqual(Object.fromEntries(['核心主动','被动认读','扩展认读'].map((layer)=>
    [layer,book.words.filter((word)=>word.layer===layer).length])),
    {'核心主动':664,'被动认读':1251,'扩展认读':101})
  assert.ok(book.words.every((word)=>word.exampleDe.split(/\s+/u).length>=8
    &&word.exampleDe.split(/\s+/u).length<=16))
  assert.equal(WORD_BOOKS.find((item)=>item.level==='B2')?.count,2016)
  assert.equal(parseWordPack(text,'b2.json').words.length,2016)
})

test('B2 joining and rejoining use existing dedup pipeline without resetting progress',async()=>{
  await getWords();await clearAllData()
  const pack={...parseWordPack(text,'b2.json'),id:'builtin:b2'}
  await savePack(pack)
  await setCurrentWordbook(pack.id)
  const sample=book.words[0]
  await importWords(rows([sample]),'B2')
  const prior=(await getWords())[0]
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('wort-daily',3);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  await new Promise((resolve,reject)=>{const tx=db.transaction('words','readwrite');tx.objectStore('words').put({...prior,status:'学习中',dueAt:1700000000000,intervalDays:7,ease:2.3,reps:4,lapses:2});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
  db.close()
  const first=await importWords(rows(book.words),'B2')
  assert.deepEqual([first.added,first.skipped],[2015,1])
  assert.equal((await getStudyState()).currentWordbook.keys.length,2016)
  const repeated=await importWords(rows(book.words),'B2')
  assert.deepEqual([repeated.added,repeated.skipped],[0,2016])
  const retained=(await getWords()).find((word)=>wordKey(word)===wordKey(sample))
  assert.deepEqual([retained.id,retained.status,retained.dueAt,retained.intervalDays,retained.ease,retained.reps,retained.lapses,retained.layer],
    [prior.id,'学习中',1700000000000,7,2.3,4,2,sample.layer])
})
