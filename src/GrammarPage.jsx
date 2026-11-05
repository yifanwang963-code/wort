import { useLayoutEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Play, Volume2 } from 'lucide-react'
import { gradeExercise, grammarUnits } from './grammar.js'
import { grammarComparisons } from './grammar-expansion.js'
import {grammarScenarios} from './grammar-scenarios.js'
import {adjacentLesson,availableGrammarLevels,grammarLessonsForLevel,lessonLevel,readGrammarLevel,saveGrammarLevel,scenarioLessonsForLevel,visibleGrammarLessons,visibleScenarioLessons} from './grammar-navigation.js'
import { getGrammarProgress, saveGrammarResult } from './grammar-progress.js'
import { splitSentences, spokenWordCount, tableCellAudio } from './grammar-audio.js'
import { useGrammarSpeech } from './useGrammarSpeech.js'

const spokenText=(value)=>value.replaceAll('**','').replace(/(^|\s)\/(?=\s|$)/gu,(_,prefix)=>prefix?',':'').trim()
function markedText(value){
  return value.split(/(\*\*[^*]+\*\*)/gu).flatMap((part,index)=>part.startsWith('**')&&part.endsWith('**')?[<strong key={index}>{part.slice(2,-2)}</strong>]:part.split(/(\[[^\]]*[ʔɐəɛɪʊʏɔøœçŋʃʒɑɡːˈˌ][^\]]*\])/gu).map((piece,pieceIndex)=>piece.startsWith('[')&&piece.endsWith(']')?<span className="ipa" key={`${index}-${pieceIndex}`}>{piece}</span>:piece))
}
const sectionNames={'彩色总表':'FARBTAFEL','规则要点':'REGELN','例句':'BEISPIELE','易错点':'FEHLERQUELLEN','练习':'ÜBUNGEN','短文':'LESEN','阅读':'LESEN','写作':'SCHREIBEN','补充短文':'LESEN','短对话跟读':'DIALOG','口头任务卡':'SPRECHEN','场景导入':'SITUATION','对话':'DIALOG','重点表达':'AUSDRÜCKE','高频句块':'REDEMITTEL','标注任务':'AUFGABE'}
function SectionTitle({children}){return <h2>{sectionNames[children]??'DEUTSCH'} · {children}</h2>}

function grammarGenderColumn(table,columnIndex) {
  const header=table.headers[columnIndex] || ''
  return ['der','die','das'].find((article)=>header.includes(`${article} 类`)) || ''
}

function GrammarTable({table,tableIndex,speech,speechRate}) {
  const highlighted=new Set(table.hl.map(([row,column])=>`${row}:${column}`))
  return <div className="grammar-table-wrap"><table className="grammar-table"><caption>{table.caption}</caption><thead><tr>{table.headers.map((header,index)=><th key={index} className={grammarGenderColumn(table,index)}>{header}</th>)}</tr></thead><tbody>{table.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,columnIndex)=>{const items=tableCellAudio(table,rowIndex,columnIndex);return <td key={columnIndex} className={[highlighted.has(`${rowIndex}:${columnIndex}`)?'highlighted':'',grammarGenderColumn(table,columnIndex)].filter(Boolean).join(' ')}>{items.length?<div className={items.length>1?'grammar-table-audio-list':''}>{items.map((item,itemIndex)=>{const kind=`table-${tableIndex}-${rowIndex}-${columnIndex}-${itemIndex}`;return <span key={itemIndex}><button type="button" className={`grammar-table-audio ${speech.active?.kind===kind?'speaking':''}`} onClick={()=>speech.speak(item.speak,kind,speechRate)} aria-label={`朗读 ${item.speak}`}>{markedText(item.label)}</button>{itemIndex<items.length-1?', ':''}</span>})}</div>:markedText(cell)}</td>})}</tr>)}</tbody></table></div>
}

