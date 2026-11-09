import { useEffect, useRef, useState } from 'react'
import { Download, Trash2, Volume2 } from 'lucide-react'
import { clearAllData, getReviewLog, setDailyLimit, setNewWordPaused, setStudyOptions } from './db.js'
import { dayKey } from './learning.js'
import { announceRestore } from './data-events.js'
import VacationSettings from './VacationSettings.jsx'
import BackupPanel from './BackupPanel.jsx'
import { applyGermanVoice, chooseGermanVoice, getGermanVoices, subscribeSpeechVoices } from './speech-voices.js'
import SyncAccountPanel from './SyncAccountPanel.jsx'

function GermanVoicePicker({studyOptions,onChange}) {
  const [voices,setVoices]=useState(()=>getGermanVoices())
  useEffect(()=>subscribeSpeechVoices(()=>setVoices(getGermanVoices())),[])
  const stored=studyOptions.voiceURI||'auto'
  const selected=voices.some((voice)=>voice.voiceURI===stored)?stored:'auto'
  const actual=chooseGermanVoice(selected)
  function preview() {
    if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance)return
    const utterance=new SpeechSynthesisUtterance('Der rote Zug fährt über die Brücke, und der Lehrer trinkt Wasser.')
    utterance.rate=studyOptions.speechRate
    applyGermanVoice(utterance,selected)
    speechSynthesis.cancel();speechSynthesis.speak(utterance)
  }
  return <div className="settings-row german-voice-row"><label htmlFor="german-voice">德语语音</label><div className="german-voice-controls"><select id="german-voice" value={selected} onChange={(event)=>onChange({voiceURI:event.target.value})}><option value="auto">自动（推荐）</option>{voices.map((voice)=><option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}（{voice.lang}）</option>)}</select><button className="secondary-button" type="button" onClick={preview}><Volume2 size={16}/>试听</button><small>当前实际使用：{actual?`${actual.name}（${actual.lang}）`:'系统默认合成（de-DE）'}</small>{voices.length===0&&<small>本机未发现德语语音，将以系统默认合成朗读 de-DE 文本</small>}</div></div>
}

function DailyLimit({value,onChanged,onError}) {
  const [draft,setDraft]=useState(String(value))
  useEffect(()=>setDraft(String(value)),[value])
  async function save(event) {
    event.preventDefault()
    const number=Number(draft)
    try {await setDailyLimit(number);await onChanged()}
    catch(err){onError(err.message)}
  }
  return <form className="settings-row" onSubmit={save}><label htmlFor="daily-limit">每日新词上限</label><div><input id="daily-limit" type="number" min="0" step="1" value={draft} onChange={(event)=>setDraft(event.target.value)} required/><button className="primary-button">保存</button></div></form>
}

