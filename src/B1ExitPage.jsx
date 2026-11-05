import {useEffect,useState} from 'react'
import {ArrowLeft,ArrowRight,Volume2} from 'lucide-react'
import {useGrammarSpeech} from './useGrammarSpeech.js'
import {B1_EXIT_GATES,B1_EXIT_LABELS,B1_EXIT_PASS_LINES,B1_GRAMMAR_GROUPS,B1_GRAMMAR_REVIEW,b1ExitData,b1ListeningSegments,createB1GrammarTest,gradeB1Grammar,gradeB1Choices,gradeB1Writing,gradeB1Speaking,createB1VocabularyTest,gradeB1Vocabulary} from './b1-exit.js'
import {b1ExitComplete,getB1ExitProgress,saveB1ExitResult} from './b1-exit-progress.js'

export function B1ExitSummary(){
  const progress=getB1ExitProgress()
  return <section className="insight-panel a1-exit-summary"><h2>B1 出口</h2><p>{b1ExitComplete(progress)?`B1 完成 · ${new Date(progress.completedAt).toLocaleDateString('zh-CN')}`:'六项测评全部通过后完成 B1。'}</p><div className="b1-exit-gates">{B1_EXIT_GATES.map((gate)=><div className="b1-exit-gate" key={gate}><strong>{B1_EXIT_LABELS[gate]}</strong><span>{B1_EXIT_PASS_LINES[gate]}</span><progress max="1" value={progress[gate]?.passedEver?1:0} aria-label={`${B1_EXIT_LABELS[gate]}进度`}/><em>{progress[gate]?`${progress[gate].passedEver?'已通过':'未通过'} · 最近 ${progress[gate].latest.score}/${progress[gate].latest.total} · 最好 ${progress[gate].best.score}/${progress[gate].best.total} · 最近 ${new Date(progress[gate].latest.at).toLocaleDateString('zh-CN')} · 尝试 ${progress[gate].attempts} 次`:'未开始'}</em><a className="secondary-button" href={`#b1-exit-${gate}`}>进入测评 <ArrowRight size={16}/></a>{progress[gate]&&!progress[gate].passedEver&&<div className="a1-exit-actions">{gate==='grammar'?B1_GRAMMAR_GROUPS.filter((group)=>progress[gate].latest.groupScores?.[group]<10).flatMap((group)=>B1_GRAMMAR_REVIEW[group].map((id)=><a key={`${group}-${id}`} href={`#grammar-${id}`}>{group} · {id}</a>)):gate==='vocabulary'?<><a href="#wordbooks">B1 分层词书</a><a href="#data-library?level=B1&layer=核心主动">核心主动</a><a href="#data-library?level=B1&layer=被动认读">被动认读</a><a href="#data-library?level=B1&layer=扩展认读">扩展认读</a></>:null}</div>}</div>)}</div></section>
}