function Reading({reading,speech,speechRate,label='短文'}) {
  const [selected,setSelected]=useState({})
  const sentences=reading.preserveLines?reading.text.split('\n').filter((line)=>line.trim()):splitSentences(reading.text)
  return <section className="grammar-section">
    <div className="grammar-section-heading"><SectionTitle>{label}</SectionTitle><button type="button" className="secondary-button" onClick={()=>speech.sequence(sentences.map(spokenText),'reading',speechRate)}><Play size={14}/>连听全文</button></div>
    <div className="grammar-spoken-lines">{reading.parts?.length>1
      ? reading.parts.map((part,index)=><div key={index}><span><strong>{part.label}：</strong><span lang="de">{markedText(part.text)}</span></span><button type="button" className="icon-button" onClick={()=>speech.speak(spokenText(part.text),`reading-part-${index}`,speechRate)} aria-label={`朗读${part.label}`}><Volume2 size={18}/></button></div>)
      : sentences.map((sentence,index)=><div key={index} className={speech.active?.kind==='reading'&&speech.active.index===index||speech.active?.kind===`reading-single-${index}`?'speaking':''}><span lang="de">{markedText(sentence)}</span><button type="button" className="icon-button" onClick={()=>speech.speak(spokenText(sentence),`reading-single-${index}`,speechRate)} aria-label={`朗读短文第 ${index+1} 句`}><Volume2 size={18}/></button></div>)}
    </div>
    {reading.tasks&&<p className="grammar-extension grammar-reading-tasks">{reading.tasks}</p>}
    <div className="grammar-reading-questions">{reading.questions.map((question,index)=><div key={index}><h3>{index+1}. {question.q}</h3><div className="grammar-choices">{question.options.map((option,optionIndex)=><button key={optionIndex} type="button" className="secondary-button" disabled={selected[index]!==undefined} onClick={()=>setSelected((current)=>({...current,[index]:optionIndex}))}>{option}</button>)}</div>{selected[index]!==undefined&&<p role="status" className={selected[index]===question.answer?'grammar-correct':'grammar-incorrect'}>{selected[index]===question.answer?'正确':'答错了'} · {question.explain}</p>}</div>)}</div>
  </section>
}

function PronunciationGroups({groups,speech,speechRate}) {
  return <div className="grammar-pronunciation-grid">{groups.map((group,index)=><div className="grammar-pronunciation-group" key={index}><h3>{group.title}</h3><p>{group.tip}</p><div>{group.words.map((word,wordIndex)=><button type="button" key={wordIndex} className="secondary-button" onClick={()=>speech.speak(word.speak,`sound-${index}-${wordIndex}`,speechRate)} aria-label={`朗读 ${word.label}`}><span>{word.label}</span>{word.source==='课程补充'&&<small>课程补充</small>}<Volume2 size={14}/></button>)}</div></div>)}</div>
}

function PronunciationDialogues({dialogues,speech,speechRate}) {
  return <section className="grammar-section"><SectionTitle>短对话跟读</SectionTitle>{dialogues.map((dialogue,dialogueIndex)=><div className="grammar-dialogue" key={dialogueIndex}><div className="grammar-section-heading"><h3>{dialogue.title}</h3><button className="secondary-button" onClick={()=>speech.sequence(dialogue.lines,`dialogue-${dialogueIndex}`,speechRate)}><Play size={14}/>连听对话</button></div><div className="grammar-spoken-lines">{dialogue.lines.map((line,lineIndex)=><div key={lineIndex} className={speech.active?.kind===`dialogue-${dialogueIndex}`&&speech.active.index===lineIndex?'speaking':''}><span lang="de">{line}</span><button type="button" className="icon-button" onClick={()=>speech.speak(line,`dialogue-single-${dialogueIndex}-${lineIndex}`,speechRate)} aria-label={`朗读${dialogue.title}第 ${lineIndex+1} 句`}><Volume2 size={18}/></button></div>)}</div></div>)}</section>
}

function LessonNavigation({lesson}){
  const {previous,next}=adjacentLesson(lesson)
  if(!previous&&!next)return null
  return <nav className="grammar-lesson-navigation" aria-label="课程导航">
    {previous&&<a className="secondary-button" href={`#grammar-${previous.id}`}><ArrowLeft size={17}/> 上一课：{previous.title}</a>}
    {next&&<a className="secondary-button" href={`#grammar-${next.id}`}>下一课：{next.title} <ArrowRight size={17}/></a>}
  </nav>
}

