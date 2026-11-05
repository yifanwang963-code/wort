import {useEffect,useState} from 'react'
import {ArrowLeft,ArrowRight,Volume2} from 'lucide-react'
import {useGrammarSpeech} from './useGrammarSpeech.js'
import {getGrammarProgress} from './grammar-progress.js'
import {grammarUnits} from './grammar.js'
import {A2_EXIT_GATES,A2_EXIT_LABELS,A2_EXIT_PASS_LINES,a2ExitData,createA2GrammarTest,gradeA2Grammar,gradeA2Choices,gradeA2Writing,gradeA2Speaking,createA2VocabularyTest,gradeA2Vocabulary} from './a2-exit.js'
import {a2ExitComplete,getA2ExitProgress,saveA2ExitResult} from './a2-exit-progress.js'

export function a2ExitAvailable(progress=getGrammarProgress()){
  return grammarUnits.filter((unit)=>unit.level==='A2').every((unit)=>progress[unit.id]?.done)
}
export function A2ExitSummary(){
  if(!a2ExitAvailable())return null
  const progress=getA2ExitProgress()
  return <section className="insight-panel a1-exit-summary"><h2>A2 出口</h2><p>{a2ExitComplete(progress)?'A2 完成':'六项测评全部通过后完成 A2。'}</p><div className="a1-exit-gates">{A2_EXIT_GATES.map((gate)=><a className="grammar-unit-card" key={gate} href={`#a2-exit-${gate}`}><strong>{A2_EXIT_LABELS[gate]}</strong><span>{A2_EXIT_PASS_LINES[gate]}</span><em>{progress[gate]?`${progress[gate].passedEver?'已通过':'未通过'} · 最高 ${progress[gate].best.score}/${progress[gate].best.total} · 尝试 ${progress[gate].attempts} 次`:'未开始'}</em><ArrowRight size={16}/></a>)}</div></section>
}

function A2Quiz({gate,onDone,speechRate}){
  const speech=useGrammarSpeech()
  const [grammarTest]=useState(()=>gate==='grammar'?createA2GrammarTest():null)
  const questions=gate==='grammar'?grammarTest:gate==='listening'
    ?a2ExitData.listening.flatMap((part)=>part.questions.map((question)=>({...question,audio:part.text,clipKey:part.id})))
    :a2ExitData.reading.flatMap((part)=>part.questions.map((question)=>({...question,reading:part.text,readingTitle:part.title})))
  const [index,setIndex]=useState(0),[answers,setAnswers]=useState([]),[plays,setPlays]=useState({}),[error,setError]=useState('')
  const question=questions[index]
  const answer=answers[index]
  function select(value){setAnswers((current)=>{const next=[...current];next[index]=value;return next})}
  function next(){
    if(!Number.isInteger(answer))return
    speech.stop()
    if(index+1===questions.length){
      try{onDone(gate==='grammar'?gradeA2Grammar(grammarTest,answers):gradeA2Choices(gate,answers))}
      catch(err){setError(err.message)}
    }else{setIndex(index+1);setError('')}
  }
  function play(){
    const key=question.clipKey
    if((plays[key]??0)>=2)return
    setPlays((current)=>({...current,[key]:(current[key]??0)+1}))
    speech.speak(question.audio,`a2-exit-${key}`,speechRate)
  }
  return <div className="grammar-practice"><div className="study-progress"><span>{A2_EXIT_LABELS[gate]}</span><span>{index+1} / {questions.length}</span></div><progress value={index} max={questions.length}/><section className="grammar-question">
    {gate==='reading'&&<div className="grammar-extension a2-exit-reading"><strong>{question.readingTitle}</strong><p lang="de">{question.reading}</p></div>}
    {gate==='listening'&&<div className="grammar-listening"><button type="button" className="secondary-button" onClick={play} disabled={(plays[question.clipKey]??0)>=2}><Volume2 size={17}/> 播放（{plays[question.clipKey]??0}/2）</button></div>}
    <h2>{question.q}</h2><div className="grammar-choices">{question.options.map((option,i)=><button type="button" className={`secondary-button ${answer===i?'selected':''}`} aria-pressed={answer===i} key={i} onClick={()=>select(i)}>{option}</button>)}</div>
    {error&&<p role="alert" className="error-message">{error}</p>}
    <button className="primary-button" disabled={!Number.isInteger(answer)} onClick={next}>{index+1===questions.length?'提交成绩':'下一题'} <ArrowRight size={16}/></button>
  </section></div>
}

function A2Writing({onDone}){
  const [values,setValues]=useState(['',''])
  const [checks,setChecks]=useState(a2ExitData.writing.map((part)=>part.checks.map(()=>false)))
  const ready=values.every((value)=>value.trim())&&checks.every((part)=>part.every(Boolean))
  return <div className="grammar-unit">{a2ExitData.writing.map((part,partIndex)=><section className="grammar-section" key={part.title}><h2>{part.title}</h2><p className="grammar-extension">{part.prompt}</p><textarea lang="de" rows={8} value={values[partIndex]} onChange={(event)=>setValues((current)=>current.map((value,index)=>index===partIndex?event.target.value:value))} aria-label={part.title}/><div className="a1-checks">{part.checks.map((check,index)=><label key={index}><input type="checkbox" checked={checks[partIndex][index]} onChange={(event)=>setChecks((current)=>current.map((items,i)=>i===partIndex?items.map((value,j)=>j===index?event.target.checked:value):items))}/>{check}</label>)}</div></section>)}<button className="primary-button" disabled={!ready} onClick={()=>onDone(gradeA2Writing(values,checks))}>提交成绩</button></div>
}