function B1Quiz({gate,onDone,speechRate}){
  const speech=useGrammarSpeech()
  const [grammarTest]=useState(()=>gate==='grammar'?createB1GrammarTest():null)
  const questions=gate==='grammar'?grammarTest:gate==='listening'
    ?b1ExitData.listening.flatMap((part)=>part.questions.map((question)=>({...question,audio:part.text,clipKey:part.id})))
    :b1ExitData.reading.flatMap((part)=>part.questions.map((question)=>({...question,reading:part.text,readingTitle:part.title})))
  const [index,setIndex]=useState(0),[answers,setAnswers]=useState([]),[selectedItem,setSelectedItem]=useState(null),[error,setError]=useState('')
  const question=questions[index]
  const answer=answers[index]
  function select(value){setAnswers((current)=>{const next=[...current];next[index]=value;return next})}
  const ready=question.type==='choice'?Number.isInteger(answer)
    :question.type==='fill'?typeof answer==='string'&&!!answer.trim()
    :question.type==='order'?Array.isArray(answer)&&answer.length===question.tokens.length
    :question.type==='classify'?Array.isArray(answer)&&answer.length===question.items.length&&Array.from(answer).every(Number.isInteger):false
  function next(){
    if(!ready)return
    speech.stop()
    if(index+1===questions.length){
      try{onDone(gate==='grammar'?gradeB1Grammar(grammarTest,answers):gradeB1Choices(gate,answers))}
      catch(err){setError(err.message)}
    }else{setIndex(index+1);setSelectedItem(null);setError('')}
  }
  return <div className="grammar-practice"><div className="study-progress"><span>{B1_EXIT_LABELS[gate]}</span><span>{index+1} / {questions.length}</span></div><progress value={index} max={questions.length}/><section className="grammar-question">
    {gate==='reading'&&<div className="grammar-extension b1-exit-reading"><strong>{question.readingTitle}</strong><p lang="de" style={{whiteSpace:'pre-line'}}>{question.reading}</p></div>}
    {gate==='listening'&&<div className="grammar-listening"><button type="button" className="secondary-button" onClick={()=>speech.sequence(b1ListeningSegments(question.audio),`b1-exit-${question.clipKey}`,speechRate)}><Volume2 size={17}/> 播放整段</button></div>}
    <h2>{question.q}</h2>{question.display&&<p className="grammar-extension" lang="de">{question.display}</p>}
    {question.type==='choice'&&<div className="grammar-choices">{question.options.map((option,i)=><button type="button" className={`secondary-button ${answer===i?'selected':''}`} aria-pressed={answer===i} key={i} onClick={()=>select(i)}>{option}</button>)}</div>}
    {question.type==='fill'&&<input lang="de" value={answer??''} onChange={(event)=>select(event.target.value)} aria-label="填写德语答案" autoComplete="off"/>}
    {question.type==='order'&&<><div className="grammar-ordered" aria-label="已组成的句子">{(answer??[]).map((tokenIndex,position)=><button key={position} type="button" className="secondary-button" onClick={()=>select(answer.filter((_,i)=>i!==position))}>{question.tokens[tokenIndex]}</button>)}</div><div className="grammar-items">{question.tokens.map((token,tokenIndex)=>!(answer??[]).includes(tokenIndex)&&<button key={tokenIndex} type="button" className="secondary-button" onClick={()=>select([...(answer??[]),tokenIndex])}>{token}</button>)}</div></>}
    {question.type==='classify'&&<><div className="grammar-items">{question.items.map((item,itemIndex)=><button key={itemIndex} type="button" className={`secondary-button ${selectedItem===itemIndex?'selected':''}`} onClick={()=>setSelectedItem(itemIndex)}>{item.text}{answer?.[itemIndex]!==undefined&&<small> → {question.groups[answer[itemIndex]]}</small>}</button>)}</div><div className="grammar-groups">{question.groups.map((group,groupIndex)=><button key={groupIndex} type="button" className="secondary-button" disabled={selectedItem===null} onClick={()=>{const updated=Array.isArray(answer)?[...answer]:Array(question.items.length);updated[selectedItem]=groupIndex;select(updated);setSelectedItem(null)}}>{group}</button>)}</div></>}
    {error&&<p role="alert" className="error-message">{error}</p>}
    <button className="primary-button" disabled={!ready} onClick={next}>{index+1===questions.length?'提交成绩':'下一题'} <ArrowRight size={16}/></button>
  </section></div>
}

function B1Writing({onDone}){
  const [values,setValues]=useState(['',''])
  const [checks,setChecks]=useState(b1ExitData.writing.map((part)=>part.checks.map(()=>false)))
  const ready=values.every((value)=>value.trim())&&checks.every((part)=>part.every(Boolean))
  return <div className="grammar-unit">{b1ExitData.writing.map((part,partIndex)=><section className="grammar-section" key={part.title}><h2>{part.title}</h2><p className="grammar-extension">{part.prompt}</p><textarea lang="de" rows={8} value={values[partIndex]} onChange={(event)=>setValues((current)=>current.map((value,index)=>index===partIndex?event.target.value:value))} aria-label={part.title}/><details className="grammar-sample"><summary>看参考范文</summary><p lang="de" style={{whiteSpace:'pre-line'}}>{part.sample}</p></details><div className="a1-checks">{part.checks.map((check,index)=><label key={index}><input type="checkbox" checked={checks[partIndex][index]} onChange={(event)=>setChecks((current)=>current.map((items,i)=>i===partIndex?items.map((value,j)=>j===index?event.target.checked:value):items))}/>{check}</label>)}</div></section>)}<button className="primary-button" disabled={!ready} onClick={()=>onDone(gradeB1Writing(values,checks))}>提交成绩</button></div>
}

function B1Speaking({onDone}){
  const [ratings,setRatings]=useState(['','',''])
  return <div className="grammar-unit">{b1ExitData.speaking.map((part,index)=><section className="grammar-section" key={part.title}><h2>{part.title}</h2><p className="grammar-extension b1-exit-reading" style={{whiteSpace:'pre-line'}}>{part.task}</p><label>自评档位<select value={ratings[index]} onChange={(event)=>setRatings((current)=>current.map((value,i)=>i===index?event.target.value:value))}><option value="">请选择</option><option>未达成</option><option>达成</option><option>出色</option></select></label></section>)}<button className="primary-button" disabled={ratings.some((rating)=>!rating)} onClick={()=>onDone(gradeB1Speaking(ratings))}>提交成绩</button></div>
}