function LevelSelector({levels,selected,onSelect}){
  return <div className="grammar-level-selector" role="group" aria-label="选择课程级别">
    {levels.map((level)=><button key={level} type="button" aria-pressed={selected===level} className={selected===level?'selected':''} onClick={()=>onSelect(level)}>{level}</button>)}
  </div>
}

function GrammarUnit({unit,speechRate}) {
  const speech=useGrammarSpeech()
  const sampleSentences=unit.id==='t-a2-01'||unit.id==='t-b1-04'||['t-b2-05','t-b2-06'].includes(unit.id)||unit.id.startsWith('p-b1-')?unit.writing.sample.replace(/^范文：/u,'').split('\n').filter((line)=>line.trim()):splitSentences(unit.writing.sample)
  const scenario=unit.id.startsWith('s-')
  return <div className="grammar-unit"><a href={scenario?'#grammar-scenarios':'#grammar'} className="text-button"><ArrowLeft size={16}/>返回{scenario?'情景课':'语法'}</a><div className="grammar-unit-title"><span>{scenario?`情景课 · S${unit.order}`:`${unit.level} · ${String(unit.level==='A1'?grammarUnits.indexOf(unit)+1:unit.order).padStart(2,'0')}`}</span><h2>{unit.title}</h2>{unit.titleDe&&<p lang="de">{unit.titleDe}</p>}{unit.recommended&&<p>建议先学完：{unit.recommended}</p>}</div>
    <section className="grammar-section"><SectionTitle>彩色总表</SectionTitle><GrammarTable table={unit.table} tableIndex={0} speech={speech} speechRate={speechRate}/>{!unit.extraTablesAfterRules&&unit.extraTables.map((table,index)=><GrammarTable table={table} tableIndex={index+1} speech={speech} speechRate={speechRate} key={index}/>)}</section>
    {(unit.rules.length||unit.extensionContent?.length||unit.soundGroups||unit.audioChips?.length||unit.extraTablesAfterRules)&&<section className="grammar-section">{unit.rules.length>0&&<><SectionTitle>规则要点</SectionTitle><ul className="grammar-lines">{unit.rules.map((rule,index)=><li key={index}>{markedText(rule)}</li>)}</ul></>}{unit.extraTablesAfterRules&&unit.extraTables.map((table,index)=><GrammarTable table={table} tableIndex={index+1} speech={speech} speechRate={speechRate} key={index}/>)}{unit.extensionContent?.map((content,index)=><p className="grammar-extension" key={index}>{content}</p>)}{unit.soundGroups&&<PronunciationGroups groups={unit.soundGroups} speech={speech} speechRate={speechRate}/>}{unit.audioChips?.map((group,index)=><div className="grammar-chip-group" key={index}><h3>{group.group}</h3><div>{group.items.map((item)=><button type="button" key={item.label} className="secondary-button" onClick={()=>speech.speak(item.speak,`chip-${item.label}`,speechRate)}>{item.label} <Volume2 size={15}/></button>)}</div></div>)}</section>}
    <section className="grammar-section"><div className="grammar-section-heading"><SectionTitle>例句</SectionTitle><button type="button" className="secondary-button" onClick={()=>speech.sequence(unit.examples.map((example)=>spokenText(example.de.replaceAll('|',''))),'examples',speechRate)}><Play size={14}/>连听全部</button></div><div className={`grammar-examples ${unit.id==='t-a2-01'?'grammar-email-example':''}`}>{unit.examples.map((example,index)=><div key={index} className={speech.active?.kind==='examples'&&speech.active.index===index||speech.active?.kind===`example-single-${index}`?'speaking':''}><div><p lang="de">{markedText(example.de)}</p><span>{example.zh}</span></div><button type="button" className="icon-button" onClick={()=>example.audioParts?speech.sequence(example.audioParts,`example-single-${index}`,speechRate):speech.speak(spokenText(example.de),`example-single-${index}`,speechRate)} aria-label={`朗读例句：${spokenText(example.de)}`}><Volume2 size={20}/></button></div>)}</div></section>
    {unit.pitfalls.length>0&&<section className="grammar-section"><SectionTitle>易错点</SectionTitle><ul className="grammar-lines">{unit.pitfalls.map((pitfall,index)=><li key={index}>{markedText(pitfall)}</li>)}</ul></section>}
    <section className="grammar-section"><SectionTitle>练习</SectionTitle><a className="primary-button" href={`#grammar-practice-${unit.id}`}>开始练习（{unit.exercises.length} 题）<ArrowRight size={17}/></a></section>
    <Reading reading={unit.reading} speech={speech} speechRate={speechRate} label={unit.readingLabel}/>
    {unit.additionalReading&&<section className="grammar-section"><div className="grammar-section-heading"><SectionTitle>补充短文</SectionTitle><button type="button" className="secondary-button" onClick={()=>speech.sequence(splitSentences(unit.additionalReading),'additional-reading',speechRate)}><Play size={14}/>连听全文</button></div><p lang="de">{unit.additionalReading}</p></section>}
    {unit.dialogues&&<PronunciationDialogues dialogues={unit.dialogues} speech={speech} speechRate={speechRate}/>}
    <section className="grammar-section"><SectionTitle>{unit.writingLabel||(unit.id.startsWith('p-b1-')?'标注任务':'写作')}</SectionTitle><p className={unit.id.startsWith('p-b1-')?'b1-multiline':''}>{unit.writing.task}</p>{unit.writing.sample&&<details className="grammar-sample"><summary>{unit.id.startsWith('p-b1-')?'看参考答案':'看范文'}</summary><div className="grammar-spoken-lines">{sampleSentences.map((sentence,index)=><div key={index} className={speech.active?.kind===`sample-${index}`?'speaking':''}><span lang="de">{markedText(sentence)}</span><button type="button" className="icon-button" onClick={()=>speech.speak(spokenText(sentence),`sample-${index}`,speechRate)} aria-label={`朗读范文第 ${index+1} 句`}><Volume2 size={18}/></button></div>)}</div></details>}{unit.writing.selfcheck&&<p className="grammar-extension">{unit.writing.selfcheck}</p>}</section>
    {unit.speaking&&<section className="grammar-section"><SectionTitle>口头任务卡</SectionTitle><p className="grammar-extension">{unit.speaking}</p></section>}
    {speech.error&&<p role="status" className="error-message">{speech.error}</p>}
    <LessonNavigation lesson={unit}/>
  </div>
}