export default function SettingsPage({dailyLimit,pausedToday,vacation,now,studyOptions,onChanged,onRestored,sync}) {
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [confirming,setConfirming]=useState(false)
  const [checked,setChecked]=useState(false)
  const lock=useRef(false)
  async function changeOption(patch) {
    setMessage('')
    try {await setStudyOptions(patch);await onChanged()}
    catch(err){setMessage(err.message)}
  }
  async function togglePause() {
    setMessage('')
    try {await setNewWordPaused(!pausedToday);await onChanged()}
    catch(err){setMessage(err.message)}
  }
  async function exportLog() {
    if(lock.current)return
    lock.current=true;setBusy(true);setMessage('')
    try {
      const rows=await getReviewLog()
      const columns=['at','german','article','rating','dueAtBefore','dueAtAfter','intervalDaysBefore','intervalDaysAfter','wordId']
      const cell=(value)=>`"${String(value ?? '').replaceAll('"','""')}"`
      const csv='\uFEFF'+[columns.join(','),...rows.map((row)=>columns.map((key)=>cell(key.startsWith('dueAt')&&Number.isFinite(row[key])?new Date(row[key]).toISOString():row[key])).join(','))].join('\r\n')
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
      const link=document.createElement('a');link.href=url;link.download=`Wort-review-log-${dayKey()}.csv`
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000)
      setMessage(`已导出 ${rows.length} 条复习记录。`)
    } catch(err){setMessage(err.message)}
    finally{lock.current=false;setBusy(false)}
  }
  async function clear() {
    if(!checked || lock.current)return
    lock.current=true;setBusy(true);setMessage('')
    try {await clearAllData();announceRestore();setConfirming(false);setChecked(false);await onRestored();setMessage('本地词库、词包、学习记录和设置已清除。')}
    catch(err){setMessage(err.message)}
    finally{lock.current=false;setBusy(false)}
  }
  return <div className="settings-page">
    <SyncAccountPanel sync={sync}/>
    <section className="settings-group"><h2>每日学习</h2><DailyLimit value={dailyLimit} onChanged={onChanged} onError={setMessage}/>
      <div className="settings-row"><label htmlFor="new-order">新词顺序</label><select id="new-order" value={studyOptions.newOrder} onChange={(event)=>changeOption({newOrder:event.target.value})}><option value="sequential">顺序</option><option value="random">乱序</option></select><small>顺序按词书原序；乱序从未学池随机抽取当日额度，进行中的轮次不重排。</small></div>
      <div className="settings-row"><label htmlFor="review-order">复习顺序</label><select id="review-order" value={studyOptions.reviewOrder} onChange={(event)=>changeOption({reviewOrder:event.target.value})}><option value="due">到期优先</option><option value="random">随机</option></select><small>随机只改变同一天到期词的出场顺序，跨日期仍按到期日先后。</small></div>
      <div className="settings-row"><span>今日暂停新词</span><button className="secondary-button" aria-pressed={pausedToday} onClick={togglePause}>{pausedToday?'恢复今日新词':'今日暂停新词'}</button><small>仅停当天，次日自动恢复。</small></div>
    </section>
    <section className="settings-group"><h2>假期模式</h2><VacationSettings vacation={vacation} now={now} onChanged={onChanged}/></section>
    <section className="settings-group"><h2>朗读</h2><div className="settings-row"><label htmlFor="auto-speak">自动朗读</label><input id="auto-speak" type="checkbox" checked={studyOptions.autoSpeak} onChange={(event)=>changeOption({autoSpeak:event.target.checked})}/><small>新词和复习闪卡出现时自动朗读；手动发音按钮仍可用。</small></div><div className="settings-row"><label htmlFor="speech-rate">语速：{studyOptions.speechRate.toFixed(1)}×</label><input id="speech-rate" type="range" min="0.5" max="1.5" step="0.1" value={studyOptions.speechRate} onChange={(event)=>changeOption({speechRate:Number(event.target.value)})}/><small>适用于闪卡和听写的 de-DE 发音。</small></div><GermanVoicePicker studyOptions={studyOptions} onChange={changeOption}/></section>
    <section className="settings-group"><h2>复习算法</h2><div className="settings-row"><label htmlFor="algorithm">算法开关</label><select id="algorithm" value="sm2" disabled><option value="sm2">SM-2（当前）</option><option value="fsrs">FSRS（未启用）</option></select><small>FSRS 需积累足够的复习流水，并完成参数校准与旧排程迁移验证后才能启用。</small></div></section>
    <section className="settings-group"><h2>数据管理</h2><BackupPanel onExported={onChanged} onRestored={onRestored}/><div className="settings-data-actions"><button className="secondary-button" disabled={busy} onClick={exportLog}><Download size={16}/>导出复习流水</button><button className="secondary-button danger-button" disabled={busy} onClick={()=>{setConfirming(true);setChecked(false)}}><Trash2 size={16}/>清除全部数据</button></div><p className="import-note">复习流水从本次更新起记录；旧评分没有逐次记录，无法补出。</p>
      {confirming && <div className="clear-confirm" role="group" aria-label="清除全部数据二次确认"><strong>确认清除本浏览器中的全部学习数据？</strong><p>单词、进度、词包、设置和复习流水都会清除。已有的下载备份文件不会被删除。</p><label><input type="checkbox" checked={checked} onChange={(event)=>setChecked(event.target.checked)}/>我已保存需要的备份，确认清除本地数据</label><div><button className="secondary-button" onClick={()=>setConfirming(false)}>取消</button><button className="primary-button danger-button" disabled={!checked || busy} onClick={clear}>确认清除全部数据</button></div></div>}
    </section>
    {message && <p className="import-success" role="status">{message}</p>}
  </div>
}