function B1Vocabulary({onDone}){
  const [test,setTest]=useState(null),[error,setError]=useState(''),[index,setIndex]=useState(0)
  const [coreAnswers,setCoreAnswers]=useState([]),[recognitionAnswers,setRecognitionAnswers]=useState([]),[input,setInput]=useState('')
  useEffect(()=>{let active=true;fetch('/wordbooks/goethe-b1.json').then((response)=>{if(!response.ok)throw new Error('B1 词书读取失败。');return response.json()})
    .then((book)=>{if(active)setTest(createB1VocabularyTest(book.words))}).catch((err)=>{if(active)setError(err.message)});return()=>{active=false}},[])
  if(error)return <p role="alert" className="error-message">{error}</p>
  if(!test)return <p role="status">正在读取 B1 词汇…</p>
  const core=index<120,position=core?index:index-120,question=core?test.core[position]:test.recognition[position]
  const choice=recognitionAnswers[position],ready=core?input.trim():Number.isInteger(choice)
  function next(){
    if(!ready)return
    if(core){const updated=[...coreAnswers];updated[position]=input;setCoreAnswers(updated);setInput('')}
    if(index===239){
      const completedRecognition=[...recognitionAnswers];completedRecognition[position]=choice
      try{onDone(gradeB1Vocabulary(test,coreAnswers,completedRecognition))}
      catch(err){setError(err.message)}
    }else setIndex(index+1)
  }
  return <div className="grammar-practice"><div className="study-progress"><span>{core?'核心主动 · 看中文写德语':'被动与扩展 · 认读'}</span><span>{position+1} / 120</span></div><progress value={index} max={240}/><section className="grammar-question">{core?<><h2>{question.chinese}</h2><p>{question.partOfSpeech}{question.article?' · 名词须带冠词':''}</p><input lang="de" value={input} onChange={(event)=>setInput(event.target.value)} aria-label="输入德语" autoComplete="off"/></>:<><h2 lang="de">{question.word.article&&`${question.word.article} `}{question.word.german}</h2><div className="grammar-choices">{question.options.map((option,i)=><button type="button" key={i} className={`secondary-button ${choice===i?'selected':''}`} aria-pressed={choice===i} onClick={()=>setRecognitionAnswers((current)=>{const updated=[...current];updated[position]=i;return updated})}>{option}</button>)}</div></>}<button className="primary-button" disabled={!ready} onClick={next}>{index===239?'提交成绩':'下一题'} <ArrowRight size={16}/></button></section></div>
}

export default function B1ExitPage({route,speechRate=1}){
  const gate=route.startsWith('b1-exit-')?route.slice('b1-exit-'.length):null
  const [result,setResult]=useState(null),[revision,setRevision]=useState(0)
  function done(value){try{saveB1ExitResult(gate,value);setResult(value)}catch(err){setResult({error:err.message})}}
  if(!gate||!B1_EXIT_GATES.includes(gate))return <B1ExitSummary/>
  if(result)return <div className="grammar-result"><h2>{result.error?'保存失败':`${B1_EXIT_LABELS[gate]} · ${result.passed?'已通过':'未通过'}`}</h2>{result.error?<p role="alert">{result.error}</p>:<><p className="grammar-score">{result.score} / {result.total}</p>{gate==='grammar'&&<><p>{B1_GRAMMAR_GROUPS.map((group)=>`${group} ${result.groupScores[group]}/10`).join(' · ')}</p><div className="a1-exit-actions">{B1_GRAMMAR_GROUPS.filter((group)=>result.groupScores[group]<10).flatMap((group)=>B1_GRAMMAR_REVIEW[group].map((id)=><a key={`${group}-${id}`} href={`#grammar-${id}`}>{group} · {id}</a>))}</div></>}{gate==='vocabulary'&&<><p>核心输出 {result.coreScore}/120 · 认读 {result.recognitionScore}/120</p><div className="a1-exit-actions"><a href="#wordbooks">B1 分层词书</a><a href="#data-library?level=B1&layer=核心主动">核心主动</a><a href="#data-library?level=B1&layer=被动认读">被动认读</a><a href="#data-library?level=B1&layer=扩展认读">扩展认读</a></div></>}</>}<div className="a1-exit-actions"><a className="secondary-button" href="#b1-exit">返回 B1 出口</a><button className="primary-button" onClick={()=>{setResult(null);setRevision((value)=>value+1)}}>再测一次</button></div></div>
  return <div className="a1-exit-page" key={`${gate}-${revision}`}><a className="text-button" href="#b1-exit"><ArrowLeft size={16}/>返回 B1 出口</a><div className="grammar-unit-title"><span>B1 出口 · 尝试 {getB1ExitProgress()[gate]?.attempts??0} 次</span><h2>{B1_EXIT_LABELS[gate]}</h2><p>{B1_EXIT_PASS_LINES[gate]}</p></div>{['grammar','listening','reading'].includes(gate)?<B1Quiz gate={gate} speechRate={speechRate} onDone={done}/>:gate==='writing'?<B1Writing onDone={done}/>:gate==='speaking'?<B1Speaking onDone={done}/>:<B1Vocabulary onDone={done}/>}</div>
}