function StructuredScenarioUnit({unit,speechRate}){
  const speech=useGrammarSpeech()
  const progress=getGrammarProgress()
  const missing=unit.prerequisites.filter((id)=>!progress[id]?.done)
  return <div className="grammar-unit"><a href="#grammar-scenarios" className="text-button"><ArrowLeft size={16}/>返回情景课</a><div className="grammar-unit-title"><span>{unit.level} · 情景课 S{unit.order}</span><h2>{unit.title}</h2>{missing.length>0&&<p>建议先学完：{missing.join('、')}</p>}</div>
    <section className="grammar-section"><SectionTitle>场景导入</SectionTitle><p className="grammar-extension">{unit.sceneIntro}</p></section>
    <section className="grammar-section"><div className="grammar-section-heading"><SectionTitle>对话</SectionTitle><button type="button" className="secondary-button" onClick={()=>speech.sequence(unit.dialogue.map((line)=>line.text),'scenario-dialogue',speechRate)}><Play size={14}/>连听对话</button></div><div className="grammar-spoken-lines">{unit.dialogue.map((line,index)=><div key={index} className={speech.active?.kind==='scenario-dialogue'&&speech.active.index===index?'speaking':''}><span><strong>{line.speaker}：</strong><span lang="de">{line.text}</span></span><button type="button" className="icon-button" onClick={()=>speech.speak(line.audio,`scenario-line-${index}`,speechRate)} aria-label={`朗读${line.speaker}第 ${index+1} 句`}><Volume2 size={18}/></button></div>)}</div></section>
    <section className="grammar-section"><SectionTitle>{['B1','B2'].includes(unit.level)?'重点表达':'高频句块'}</SectionTitle><GrammarTable table={unit.table} tableIndex={0} speech={speech} speechRate={speechRate}/></section>
    <section className="grammar-section"><SectionTitle>练习</SectionTitle><a className="primary-button" href={`#grammar-practice-${unit.id}`}>开始练习（{unit.exercises.length} 题）<ArrowRight size={17}/></a></section>
    <section className="grammar-section"><SectionTitle>口头任务卡</SectionTitle><p className="grammar-extension">{unit.speaking}</p>{unit.speakingSample&&<details className="grammar-sample"><summary>看参考</summary><p lang="de">{unit.speakingSample}</p></details>}{unit.speakingSelfcheck&&<div className="grammar-lines"><p>自查</p>{unit.speakingSelfcheck.replace(/^自查：/u,'').split('；').filter(Boolean).map((item,index)=><label key={index}><input type="checkbox"/> {item.replace(/\s*□[。]?$/u,'')}</label>)}</div>}</section>
    {speech.error&&<p role="status" className="error-message">{speech.error}</p>}
    <LessonNavigation lesson={unit}/>
  </div>
}

