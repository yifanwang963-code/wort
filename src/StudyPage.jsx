import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCheck, RotateCcw, Volume2 } from 'lucide-react'
import { startStudy, rateStudy } from './db.js'
import { reviewProgress } from './learning.js'
import ExampleAudioButton, { cancelExampleSpeech } from './ExampleAudioButton.jsx'
import { applyGermanVoice } from './speech-voices.js'

export default function StudyPage({ mode, onChanged, studyOptions }) {
  const [state, setState] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [speechError, setSpeechError] = useState('')
  const actionLock = useRef(false)
  const session = state?.session
  const entry = session?.queue[session.index]
  const word = state?.words.find((item) => item.id === entry?.id)
  const learn = mode === 'learn'

  async function load() {
    setLoading(true); setError(''); setFlipped(false)
    try { setState(await startStudy(mode)); onChanged() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(); return () => { window.speechSynthesis?.cancel(); cancelExampleSpeech() } }, [mode])

  async function rate(rating) {
    if (!flipped || !session || actionLock.current) return
    actionLock.current = true; setSaving(true); setError('')
    try {
      const next = await rateStudy(session.id, session.version, rating)
      setState(next); setFlipped(false); setSpeechError('')
      window.speechSynthesis?.cancel()
      onChanged()
    } catch (err) { setError(err.message) }
    finally { actionLock.current = false; setSaving(false) }
  }

  useEffect(() => {
    function keydown(event) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || loading || saving || !word) return
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.code === 'Space') { event.preventDefault(); setFlipped((value) => !value) }
      const rating = learn ? { '1': 'known', '2': 'unknown' }[event.key] : { '1': 'forgot', '2': 'hard', '3': 'remember' }[event.key]
      if (rating && flipped) { event.preventDefault(); rate(rating) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [word, flipped, saving, loading, session, learn])

  function pronounce(frontOnly = false) {
    setSpeechError('')
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setSpeechError('当前浏览器不支持语音朗读，请使用支持 Web Speech API 的浏览器。'); return
    }
    const text = learn || (!frontOnly && flipped) ? [word.article, word.german].filter(Boolean).join(' ') : word.german
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = studyOptions?.speechRate ?? 1
    applyGermanVoice(utterance)
    utterance.onerror = (event) => { if (!['canceled', 'interrupted'].includes(event.error)) setSpeechError('德语发音暂不可用，请检查设备音量和德语语音包后重试。') }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    if (word && studyOptions?.autoSpeak) pronounce(true)
  }, [word?.id, session?.index, studyOptions?.autoSpeak])

  const ratings = word ? (learn ? [
    { id: 'unknown', label: '不认识', hint: entry.repeat ? '已重现一次' : '本轮末尾再看一次', key: '2' },
    { id: 'known', label: '认识', hint: '继续下一个', key: '1' },
  ] : [
    { id: 'forgot', label: '忘了', hint: '明天 · 1 天', key: '1' },
    { id: 'hard', label: '模糊', hint: `${reviewProgress(word, 'hard').intervalDays} 天后`, key: '2' },
    { id: 'remember', label: '记得', hint: `${reviewProgress(word, 'remember').intervalDays} 天后`, key: '3' },
  ]) : []
  const flashSize=word?(word.german.length<=6?64:word.german.length<=10?52:word.german.length<=15?42:34):64

  return <section className="study-page" aria-label={learn ? '新词闪卡学习' : '复习闪卡'}>
    {loading ? <p className="loading" role="status">正在读取学习进度…</p> : <>
      {error && <div className="error-message" role="alert"><p>{error}</p><button className="secondary-button" onClick={load} disabled={saving}>重新读取进度</button><a href="#study" className="text-button">返回学习</a></div>}
      {word && <>
        <div className="study-progress"><span>本轮 {session.wordIds.length} 个词</span><span>卡片 {session.index + 1} / {session.queue.length}{entry.repeat ? ' · 重现' : ''}</span></div>
        <progress max={session.queue.length} value={session.index} aria-label="本轮学习进度" />
        <div className="flashcard">
          <div className="flashcard-label"><span>{flipped ? '答案' : '回想一下这个词的意思'}{entry.repeat && ' · 本轮重现'}</span><button className="icon-button" type="button" onClick={() => pronounce()} aria-label="播放德语发音"><Volume2 size={22} /></button></div>
          <button className="flashcard-flip" type="button" onClick={() => { cancelExampleSpeech(); setFlipped((value) => !value) }} disabled={saving} aria-label={flipped ? '翻回正面' : '翻面查看答案'}>
            <span className={`flashcard-word ${learn || flipped ? word.article : ''}`} style={{'--flash-size':`${flashSize}px`}} lang="de">{(learn || flipped) && word.article && <span>{word.article} </span>}{word.german}</span>
            {!flipped && <span className="flip-hint">点击翻面 <RotateCcw size={14} /></span>}
          </button>
          {flipped && <div className="flashcard-answer">
            <p className="flashcard-translation">{word.chinese}</p>
            <div className="answer-meta"><span>{word.partOfSpeech}</span><span>复数：{word.plural || '—'}</span>{word.unit && <span>单元：{word.unit}</span>}{word.level && <span>级别：{word.level}</span>}</div>
            {word.exampleDe&&<div className="flashcard-example"><div className="flashcard-example-line"><p lang="de">{word.exampleDe}</p><ExampleAudioButton text={word.exampleDe} rate={studyOptions?.speechRate ?? 1}/></div>{word.exampleZh&&<p>{word.exampleZh}</p>}</div>}
            <button className="text-button flip-back" type="button" onClick={() => { cancelExampleSpeech(); setFlipped(false) }}>翻回正面</button>
          </div>}
        </div>
        {speechError && <p className="error-message" role="status">{speechError}</p>}
        {flipped && <div className={`rating-buttons ${learn ? 'learn-ratings' : ''}`} aria-label="自评">{ratings.map((rating) => <button className={`rating-button ${rating.id}`} key={rating.id} onClick={() => rate(rating.id)} disabled={saving}><span><kbd>{rating.key}</kbd>{rating.label}</span><small>{rating.hint}</small></button>)}</div>}
        <p className="shortcut-note">空格翻面 · {learn ? '1 认识 / 2 不认识' : '1 忘了 / 2 模糊 / 3 记得'} · 翻面后可评分</p>
        {session.index===0&&<p className="import-note">{learn ? '完成整轮（含重现卡）后，这批词统一进入学习中，明天复习。' : '每次自评立即保存；忘了的词每轮最多追加一次，重现时再次评分也会更新进度。'}刷新或离开后可继续本轮。</p>}
        <span className="study-save-status" role="status">{saving ? '正在保存，请稍候…' : ''}</span>
      </>}
      {!word && !error && <div className="study-complete"><CheckCheck size={40} strokeWidth={1.4} /><h2>{state?.completed ? '本轮完成' : learn ? '当前没有可学的新词' : '当前没有到期的复习词'}</h2><p>{state?.completed ? `已完成 ${state.completed} 个词。${learn ? '已计入今日已学，明天开始复习。' : '所有评分均已保存。'}` : '返回学习查看额度与学习安排。'}</p><a className="primary-button" href="#study">返回学习 <ArrowRight size={16} /></a></div>}
    </>}
  </section>
}
