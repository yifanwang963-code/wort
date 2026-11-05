import { useEffect, useRef, useState } from 'react'
import { Volume2, ArrowRight, CheckCheck } from 'lucide-react'
import { startOutputTraining, answerOutputTraining } from './db.js'
import { clozePrompt } from './output.js'

const choices = [{id:'mixed',label:'混合'}, {id:'dictation',label:'听写'}, {id:'translation',label:'看中文写德语'}, {id:'article',label:'冠词快测'}, {id:'cloze',label:'例句挖空'}]

export default function OutputPage({ onChanged, studyOptions }) {
  const [state, setState] = useState(null)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [replays, setReplays] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [speechError, setSpeechError] = useState('')
  const lock = useRef(false)
  const input = useRef(null)
  const session = state?.session
  const activeEntry = feedback?.entry ?? session?.queue[session.index]
  const word = feedback?.word ?? state?.words.find((item) => item.id === activeEntry?.id)
  const mode = activeEntry?.mode

  async function load(selectedMode = 'mixed', wrongOnly = false, reset = false) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const next = await startOutputTraining(selectedMode, wrongOnly, reset)
      setState(next); setFeedback(null); setAnswer(''); setReplays(0); setSpeechError('')
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(false) }
  }
  useEffect(() => { load(); return () => window.speechSynthesis?.cancel() }, [])

  function speak(value) {
    setSpeechError('')
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setSpeechError('当前浏览器不支持语音朗读。'); return }
    const utterance = new SpeechSynthesisUtterance([value.article,value.german].filter(Boolean).join(' '))
    utterance.lang = 'de-DE'
    utterance.rate = studyOptions?.speechRate ?? 1
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => voice.lang === 'de-DE' && voice.localService) || voices.find((voice) => voice.lang === 'de-DE') || null
    utterance.onerror = (event) => { if (!['canceled','interrupted'].includes(event.error)) setSpeechError('德语发音暂不可用，请检查设备语音设置。') }
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance)
  }
  useEffect(() => {
    if (word && mode === 'dictation' && !feedback) { setReplays(0); speak(word) }
    return () => window.speechSynthesis?.cancel()
  }, [activeEntry?.id, mode])

  async function submit(value = answer) {
    if (!session || !word || feedback || busy || lock.current || !value.trim()) return
    lock.current = true; setBusy(true); setError('')
    try {
      const next = await answerOutputTraining(session.id,session.version,value)
      setFeedback({ ...next.feedback, word, entry: activeEntry })
      setState(next); window.speechSynthesis?.cancel(); onChanged()
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(false) }
  }
  function nextCard() { setFeedback(null); setAnswer(''); setReplays(0); setSpeechError(''); input.current?.focus() }
  function replay() { if (!word || replays >= 3 || feedback) return; setReplays((count) => count + 1); speak(word) }
  function insert(character) {
    const field = input.current
    if (!field) return
    const start = field.selectionStart, end = field.selectionEnd
    setAnswer((value) => value.slice(0,start) + character + value.slice(end))
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + 1,start + 1) })
  }

  return <section className="study-page output-page" aria-label="输出型强化训练">
    <div className="output-modes" aria-label="训练模式">{choices.map((choice) => <button key={choice.id} className={`secondary-button ${session?.mode === choice.id ? 'selected' : ''}`} aria-pressed={session?.mode === choice.id} disabled={busy} onClick={() => load(choice.id,session?.wrongOnly ?? false,true)}>{choice.label}</button>)}</div>
    {busy && !state && <p className="loading" role="status">正在准备训练…</p>}
    {error && <div className="error-message" role="alert">{error}<button className="secondary-button" onClick={() => load()}>重新读取</button></div>}
    {word && <>
      <div className="study-progress"><span>{session?.wrongOnly ? '错词本 · ' : ''}{choices.find((choice) => choice.id === mode)?.label}</span><span>第 {feedback ? (state?.session?.index ?? state?.totals?.correct + state?.totals?.wrong) : session?.index + 1} / {session?.queue.length ?? state?.totals?.correct + state?.totals?.wrong} 题</span></div>
      <div className="flashcard output-card">
        {mode === 'dictation' ? <div className="output-prompt"><p>听发音，写出德语{word.article ? '（含冠词）' : ''}</p><button className="secondary-button" onClick={replay} disabled={feedback || replays >= 3}><Volume2 size={18} />重播发音（剩余 {3-replays} 次）</button></div> : mode === 'translation' ? <div className="output-prompt"><p>看中文，写出德语{word.article ? '（含冠词）' : ''}</p><strong>{word.chinese}</strong><span>{word.partOfSpeech}</span></div> : mode === 'cloze' ? <div className="output-prompt"><p>补全例句中的词形</p><strong lang="de" className="cloze-sentence">{clozePrompt(word)?.sentence}</strong><span>原形：<span lang="de">{word.german}</span> · {word.chinese}</span></div> : <div className="output-prompt"><p>选出正确冠词</p><strong lang="de">{word.german}</strong><span>{word.chinese}</span></div>}
        {!feedback && mode === 'article' && <div className="output-articles">{['der','die','das'].map((article) => <button key={article} className="rating-button" disabled={busy} onClick={() => submit(article)}>{article}</button>)}</div>}
        {!feedback && mode !== 'article' && <form className="output-form" onSubmit={(event) => {event.preventDefault(); submit()}}>
          <label htmlFor="output-answer">输入德语答案</label><input id="output-answer" ref={input} autoComplete="off" autoCapitalize="off" spellCheck="false" value={answer} disabled={busy} onChange={(event) => setAnswer(event.target.value)} />
          {mode === 'translation' && <div className="umlaut-keys" aria-label="德语特殊字符">{['ä','ö','ü','ß'].map((letter) => <button type="button" className="secondary-button" key={letter} onClick={() => insert(letter)}>{letter}</button>)}</div>}
          <button className="primary-button" disabled={busy || !answer.trim()}>提交答案</button>
        </form>}
        {feedback && <div className={`output-feedback ${feedback.correct ? 'correct' : 'wrong'}`} role="status"><strong>{feedback.correct ? '答对了' : '答错了'}</strong><p>正确答案：<span lang="de">{feedback.expected}</span></p>{mode === 'cloze' && word.exampleZh && <p>例句翻译：{word.exampleZh}</p>}<p>{feedback.correct ? 'SRS 排程保持不变。' : '已按「忘了」更新，明天复习。'}</p><button className="primary-button" onClick={nextCard}>{state?.completed ? '查看本轮结果' : '下一题'} <ArrowRight size={17} /></button></div>}
      </div>
      {speechError && <p className="error-message" role="status">{speechError}</p>}
    </>}
    {!word && !busy && !error && <div className="study-complete"><CheckCheck size={40} /><h2>{state?.completed ? '强化训练完成' : '暂无可训练的词'}</h2><p>{state?.completed ? `答对 ${state.totals.correct} 个，答错 ${state.totals.wrong} 个。` : '强化训练只取学习中的词；冠词快测只取名词。'}</p><a className="primary-button" href="#study">返回学习</a></div>}
  </section>
}
