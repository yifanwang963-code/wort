import { useEffect, useRef, useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { getPacks, importWords, savePack, setCurrentWordbook } from './db.js'
import { parseWordPack } from './import.js'
import { WORD_BOOKS, bookProgress } from './wordbooks.js'

export default function WordbooksPage({ words, currentWordbook, onChanged }) {
  const [packs,setPacks] = useState([])
  const [busy,setBusy] = useState('')
  const busyRef = useRef(false)
  const [message,setMessage] = useState('')
  const [error,setError] = useState('')
  useEffect(()=>{getPacks().then(setPacks).catch((err)=>setError(err.message))},[])
  async function join(book) {
    if (busyRef.current) return
    if (packs.some((item)=>item.id===book.id) && !window.confirm(`再次导入「${book.name}」？重复词会跳过，现有学习进度会保留。`)) return
    busyRef.current=true;setBusy(book.id);setError('');setMessage('')
    try {
      const response=await fetch(`${import.meta.env.BASE_URL}wordbooks/${book.file}`)
      if (!response.ok) throw new Error('词书文件暂时无法读取，请联网重试。')
      const pack={...parseWordPack(await response.text(),book.file),id:book.id}
      if (pack.level!==book.level || pack.words.length!==book.count) throw new Error('词书文件与书目不一致，请重新部署完整文件。')
      await savePack(pack)
      const result=await importWords(pack.words.map((value,index)=>({row:index+1,value})),book.level)
      setPacks(await getPacks())
      await onChanged()
      setMessage(`${book.name}：新增 ${result.added} 个，跳过重复 ${result.skipped} 个。`)
    } catch(err){setError(err.message || '加入词书失败，请重试。')}
    finally{busyRef.current=false;setBusy('')}
  }
  async function choose(book) {
    if (busyRef.current) return
    busyRef.current=true;setBusy(book.id);setError('');setMessage('')
    try {await setCurrentWordbook(book.id);await onChanged();setMessage(`已设「${book.name}」为当前词书。`)}
    catch(err){setError(err.message || '设置当前词书失败。')}
    finally{busyRef.current=false;setBusy('')}
  }
  return <section className="wordbooks-page" aria-labelledby="wordbooks-heading"><div className="section-heading"><div><h2 id="wordbooks-heading">内置词书</h2><p>按需加入本地词库；新词仍按导入顺序学习。</p></div></div>
    {currentWordbook && <p className="current-book-note">当前词书：{WORD_BOOKS.find((book)=>book.id===currentWordbook.id)?.name ?? '已选词书'}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {message && <p className="import-success" role="status"><Check size={16}/>{message}</p>}
    <div className="wordbook-grid">{WORD_BOOKS.map((book)=>{
      const pack=packs.find((item)=>item.id===book.id)
      const progress=bookProgress(words,pack)
      const active=currentWordbook?.id===book.id
      const needsUpdate=!!pack&&pack.words.length!==book.count
      return <article className="wordbook-card" key={book.id}><span className="wordbook-level">{book.level}</span><div className="wordbook-info"><h3>{book.name}{active&&<small> · 当前</small>}</h3><p>{book.level==='B2'?'自建分层版':'歌德分级 · 分层版'}</p><div className="wordbook-progress"><span style={{width:`${progress.percent}%`}}/></div><small>本书已学 {progress.learned} · {progress.percent}%</small></div><div className="wordbook-count">{needsUpdate?<><strong>旧版已导入 {progress.imported}</strong><span className="pending-badge">待更新</span></>:<><strong>已导入 {progress.imported} <i>/</i> 共 {book.count}</strong><span className={active?'current-book-tag':''}>{active?'正在使用':pack?'已加入':'未加入'}</span></>}</div><div className="wordbook-actions"><button className={pack?'text-button':'secondary-button'} disabled={!!busy} onClick={()=>join(book)}>{busy===book.id?'正在处理…':pack?'再次导入':'加入学习'} {!pack&&<ArrowRight size={16}/>}</button><button className="secondary-button" disabled={!!busy || !pack || active} onClick={()=>choose(book)}>{active?'正在使用':'设为当前'}</button></div></article>
    })}</div><p className="import-note">加入学习走现有词包导入：按德语词和冠词去重；重复词保留原学习进度。</p>
  </section>
}