function answerText(exercise,answer) {
  if (exercise.type==='choice' || exercise.type==='listen_choice') return exercise.options[answer]
  if(exercise.blankAnswers)return Array.isArray(answer)?answer.join(' / '):answer
  if (['fill','listen_fill','listen_dictation'].includes(exercise.type)) return answer
  if (exercise.type==='order') return exercise.compound?answer.map((index)=>exercise.tokens[index]).join(' ').replace('Bahnhof Uhr','Bahnhofsuhr'):answer.map((index)=>exercise.tokens[index]).join(' ')
  return exercise.items.map((item,index)=>`${item.text} → ${exercise.groups[answer[index]]}`).join('；')
}
function correctText(exercise) {
  if (exercise.type==='choice' || exercise.type==='listen_choice') return exercise.options[exercise.answer]
  if(exercise.acceptedAnswers)return exercise.acceptedAnswers.join(' / ')
  if(exercise.blankAnswers)return exercise.blankAnswers.join(' / ')
  if (['fill','listen_fill','listen_dictation'].includes(exercise.type)) return exercise.answer
  if (exercise.type==='order') return exercise.displayAnswer||exercise.answer.join(' ')
  return exercise.items.map((item)=>`${item.text} → ${exercise.groups[item.group]}`).join('；')
}

