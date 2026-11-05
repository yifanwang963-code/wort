import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import 'fake-indexeddb/auto'
import { addWord, getWords, getStudyState, importWords, rateStudy, savePack, setCurrentWordbook, startStudy } from '../src/db.js'
import { parseWordPack } from '../src/import.js'
import { WORD_BOOKS, bookProgress } from '../src/wordbooks.js'
import { wordKey } from '../src/word-model.js'

async function raw(operation) {
  await getWords()
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('wort-daily',3)
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction(['words','settings','packs'],'readwrite')
      operation(tx)
      tx.oncomplete=()=>{db.close();resolve()}
      tx.onabort=()=>{db.close();reject(tx.error)}
    }
    request.onerror=()=>reject(request.error)
  })
}
beforeEach(()=>raw((tx)=>{
  for(const name of ['words','settings','packs'])tx.objectStore(name).clear()
  tx.objectStore('settings').put({key:'dailyLimit',value:10})
  tx.objectStore('settings').put({key:'importOrder',value:0})
}))
const fields=(german,level)=>({german,article:'',plural:'',chinese:german,partOfSpeech:'动词',exampleDe:'',exampleZh:'',unit:level,level})
const pack=(id,level,names)=>({id,name:`歌德 ${level} 词库`,level,words:names.map((name)=>fields(name,level))})
const rows=(value)=>value.words.map((word,index)=>({row:index+1,value:word}))

test('bundled Goethe books match the existing pack format and catalog counts',async()=>{
  for(const book of WORD_BOOKS){
    const source=await readFile(new URL(`../public/wordbooks/${book.file}`,import.meta.url),'utf8')
    const parsed=parseWordPack(source,book.file)
    assert.equal(parsed.level,book.level)
    assert.equal(parsed.words.length,book.count)
    assert.equal(new Set(parsed.words.map(wordKey)).size,book.count)
  }
})

test('joining and rejoining use the existing dedup pipeline without changing progress',async()=>{
  const a1=pack('builtin:goethe-a1','A1',['lernen','wohnen'])
  await savePack(a1)
  assert.equal((await importWords(rows(a1),a1.level)).added,2)
  await setCurrentWordbook(a1.id)
  const first=await getStudyState()
  assert.equal(first.currentWordbook.id,a1.id)
  assert.equal(first.currentWordbook.keys.length,2)
  const session=(await startStudy('learn')).session
  assert.equal(session.wordIds.length,2)
  await assert.rejects(setCurrentWordbook(a1.id),/完成进行中的新词轮次/)
  const next=await rateStudy(session.id,session.version,'known')
  await rateStudy(next.session.id,next.session.version,'known')
  const before=await getWords()
  const repeated=await importWords(rows(a1),a1.level)
  assert.equal(repeated.added,0)
  assert.equal(repeated.skipped,2)
  assert.deepEqual(await getWords(),before)
  assert.deepEqual(bookProgress(before,a1),{imported:2,learned:2,total:2,percent:100})
})

test('a selected book limits daily new words even when other unlearned words exist',async()=>{
  const a1=pack('builtin:goethe-a1','A1',['lernen'])
  const a2=pack('builtin:goethe-a2','A2',['arbeiten'])
  await savePack(a1);await savePack(a2)
  await importWords(rows(a2),a2.level)
  await importWords(rows(a1),a1.level)
  await addWord({...fields('spielen','A1'),level:undefined})
  await setCurrentWordbook(a1.id)
  const round=(await startStudy('learn')).session
  const chosen=(await getWords()).filter((word)=>round.wordIds.includes(word.id))
  assert.deepEqual(chosen.map((word)=>word.german),['lernen'])
  await rateStudy(round.id,round.version,'known')
  assert.equal((await startStudy('learn')).session,null)
  await setCurrentWordbook(a2.id)
  const second=(await startStudy('learn')).session
  assert.equal((await getWords()).find((word)=>word.id===second.wordIds[0]).german,'arbeiten')
})
