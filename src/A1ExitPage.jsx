import {useEffect,useState} from 'react'
import {ArrowLeft,ArrowRight,Volume2} from 'lucide-react'
import {useGrammarSpeech} from './useGrammarSpeech.js'
import {A1_EXIT_GATES,a1ExitComplete,getA1ExitProgress,saveA1ExitResult} from './a1-exit-progress.js'
import {a1ExitData,A1_EXIT_LABELS,A1_EXIT_PASS_LINES,gradeA1Grammar,gradeA1Choices,gradeA1Writing,gradeA1Speaking,createA1VocabularyTest,gradeA1Vocabulary} from './a1-exit.js'

const gateLink=(gate)=>`#a1-exit-${gate}`
const scoreText=(entry)=>entry?`${entry.latest.score} / ${entry.latest.total}`:'尚未测评'

export function A1ExitSummary(){
  const progress=getA1ExitProgress()
  return <section className="insight-panel a1-exit-summary"><h2>A1 出口</h2><p>{a1ExitComplete(progress)?'A1 已完成':'六项测评全部通过后完成 A1。'}</p><div className="a1-exit-gates">{A1_EXIT_GATES.map((gate)=><a className="grammar-unit-card" key={gate} href={gateLink(gate)}><strong>{A1_EXIT_LABELS[gate]}</strong><span>{A1_EXIT_PASS_LINES[gate]}</span><em>{progress[gate]?`${progress[gate].latest.passed?'已通过':'未通过'} · ${scoreText(progress[gate])} · 尝试 ${progress[gate].attempts} 次`:'未开始'}</em><ArrowRight size={16}/></a>)}</div></section>
}

function ListeningButton({audio,clipKey,plays,setPlays,speech,speechRate,limit=Infinity}){
  const count=plays[clipKey]??0
  function play(){
    if(count>=limit)return
    setPlays((current)=>({...current,[clipKey]:(current[clipKey]??0)+1}))
    if(Array.isArray(audio))speech.sequence(audio,`exit-${clipKey}`,speechRate)
    else speech.speak(audio,`exit-${clipKey}`,speechRate)
  }
  return <div className="grammar-listening"><button type="button" className="secondary-button" onClick={play} disabled={count>=limit}><Volume2 size={17}/> 播放{Number.isFinite(limit)?`（${count}/${limit}）`:''}</button></div>
}