const exerciseLabels={choice:'选择',fill:'填空',classify:'分类',order:'组句',listen_choice:'听音辨形',listen_fill:'听音填空',listen_dictation:'听写整句'}
function GrammarPractice({unit,speechRate}) {
  const speech=useGrammarSpeech()
  const [index,setIndex]=useState(0)
  const [fill,setFill]=useState('')
  const [fillParts,setFillParts]=useState(['',''])
  const [selectedItem,setSelectedItem]=useState(null)
  const [assignments,setAssignments]=useState({})
  const [ordered,setOrdered]=useState([])
  const [feedback,setFeedback]=useState(null)
  const [results,setResults]=useState([])
  const [complete,setComplete]=useState(false)
  const [error,setError]=useState('')
  const exercise=unit.exercises[index]
  function submit(answer) {
    if(feedback)return
    speech.stop()
    const grade=gradeExercise(exercise,answer)
    const result={grade,answer,exercise}
    setFeedback(result);setResults((current)=>[...current,result])
  }
  function next() {
    speech.stop()
    if(index+1===unit.exercises.length) {
      try {saveGrammarResult(unit.id,results.filter((result)=>result.grade.correct).length);setComplete(true)}
      catch(err){setError(err.message||'语法成绩保存失败。')}
      return
    }
    setIndex(index+1);setFill('');setFillParts(['','']);setSelectedItem(null);setAssignments({});setOrdered([]);setFeedback(null)
  }
  if(complete)return <div className="grammar-result"><h2>练习完成</h2><p className="grammar-score">{results.filter((result)=>result.grade.correct).length} / {unit.exercises.length}</p><h3>逐题回顾</h3><ol>{results.map((result,position)=><li key={position}><span>{position+1}. {result.exercise.q||result.exercise.display||result.exercise.prompt||'组句'}{result.exercise.type.startsWith('listen_')&&` · ${exerciseLabels[result.exercise.type]}`}</span><strong className={result.grade.correct?'grammar-correct':'grammar-incorrect'}>{result.grade.correct?'对':'错'}</strong><p>你的答案：{answerText(result.exercise,result.answer)}</p><p>正确答案：{correctText(result.exercise)}</p>{result.grade.minor.length>0&&<p>小滑：{result.grade.minor.join('、')}</p>}{result.exercise.explain&&<p>{result.exercise.explain}</p>}</li>)}</ol><a className="primary-button" href={`#grammar-${unit.id}`}>返回单元页</a></div>
  return <div className="grammar-practice"><a href={`#grammar-${unit.id}`} className="text-button"><ArrowLeft size={16}/>返回单元页</a><div className="study-progress"><span>{unit.title}</span><span>{index+1} / {unit.exercises.length}</span></div><progress max={unit.exercises.length} value={index} aria-label="语法练习进度"/><section className="grammar-question"><span className="stat-label">第 {index+1} 题 · {exerciseLabels[exercise.type]}</span><h2>{exercise.type==='listen_dictation'?'听写整句':markedText(exercise.q||exercise.display||exercise.prompt||'组句')}</h2>
    {unit.level==='B1'&&exercise.display&&<p className="grammar-extension" lang="de">{markedText(exercise.display)}</p>}
    {exercise.type.startsWith('listen_')&&<>{exercise.audio&&<div className="grammar-listening"><button type="button" className="secondary-button" onClick={()=>speech.speak(exercise.audio,'practice',speechRate)}><Volume2 size={14}/>正常速</button><button type="button" className="secondary-button" onClick={()=>speech.speak(exercise.audio,'practice-slow',speechRate*0.7)}><Volume2 size={14}/>慢速</button></div>}{exercise.listeningNote&&<p className="grammar-extension">{exercise.listeningNote}</p>}{exercise.type==='listen_dictation'&&<p className="grammar-word-count">共 {spokenWordCount(exercise.audio)} 个词</p>}{speech.error&&<p role="status" className="error-message">{speech.error}</p>}</>}
    {(exercise.type==='choice'||exercise.type==='listen_choice')&&<div className="grammar-choices">{exercise.options.map((option,optionIndex)=><div key={optionIndex} className="grammar-choice-row">{exercise.optionAudio&&<button type="button" className="icon-button" onClick={()=>speech.speak(option.replace(/[„“”]/gu,''),`option-${optionIndex}`,speechRate)} aria-label={`朗读选项 ${optionIndex+1}`}><Volume2 size={18}/></button>}<button className="secondary-button" disabled={!!feedback} onClick={()=>submit(optionIndex)}>{markedText(option)}</button></div>)}</div>}
    {exercise.hintOptions&&<p className="grammar-extension">选项 {exercise.hintOptions.join(' / ')}</p>}
    {['fill','listen_fill','listen_dictation'].includes(exercise.type)&&<form className="grammar-fill" onSubmit={(event)=>{event.preventDefault();submit(exercise.blankAnswers?fillParts:fill)}}>{exercise.blankAnswers?exercise.blankAnswers.map((_,partIndex)=><input key={partIndex} value={fillParts[partIndex]} onChange={(event)=>setFillParts((current)=>current.map((value,index)=>index===partIndex?event.target.value:value))} aria-label={`第 ${partIndex+1} 空`} disabled={!!feedback} autoComplete="off"/>):<input value={fill} onChange={(event)=>setFill(event.target.value)} aria-label={exercise.type==='listen_dictation'?'听写德语句子':'填写德语形态'} disabled={!!feedback} autoComplete="off"/>}<button className="primary-button" disabled={!!feedback||(exercise.blankAnswers?fillParts.some((value)=>!value):!fill)}>提交</button></form>}
    {exercise.type==='classify'&&<><div className="grammar-items">{exercise.items.map((item,itemIndex)=><button key={itemIndex} className={`secondary-button ${selectedItem===itemIndex?'selected':''}`} disabled={!!feedback} onClick={()=>setSelectedItem(itemIndex)}>{markedText(item.text)}{assignments[itemIndex]!==undefined&&<small> → {exercise.groups[assignments[itemIndex]]}</small>}</button>)}</div><div className="grammar-groups">{exercise.groups.map((group,groupIndex)=><button key={groupIndex} className="secondary-button" disabled={!!feedback||selectedItem===null} onClick={()=>{setAssignments((current)=>({...current,[selectedItem]:groupIndex}));setSelectedItem(null)}}>{group}</button>)}</div><button className="primary-button" disabled={!!feedback||Object.keys(assignments).length!==exercise.items.length} onClick={()=>submit(exercise.items.map((_,itemIndex)=>assignments[itemIndex]))}>提交分类</button></>}
    {exercise.type==='order'&&<><div className="grammar-ordered" aria-label="已组成的句子">{ordered.map((tokenIndex,position)=><button key={position} className="secondary-button" disabled={!!feedback} onClick={()=>setOrdered((current)=>current.filter((_,index)=>index!==position))}>{exercise.tokens[tokenIndex]}</button>)}</div><div className="grammar-items">{exercise.tokens.map((token,tokenIndex)=>!ordered.includes(tokenIndex)&&<button key={tokenIndex} className="secondary-button" disabled={!!feedback} onClick={()=>setOrdered((current)=>[...current,tokenIndex])}>{token}</button>)}</div><button className="primary-button" disabled={!!feedback||ordered.length!==exercise.answer.length} onClick={()=>submit(ordered)}>提交句子</button></>}
    {feedback&&<div className={`grammar-feedback ${feedback.grade.correct?'grammar-correct':'grammar-incorrect'}`} role="status"><strong>{feedback.grade.correct?'答对了':'答错了'}</strong>{feedback.grade.minor.length>0&&<p>小滑：{feedback.grade.minor.join('、')}；本题计对。</p>}{!feedback.grade.correct&&<p>正确答案：{correctText(exercise)}</p>}{exercise.explain&&<p>{exercise.explain}</p>}<button className="primary-button" onClick={next}>{index+1===unit.exercises.length?'查看结果':'下一题'} <ArrowRight size={16}/></button></div>}
    {error&&<p role="alert" className="error-message">{error}</p>}
  </section></div>
}

