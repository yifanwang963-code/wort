import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, CheckCheck, LoaderCircle, X } from 'lucide-react'
import { PARTS_OF_SPEECH } from './word-model.js'
import ExampleAudioButton from './ExampleAudioButton.jsx'

const emptyForm = { german: '', article: '', plural: '', chinese: '', partOfSpeech: '名词', exampleDe: '', exampleZh: '', unit: '' }

export function ArticleLegend() {
  return <div className="article-legend" aria-label="冠词颜色：der 蓝色、die 红色、das 绿色"><span><i className="dot der"/>der</span><span><i className="dot die"/>die</span><span><i className="dot das"/>das</span></div>
}
export function WordCard({word,showLapses=false,sceneUsed=false}) {
  return <article className="word-card"><div className="word-card-top"><span className={`word-type ${word.article||''}`}>{word.partOfSpeech}</span><span className="word-status">{word.status??'未学'}</span>{word.unit&&<span className="unit">{word.unit}</span>}</div>{word.level&&<p className="word-level">{word.level}</p>}{word.layer&&<p className="word-level">{word.layer}</p>}{sceneUsed&&<p className="word-level">已在情景中用过</p>}{showLapses&&<p className="word-level">答错 {word.lapses} 次</p>}<h3 lang="de" className={word.article||''}>{word.article&&<span className="word-article">{word.article} </span>}{word.german}</h3>{word.plural&&<p className="plural">复数 · {word.plural}</p>}<p className="translation">{word.chinese}</p>{(word.exampleDe||word.exampleZh)&&<div className="example">{word.exampleDe&&<div className="word-example-line"><p lang="de">{word.exampleDe}</p><ExampleAudioButton text={word.exampleDe}/></div>}{word.exampleZh&&<p className="example-zh">{word.exampleZh}</p>}</div>}</article>
}
export function EmptyLibrary({onAdd}) {
  return <div className="empty-state"><div className="empty-icon"><BookOpen size={28} strokeWidth={1.5}/></div><h3>你的词库，等你写下第一词</h3><p>添加德语、释义和例句，留住每一次发现。</p><button className="text-button" onClick={onAdd}>添加第一个词 <ArrowRight size={17}/></button></div>
}
export function AddWordDialog({open,onClose,onSave}) {
  const dialogRef=useRef(null),firstInputRef=useRef(null),savingRef=useRef(false)
  const [form,setForm]=useState(emptyForm),[saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(open){dialogRef.current.showModal();firstInputRef.current.focus()}else dialogRef.current.close()},[open])
  function change(event){const{name,value}=event.target;setForm((current)=>({...current,[name]:value}))}
  async function submit(event){event.preventDefault();if(savingRef.current)return;savingRef.current=true;setSaving(true);setError('');try{await onSave(form);setForm(emptyForm);onClose()}catch(err){setError(err.message||'保存失败，请重试。')}finally{savingRef.current=false;setSaving(false)}}
  return <dialog ref={dialogRef} className="add-dialog" aria-labelledby="add-title" onCancel={(event)=>{event.preventDefault();if(!savingRef.current)onClose()}}><form onSubmit={submit}><div className="dialog-heading"><div><p className="eyebrow">EIN NEUES WORT</p><h2 id="add-title">收下一个新词</h2></div><button type="button" className="icon-button" aria-label="关闭加词窗口" onClick={onClose} disabled={saving}><X size={21}/></button></div><p className="form-note">带 * 的为必填项，其余选填。</p><fieldset disabled={saving} className="form-fields">
    <label>德语单词 *<input ref={firstInputRef} name="german" lang="de" value={form.german} onChange={change} placeholder="例如：Apfel" required maxLength={200}/></label>
    <div className="form-row"><label>词性 *<select name="partOfSpeech" value={form.partOfSpeech} onChange={change}>{PARTS_OF_SPEECH.map((part)=><option key={part}>{part}</option>)}</select></label><label>单元<input name="unit" value={form.unit} onChange={change} placeholder="例如：Lektion 1" maxLength={100}/></label></div>
    {form.partOfSpeech==='名词'&&<div className="form-row"><label>冠词 *<select className={form.article} name="article" value={form.article} onChange={change} required><option value="">选择冠词</option><option value="der">der · 阳性</option><option value="die">die · 阴性</option><option value="das">das · 中性</option></select></label><label>复数<input name="plural" lang="de" value={form.plural} onChange={change} placeholder="例如：Äpfel" maxLength={200}/></label></div>}
    <label>中文释义 *<input name="chinese" value={form.chinese} onChange={change} placeholder="例如：苹果" required maxLength={500}/></label><label>德语例句<textarea name="exampleDe" lang="de" value={form.exampleDe} onChange={change} placeholder="例如：Ich esse einen Apfel." rows={2} maxLength={2000}/></label><label>例句翻译<textarea name="exampleZh" value={form.exampleZh} onChange={change} placeholder="例如：我吃一个苹果。" rows={2} maxLength={2000}/></label></fieldset>{error&&<p role="alert" className="error-message">{error}</p>}<div className="dialog-footer"><span><CheckCheck size={16}/> 保存在当前浏览器</span><button className="primary-button" type="submit" disabled={saving}>{saving?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>} {saving?'正在保存':'保存单词'}</button></div></form></dialog>
}
