import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import 'fake-indexeddb/auto'
import {getWords,importWords,savePack,setCurrentWordbook,getStudyState,clearAllData} from '../src/db.js'
import {wordKey} from '../src/word-model.js'
import {A2_UNIT_ORDER,A2_COMPARISON_ORDER,A2_SCENARIO_ORDER} from '../src/a2-curriculum.js'

globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
const a1=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a1.json',import.meta.url),'utf8'))
const a2=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a2.json',import.meta.url),'utf8'))
const rows=(words)=>words.map((value,index)=>({row:index+1,value}))

test('A2-0 final curriculum and 556 net-new layered words',()=>{
  assert.equal(A2_UNIT_ORDER.length,29)
  assert.deepEqual(A2_UNIT_ORDER.slice(0,9),['p-a2-01','p-a2-02','g-a2-01','g-a2-02','g-a2-03','t-a2-03','g-a2-04','g-a2-05','g-a2-06'])
  assert.equal(A2_COMPARISON_ORDER.length,5)
  assert.equal(A2_SCENARIO_ORDER.length,10)
  assert.equal(a2.words.length,556)
  assert.equal(new Set(a2.words.map(wordKey)).size,556)
  assert.equal(a2.words.filter((word)=>word.layer==='核心主动').length,355)
  assert.equal(a2.words.filter((word)=>word.layer==='被动认读').length,80)
  assert.equal(a2.words.filter((word)=>word.layer==='扩展认读').length,121)
  assert.equal(a2.words.filter((word)=>new Set(a1.words.map(wordKey)).has(wordKey(word))).length,0)
})

test('A2 import preserves matching old-word progress and reimport adds nothing',async()=>{
  await getWords();await clearAllData()
  const sample={...a2.words[0]};delete sample.layer
  await importWords(rows([sample]),'A2')
  const prior=(await getWords())[0]
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('wort-daily',3);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
  await new Promise((resolve,reject)=>{const tx=db.transaction('words','readwrite');tx.objectStore('words').put({...prior,status:'学习中',dueAt:1700000000000,intervalDays:7,ease:2.3,reps:4,lapses:2});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
  db.close()
  const first=await importWords(rows(a2.words),'A2')
  assert.deepEqual([first.added,first.skipped,first.layerUpdated],[555,1,1])
  const second=await importWords(rows(a2.words),'A2')
  assert.deepEqual([second.added,second.skipped],[0,556])
  const retained=(await getWords()).find((word)=>word.id===prior.id)
  assert.deepEqual([retained.status,retained.dueAt,retained.intervalDays,retained.ease,retained.reps,retained.lapses,retained.layer],['学习中',1700000000000,7,2.3,4,2,sample.layer??a2.words[0].layer])
})

test('old 605-word built-in A2 pack updates current-book keys without deleting words',async()=>{
  await clearAllData()
  const old=JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a1.json',import.meta.url),'utf8'))
  const legacy={id:'builtin:goethe-a2',name:'歌德 A2 词库',level:'A2',words:[...a2.words.slice(0,556),...old.words.slice(0,49)]}
  assert.equal(legacy.words.length,605)
  await savePack(legacy)
  await setCurrentWordbook(legacy.id)
  const upgraded=await savePack({...a2,id:legacy.id})
  assert.equal(upgraded.upgraded,true)
  const state=await getStudyState()
  assert.equal(state.currentWordbook.keys.length,556)
})