function GrammarComparison({comparison,speechRate}){
  const speech=useGrammarSpeech()
  return <div className="grammar-unit"><a href="#grammar" className="text-button"><ArrowLeft size={16}/>返回语法</a><div className="grammar-unit-title"><span>{lessonLevel(comparison)} · 对比专练</span><h2>{comparison.title}</h2></div><section className="grammar-section">{comparison.table&&<GrammarTable table={comparison.table} tableIndex={0} speech={speech} speechRate={speechRate}/>} {comparison.intro&&<p className="grammar-extension">{comparison.intro}</p>}<a className="primary-button" href={`#grammar-practice-${comparison.id}`}>开始练习（{comparison.exercises.length} 题）<ArrowRight size={17}/></a></section><LessonNavigation lesson={comparison}/></div>
}

export default function GrammarPage({route,speechRate=1}) {
  const [query,setQuery]=useState('')
  const [level,setLevel]=useState(readGrammarLevel)
  const levels=availableGrammarLevels()
  function selectLevel(value){setLevel(value);saveGrammarLevel(value);setQuery('')}
  useLayoutEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[level])
  const unitId=route.startsWith('grammar-practice-')?route.slice('grammar-practice-'.length):route.startsWith('grammar-')?route.slice('grammar-'.length):null
  const unit=grammarUnits.find((entry)=>entry.id===unitId)
  if(unit)return route.startsWith('grammar-practice-')?<GrammarPractice unit={unit} speechRate={speechRate}/>:<GrammarUnit unit={unit} speechRate={speechRate}/>
  const scenario=grammarScenarios.find((entry)=>entry.id===unitId)
  if(scenario)return route.startsWith('grammar-practice-')?<GrammarPractice unit={scenario} speechRate={speechRate}/>:scenario.sceneIntro?<StructuredScenarioUnit unit={scenario} speechRate={speechRate}/>:<GrammarUnit unit={scenario} speechRate={speechRate}/>
  const comparison=grammarComparisons.find((entry)=>entry.id===unitId)
  if(comparison)return route.startsWith('grammar-practice-')?<GrammarPractice unit={comparison} speechRate={speechRate}/>:<GrammarComparison comparison={comparison} speechRate={speechRate}/>
  const progress=getGrammarProgress()
  const sceneTab=route==='grammar-scenarios'
  const currentScenarios=scenarioLessonsForLevel(level)
  const filteredScenarios=visibleScenarioLessons(level,query)
  if(sceneTab)return <div className="grammar-home">
    <LevelSelector levels={levels} selected={level} onSelect={selectLevel}/>
    <div className="data-tabs" role="tablist" aria-label="语法视图"><a role="tab" aria-selected={false} href="#grammar">语法</a><a role="tab" aria-selected className="selected" href="#grammar-scenarios">情景课</a></div>
    <label className="grammar-search">搜索单元<input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="标题或关键词"/></label>
    {currentScenarios.length?<section className="grammar-section"><h2>情景课</h2><div className="grammar-unit-list">{filteredScenarios.map((entry)=><a key={entry.id} href={`#grammar-${entry.id}`} className="grammar-unit-card"><span className="grammar-order">S{entry.order}</span><span><strong>{entry.title}</strong>{entry.prerequisites?.length?entry.prerequisites.some((id)=>!progress[id]?.done)&&<small>建议先学完：{entry.prerequisites.filter((id)=>!progress[id]?.done).join('、')}</small>:<small>建议先学完：{entry.recommended}</small>}</span><em>{progress[entry.id]?.done?`已完成 · 最高分 ${progress[entry.id].bestScore}/${entry.exercises.length}`:'未开始'}</em><ArrowRight size={17}/></a>)}</div>{!filteredScenarios.length&&<p className="pack-empty">没有符合条件的单元。</p>}</section>:<p className="pack-empty">本级别内容待上线</p>}
  </div>
  const currentLessons=grammarLessonsForLevel(level)
  const {units:filteredUnits,comparisons:filteredComparisons}=visibleGrammarLessons(level,query)
  return <div className="grammar-home">
    <LevelSelector levels={levels} selected={level} onSelect={selectLevel}/>
    <div className="data-tabs" role="tablist" aria-label="语法视图"><a role="tab" aria-selected className="selected" href="#grammar">语法</a><a role="tab" aria-selected={false} href="#grammar-scenarios">情景课</a></div>
    <label className="grammar-search">搜索单元<input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="标题或关键词"/></label>
    {filteredUnits.length>0&&<section className="grammar-section"><h2>{level}</h2><div className="grammar-unit-list">{filteredUnits.map((entry)=><a key={entry.id} href={`#grammar-${entry.id}`} className="grammar-unit-card"><span className="grammar-order">{String(entry.order).padStart(2,'0')}</span><span><strong>{entry.title}</strong><small lang="de">{entry.titleDe}</small></span><em>{progress[entry.id]?.done?`已完成 · 最高分 ${progress[entry.id].bestScore}/${entry.exercises.length}`:'未开始'}</em><ArrowRight size={17}/></a>)}</div></section>}
    {filteredComparisons.length>0&&<section className="grammar-section"><h2>对比专练</h2><div className="grammar-unit-list">{filteredComparisons.map((entry)=><a key={entry.id} href={`#grammar-${entry.id}`} className="grammar-unit-card"><span className="grammar-order">{entry.id}</span><span><strong>{entry.title}</strong></span><em>{progress[entry.id]?.done?`已完成 · 最高分 ${progress[entry.id].bestScore}/${entry.exercises.length}`:'未开始'}</em><ArrowRight size={17}/></a>)}</div></section>}
    {!filteredUnits.length&&!filteredComparisons.length&&<p className="pack-empty">{currentLessons.length?'没有符合条件的单元。':'本级别内容待上线'}</p>}
  </div>
}