function ExitQuiz({gate,speechRate,onDone}){
  const speech=useGrammarSpeech()
  const [index,setIndex]=useState(0),[answers,setAnswers]=useState([]),[plays,setPlays]=useState({}),[input,setInput]=useState(''),[ordered,setOrdered]=useState([]),[error,setError]=useState('')
  const grammar=gate==='grammar'
  const questions=grammar?a1ExitData.grammar:gate==='listening'
    ?a1ExitData.listening.flatMap((part)=>part.clips.flatMap((clip)=>clip.questions.map((question)=>({...question,audio:clip.audio,clipKey:`${part.title}-${clip.audio}`}))))
    :a1ExitData.reading.flatMap((part)=>part.questions.map((question)=>({...question,reading:part.text,readingTitle:part.title})))
  const question=questions[index]
  const choice=['choice','listen_choice'].includes(question.type)||!grammar
  const isOrder=question.type==='order'
  const answer=answers[index]
  const ready=choice?Number.isInteger(answer):isOrder?ordered.length===question.tokens.length:input.trim().length>0
  function select(value){setAnswers((current)=>{const next=[...current];next[index]=value;return next})}
  function next(){
    if(!ready)return
    const value=choice?answer:isOrder?ordered:input
    const nextAnswers=[...answers];nextAnswers[index]=value;setAnswers(nextAnswers)
    speech.stop()
    if(index+1===questions.length){
      try{const result=grammar?gradeA1Grammar(nextAnswers):gradeA1Choices(gate==='listening'?a1ExitData.listening:a1ExitData.reading,nextAnswers,gate==='listening'?6:5);onDone(result)}
      catch(err){setError(err.message)}
    }else{setIndex(index+1);setInput('');setOrdered([]);setError('')}
  }
  const clipAudio=gate==='listening'&&question.audio.startsWith('— ')
    ?question.audio.split(/\s+—\s+/u).filter(Boolean).map((text,i)=>({text,rate:speechRate*(i%2?1.08:0.92)}))
    :question.audio
  return <div className="grammar-practice"><div className="study-progress"><span>{A1_EXIT_LABELS[gate]}</span><span>{index+1} / {questions.length}</span></div><progress value={index} max={questions.length}/><section className="grammar-question">
    {gate==='reading'&&<div className="grammar-extension"><strong>{question.readingTitle}</strong><p lang="de">{question.reading}</p></div>}
    {gate==='listening'&&<ListeningButton audio={clipAudio} clipKey={question.clipKey} plays={plays} setPlays={setPlays} speech={speech} speechRate={speechRate} limit={2}/>}
    {grammar&&question.type?.startsWith('listen_')&&<ListeningButton audio={question.audio} clipKey={`grammar-${index}`} plays={plays} setPlays={setPlays} speech={speech} speechRate={speechRate}/>}
    <h2>{grammar?(question.type==='listen_dictation'?'听写整句':question.q||question.display||'组句'):question.q}</h2>
    {choice&&<div className="grammar-choices">{question.options.map((option,i)=><button type="button" className={`secondary-button ${answer===i?'selected':''}`} key={i} aria-pressed={answer===i} onClick={()=>select(i)}>{option}</button>)}</div>}
    {!choice&&!isOrder&&<input lang="de" value={input} onChange={(event)=>setInput(event.target.value)} aria-label="填写德语答案" autoComplete="off"/>}
    {isOrder&&<><div className="grammar-ordered">{ordered.map((tokenIndex,i)=><button className="secondary-button" key={i} onClick={()=>setOrdered((current)=>current.filter((_,j)=>j!==i))}>{question.tokens[tokenIndex]}</button>)}</div><div className="grammar-items">{question.tokens.map((token,i)=>!ordered.includes(i)&&<button className="secondary-button" key={i} onClick={()=>setOrdered((current)=>[...current,i])}>{token}</button>)}</div></>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    <button className="primary-button" disabled={!ready} onClick={next}>{index+1===questions.length?'提交成绩':'下一题'} <ArrowRight size={16}/></button>
  </section></div>
}

function ExitWriting({onDone}){
  const fields=['Familienname','Vorname','Geburtsdatum','Geburtsort','Staatsangehörigkeit','Straße und Hausnummer','PLZ und Wohnort','Beruf','Telefonnummer','E-Mail-Adresse']
  const [values,setValues]=useState(Array(10).fill('')),[message,setMessage]=useState(''),[checks,setChecks]=useState([Array(4).fill(false),Array(4).fill(false)])
  const ready=values.every((value)=>value.trim())&&message.trim()&&checks.every((part)=>part.every(Boolean))
  return <div className="grammar-unit">{a1ExitData.writing.map((part,partIndex)=><section className="grammar-section" key={part.title}><h2>{part.title}</h2><p className="grammar-extension">{part.prompt}</p>{partIndex===0?<div className="a1-writing-fields">{fields.map((field,index)=><label key={field}>{field}<input value={values[index]} onChange={(event)=>setValues((current)=>current.map((value,i)=>i===index?event.target.value:value))}/></label>)}</div>:<textarea lang="de" rows={6} value={message} onChange={(event)=>setMessage(event.target.value)} aria-label="短信息"/>}<div className="a1-checks">{part.checks.map((check,index)=><label key={index}><input type="checkbox" checked={checks[partIndex][index]} onChange={(event)=>setChecks((current)=>current.map((items,i)=>i===partIndex?items.map((value,j)=>j===index?event.target.checked:value):items))}/>{check}</label>)}</div></section>)}<button className="primary-button" disabled={!ready} onClick={()=>onDone(gradeA1Writing([values.join(' / '),message],checks))}>提交成绩</button></div>
}

function ExitSpeaking({onDone}){
  const [ratings,setRatings]=useState(['','',''])
  return <div className="grammar-unit">{a1ExitData.speaking.map((part,index)=><section className="grammar-section" key={part.title}><h2>{part.title}</h2><p className="grammar-extension">{part.task}</p><label>自评档位<select value={ratings[index]} onChange={(event)=>setRatings((current)=>current.map((value,i)=>i===index?event.target.value:value))}><option value="">请选择</option><option>达成</option><option>勉强</option><option>未达成</option></select></label></section>)}<section className="grammar-section"><h2>评分清单</h2><p className="grammar-extension">{a1ExitData.speakingRubric.replaceAll('**','')}</p></section><button className="primary-button" disabled={ratings.some((rating)=>!rating)} onClick={()=>onDone(gradeA1Speaking(ratings))}>提交成绩</button></div>
}

function ExitVocabulary({onDone}){
  const [test,setTest]=useState(null),[error,setError]=useState(''),[index,setIndex]=useState(0),[coreAnswers,setCoreAnswers]=useState([]),[recognitionAnswers,setRecognitionAnswers]=useState([]),[input,setInput]=useState('')
  useEffect(()=>{let active=true;import('./data/a1Vocabulary.json').then(({default:words})=>{if(active)setTest(createA1VocabularyTest(words))}).catch((err)=>{if(active)setError(err.message)});return()=>{active=false}},[])
  if(error)return <p className="error-message" role="alert">{error}</p>
  if(!test)return <p role="status">正在读取 A1 词汇…</p>
  const core=index<100,position=core?index:index-100,question=core?test.core[position]:test.recognition[position]
  const choice=recognitionAnswers[position],ready=core?input.trim():Number.isInteger(choice)
  function next(){
    if(!ready)return
    if(core){const next=[...coreAnswers];next[position]=input;setCoreAnswers(next);setInput('')}
    if(index===199){
      try{onDone(gradeA1Vocabulary(test,coreAnswers,recognitionAnswers))}
      catch(err){setError(err.message)}
    }else setIndex(index+1)
  }
  return <div className="grammar-practice"><div className="study-progress"><span>{core?'核心主动 · 看中文写德语':'被动与扩展 · 认读'}</span><span>{position+1} / 100</span></div><progress value={index} max={200}/><section className="grammar-question">{core?<><h2>{question.chinese}</h2><p>{question.partOfSpeech}{question.article?' · 名词须带冠词':''}</p><input lang="de" value={input} onChange={(event)=>setInput(event.target.value)} aria-label="输入德语" autoComplete="off"/></>:<><h2 lang="de">{question.word.article&&`${question.word.article} `}{question.word.german}</h2><div className="grammar-choices">{question.options.map((option,i)=><button type="button" key={i} className={`secondary-button ${choice===i?'selected':''}`} aria-pressed={choice===i} onClick={()=>setRecognitionAnswers((current)=>{const next=[...current];next[position]=i;return next})}>{option}</button>)}</div></>}<button className="primary-button" disabled={!ready} onClick={next}>{index===199?'提交成绩':'下一题'} <ArrowRight size={16}/></button></section></div>
}

export default function A1ExitPage({route,speechRate=1}){
  const gate=route.startsWith('a1-exit-')?route.slice('a1-exit-'.length):null
  const [progress,setProgress]=useState(getA1ExitProgress),[result,setResult]=useState(null),[revision,setRevision]=useState(0)
  function done(value){try{saveA1ExitResult(gate,value);setProgress(getA1ExitProgress());setResult(value)}catch(err){setResult({error:err.message})}}
  if(!gate||!A1_EXIT_GATES.includes(gate))return <A1ExitSummary/>
  if(result)return <div className="grammar-result"><h2>{result.error?'保存失败':`${A1_EXIT_LABELS[gate]} · ${result.passed?'已通过':'未通过'}`}</h2>{result.error?<p role="alert">{result.error}</p>:<><p className="grammar-score">{result.score} / {result.total}</p>{gate==='grammar'&&<p>格体系 {result.caseScore} / 9 · 时态 {result.tenseScore} / 4</p>}{gate==='vocabulary'&&<p>核心产出 {result.coreScore} / 100 · 认读 {result.recognitionScore} / 100</p>}</>}<div className="a1-exit-actions"><a className="secondary-button" href="#a1-exit">返回 A1 出口</a><button className="primary-button" onClick={()=>{setResult(null);setRevision((value)=>value+1)}}>再测一次</button></div></div>
  return <div className="a1-exit-page" key={`${gate}-${revision}`}><a className="text-button" href="#a1-exit"><ArrowLeft size={16}/>返回 A1 出口</a><div className="grammar-unit-title"><span>A1 出口 · 尝试 {progress[gate]?.attempts??0} 次</span><h2>{A1_EXIT_LABELS[gate]}</h2><p>{A1_EXIT_PASS_LINES[gate]}</p></div>{['grammar','listening','reading'].includes(gate)?<ExitQuiz gate={gate} speechRate={speechRate} onDone={done}/>:gate==='writing'?<ExitWriting onDone={done}/>:gate==='speaking'?<ExitSpeaking onDone={done}/>:<ExitVocabulary onDone={done}/>}</div>
}
