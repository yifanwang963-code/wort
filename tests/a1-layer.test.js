import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {getWords,importWords,savePack,setCurrentWordbook,getStudyState,exportBackup,restoreBackup,clearAllData} from '../src/db.js'
import {levelOverview} from '../src/overview.js'
import {wordKey} from '../src/word-model.js'

globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
const layered=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a1.json',import.meta.url),'utf8'))
const gap=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a1-gap.json',import.meta.url),'utf8'))
const gapKeys=new Set(gap.words.map(wordKey))
const original=layered.words.filter((word)=>!gapKeys.has(wordKey(word))).map(({layer,...word})=>word)
const rows=(words)=>words.map((value,index)=>({row:index+1,value}))

test('corrected A1 files add 63 unique words and fill 745 layers without resetting progress',async()=>{
  await getWords();await clearAllData()
  assert.equal(original.length,682)
  assert.equal(gap.words.length,63)
  assert.equal(new Set(layered.words.map(wordKey)).size,745)
  const first=await importWords(rows(original),'A1')
  assert.equal(first.added,682)
  const marked=(await getWords()).find((word)=>word.german==='krank')
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('wort-daily',3);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  await new Promise((resolve,reject)=>{const tx=db.transaction('words','readwrite');tx.objectStore('words').put({...marked,status:'学习中',dueAt:1700000000000,intervalDays:7,ease:2.3,reps:4,lapses:2});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
  db.close()
  const second=await importWords(rows(gap.words),'A1')
  assert.deepEqual([second.added,second.skipped],[63,0])
  const third=await importWords(rows(layered.words),'A1')
  assert.deepEqual([third.added,third.skipped,third.layerUpdated],[0,745,745])
  const words=await getWords()
  assert.equal(words.length,745)
  assert.equal(words.find((word)=>word.german==='Tag').layer,'核心主动')
  assert.equal(words.find((word)=>word.german==='Kühlschrank').layer,'扩展认读')
  assert.deepEqual([words.find((word)=>word.id===marked.id).status,words.find((word)=>word.id===marked.id).dueAt,words.find((word)=>word.id===marked.id).intervalDays,words.find((word)=>word.id===marked.id).ease,words.find((word)=>word.id===marked.id).reps,words.find((word)=>word.id===marked.id).lapses],['学习中',1700000000000,7,2.3,4,2])
  const backup=await exportBackup();await restoreBackup(backup)
  assert.equal((await getWords()).find((word)=>word.id===marked.id).layer,'核心主动')
})

test('old 682-word built-in pack upgrades to 745 keys without changing study status',async()=>{
  await clearAllData()
  const oldPack={id:'builtin:goethe-a1',name:'歌德 A1 词库',level:'A1',words:original}
  const newPack={...oldPack,words:layered.words}
  await savePack(oldPack)
  await setCurrentWordbook(oldPack.id)
  const result=await savePack(newPack)
  assert.equal(result.upgraded,true)
  assert.equal((await getStudyState()).currentWordbook.keys.length,745)
  assert.equal((await savePack(newPack)).upgraded,false)
})

test('core mastery count waits for an output pass; unlayered words use passive rules',()=>{
  const words=[
    {id:'core',status:'已掌握',layer:'核心主动'},
    {id:'passive',status:'已掌握',layer:'被动认读'},
    {id:'legacy',status:'已掌握'},
  ]
  assert.deepEqual(levelOverview(words,'all').map((item)=>item.count),[0,1,2])
  assert.deepEqual(levelOverview(words,'all',['core']).map((item)=>item.count),[0,0,3])
})