function A2Speaking({onDone}){
  const [ratings,setRatings]=useState(['','',''])
  return <div className="grammar-unit">{a2ExitData.speaking.map((part,index)=><section className="grammar-section" key={part.title}><h2>{part.title}</h2><p className="grammar-extension a2-exit-reading">{part.task}</p><label>自评档位<select value={ratings[index]} onChange={(event)=>setRatings((current)=>current.map((value,i)=>i===index?event.target.value:value))}><option value="">请选择</option><option>达成</option><option>基本达成</option><option>未达成</option></select></label></section>)}<section className="grammar-section"><h2>档位标准</h2><p className="grammar-extension">{a2ExitData.speakingRubric}</p></section><button className="primary-button" disabled={ratings.some((rating)=>!rating)} onClick={()=>onDone(gradeA2Speaking(ratings))}>提交成绩</button></div>
}

function A2Vocabulary({onDone}){
  const [test,setTest]=useState(null),[error,setError]=useState(''),[index,setIndex]=useState(0)
  const [coreAnswers,setCoreAnswers]=useState([]),[recognitionAnswers,setRecognitionAnswers]=useState([]),[input,setInput]=useState('')
  useEffect(()=>{let active=true;fetch('/wordbooks/goethe-a2.json').then((response)=>{if(!response.ok)throw new Error('A2 词书读取失败。');return response.json()})
    .then((book)=>{if(active)setTest(createA2VocabularyTest(book.words))}).catch((err)=>{if(active)setError(err.message)});return()=>{active=false}},[])
  if(error)return <p role="alert" className="error-message">{error}</p>
  if(!test)return <p role="status">正在读取 A2 词汇…</p>
  const core=index<100,position=core?index:index-100,question=core?test.core[position]:test.recognition[position]
  const choice=recognitionAnswers[position],ready=core?input.trim():Number.isInteger(choice)
  function next(){
    if(!ready)return
    if(core){const updated=[...coreAnswers];updated[position]=input;setCoreAnswers(updated);setInput('')}
    if(index===199){
      try{onDone(gradeA2Vocabulary(test,coreAnswers,recognitionAnswers))}
      catch(err){setError(err.message)}
    }else setIndex(index+1)
  }
  return <div className="grammar-practice"><div className="study-progress"><span>{core?'核心主动 · 看中文写德语':'被动与扩展 · 认读'}</span><span>{position+1} / 100</span></div><progress value={index} max={200}/><section className="grammar-question">{core?<><h2>{question.chinese}</h2><p>{question.partOfSpeech}{question.article?' · 名词须带冠词':''}</p><input lang="de" value={input} onChange={(event)=>setInput(event.target.value)} aria-label="输入德语" autoComplete="off"/></>:<><h2 lang="de">{question.word.article&&`${question.word.article} `}{question.word.german}</h2><div className="grammar-choices">{question.options.map((option,i)=><button type="button" key={i} className={`secondary-button ${choice===i?'selected':''}`} aria-pressed={choice===i} onClick={()=>setRecognitionAnswers((current)=>{const updated=[...current];updated[position]=i;return updated})}>{option}</button>)}</div></>}<button className="primary-button" disabled={!ready} onClick={next}>{index===199?'提交成绩':'下一题'} <ArrowRight size={16}/></button></section></div>
}

export default function A2ExitPage({route,speechRate=1}){
  const gate=route.startsWith('a2-exit-')?route.slice('a2-exit-'.length):null
  const [result,setResult]=useState(null),[revision,setRevision]=useState(0)
  if(!a2ExitAvailable())return <p className="pack-empty">完成 A2 语法 29 课后开放出口测评。</p>
  function done(value){try{saveA2ExitResult(gate,value);setResult(value)}catch(err){setResult({error:err.message})}}
  if(!gate||!A2_EXIT_GATES.includes(gate))return <A2ExitSummary/>
  if(result)return <div className="grammar-result"><h2>{result.error?'保存失败':`${A2_EXIT_LABELS[gate]} · ${result.passed?'已通过':'未通过'}`}</h2>{result.error?<p role="alert">{result.error}</p>:<><p className="grammar-score">{result.score} / {result.total}</p>{gate==='grammar'&&<p>时态 {result.groupScores.时态组}/9 · 从句 {result.groupScores.从句组}/9 · 词尾 {result.groupScores.词尾组}/9</p>}{gate==='vocabulary'&&<p>核心产出 {result.coreScore}/100 · 认读 {result.recognitionScore}/100</p>}</>}<div className="a1-exit-actions"><a className="secondary-button" href="#a2-exit">返回 A2 出口</a><button className="primary-button" onClick={()=>{setResult(null);setRevision((value)=>value+1)}}>再测一次</button></div></div>
  return <div className="a1-exit-page" key={`${gate}-${revision}`}><a className="text-button" href="#a2-exit"><ArrowLeft size={16}/>返回 A2 出口</a><div className="grammar-unit-title"><span>A2 出口 · 尝试 {getA2ExitProgress()[gate]?.attempts??0} 次</span><h2>{A2_EXIT_LABELS[gate]}</h2><p>{A2_EXIT_PASS_LINES[gate]}</p></div>{['grammar','listening','reading'].includes(gate)?<A2Quiz gate={gate} speechRate={speechRate} onDone={done}/>:gate==='writing'?<A2Writing onDone={done}/>:gate==='speaking'?<A2Speaking onDone={done}/>:<A2Vocabulary onDone={done}/>}</div>
}
