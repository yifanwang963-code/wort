import { useEffect, useLayoutEffect, useState } from 'react'
import { ArrowDown, ArrowRight, Check, LoaderCircle, Plus, RotateCcw } from 'lucide-react'
import { addWord, dismissBackupReminder, getPacks, getStudyState, startOutputTraining } from './db.js'
import { reviewQueue } from './learning.js'
import { wordKey } from './word-model.js'
import { chooseNewWords, DEFAULT_STUDY_OPTIONS } from './study-options.js'
import { BulkImport, WordPacks } from './ImportPanel.jsx'
import { isVacationDay, vacationContains, levelPrompt } from './continuity.js'
import { bookById, bookProgress, bookWords, nextBook } from './wordbooks.js'
import { wrongBook } from './output.js'
import { AddWordDialog, ArticleLegend, EmptyLibrary, WordCard } from './ui-components.jsx'
import WordbooksPage from './WordbooksPage.jsx'
import ResourcesPage from './ResourcesPage.jsx'
import TodayInsights from './TodayInsights.jsx'
import ExitOverview from './ExitOverview.jsx'
import StudyPage from './StudyPage.jsx'
import OutputPage from './OutputPage.jsx'
import SettingsPage from './SettingsPage.jsx'
import GrammarPage from './GrammarPage.jsx'
import A1ExitPage, {A1ExitSummary} from './A1ExitPage.jsx'
import A2ExitPage, {A2ExitSummary} from './A2ExitPage.jsx'
import B1ExitPage, {B1ExitSummary} from './B1ExitPage.jsx'
import B2ExitPage, {B2ExitSummary} from './B2ExitPage.jsx'
import {getGrammarProgress} from './grammar-progress.js'
import {completedScenarioWordKeys} from './grammar-scenarios.js'
import {currentStreak} from './overview.js'

const pageLabels={study:'学习',wordbooks:'词书',data:'数据',grammar:'语法',a1exit:'A1 出口',a2exit:'A2 出口',b1exit:'B1 出口',b2exit:'B2 出口',settings:'设置',learn:'学新词',review:'复习',output:'强化训练'}
function pageFromHash() {
  const hash=location.hash.slice(1)
  if (hash==='today') return 'study'
  if (hash==='library' || hash.startsWith('data-')) return 'data'
  if (hash==='resources') return 'wordbooks'
  if (hash.startsWith('grammar')) return 'grammar'
  if (hash.startsWith('a1-exit')) return 'a1exit'
  if (hash.startsWith('a2-exit')) return 'a2exit'
  if (hash.startsWith('b1-exit')) return 'b1exit'
  if (hash.startsWith('b2-exit')) return 'b2exit'
  return pageLabels[hash] ? hash : 'study'
}
function dataTabFromHash(){return location.hash.slice(1)==='library'||location.hash.slice(1).startsWith('data-library')?'library':'overview'}
function reviewSources(dueWords,packs) {
  const owner=new Map()
  for(const pack of packs)for(const word of pack.words)if(!owner.has(wordKey(word)))owner.set(wordKey(word),pack.id)
  const counts=new Map(packs.map((pack)=>[pack.id,0]))
  let other=0
  for(const word of dueWords){const id=owner.get(wordKey(word));if(id)counts.set(id,(counts.get(id)??0)+1);else other++}
  const result=packs.map((pack)=>({id:pack.id,name:pack.name,count:counts.get(pack.id)??0}))
  if(other)result.push({id:'other',name:'其他词条',count:other})
  return result
}

export default function App(){
  const [page,setPage]=useState(pageFromHash),[dataTab,setDataTab]=useState(dataTabFromHash)
  const [route,setRoute]=useState(()=>location.hash.slice(1))
  const [words,setWords]=useState([]),[packs,setPacks]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [modalOpen,setModalOpen]=useState(false),[notice,setNotice]=useState(''),[now,setNow]=useState(()=>new Date())
  const [dailyLimit,setDailyLimitState]=useState(10),[learnedToday,setLearnedToday]=useState(0),[pausedToday,setPausedToday]=useState(false)
  const [vacation,setVacation]=useState(null),[vacationHistory,setVacationHistory]=useState([]),[currentWordbook,setCurrentWordbook]=useState(null)
  const [studyOptions,setStudyOptionsState]=useState(DEFAULT_STUDY_OPTIONS),[backupReminder,setBackupReminder]=useState(false)
  const [metrics,setMetrics]=useState({reviewCount:0,outputCorrect:0,outputTotal:0,activityDays:[]}),[activeSession,setActiveSession]=useState(null)
  const [outputPassedIds,setOutputPassedIds]=useState([])
  const [restoreRevision,setRestoreRevision]=useState(0),[wrongBookOpen,setWrongBookOpen]=useState(false)
  const [search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('all'),[levelFilter,setLevelFilter]=useState('all'),[layerFilter,setLayerFilter]=useState('all')

  async function loadWords(silent=false){
    if(!silent)setLoading(true)
    setError('')
    try{
      const [state,storedPacks]=await Promise.all([getStudyState(),getPacks()])
      setWords(state.words);setPacks(storedPacks);setDailyLimitState(state.dailyLimit);setLearnedToday(state.learnedToday)
      setPausedToday(state.pausedToday);setVacation(state.vacation);setVacationHistory(state.vacationHistory)
      setCurrentWordbook(state.currentWordbook);setStudyOptionsState(state.studyOptions);setBackupReminder(state.backupReminder)
      setMetrics(state.metrics);setActiveSession(state.session);setOutputPassedIds(state.outputPassedIds);setNow(new Date())
    }catch(err){setError(err.message||'读取本地数据失败。')}
    finally{setLoading(false)}
  }
  useEffect(()=>{loadWords()},[])
  useEffect(()=>{
    if(!route.startsWith('data-library?'))return
    const params=new URLSearchParams(route.split('?',2)[1])
    if(params.get('level'))setLevelFilter(params.get('level'))
    if(params.get('layer'))setLayerFilter(params.get('layer'))
  },[route])
  useEffect(()=>{
    const onHash=()=>{setRoute(location.hash.slice(1));setPage(pageFromHash());setDataTab(dataTabFromHash());setNotice('');loadWords(true)}
    const onFocus=()=>loadWords(true)
    const interval=setInterval(()=>loadWords(true),60_000)
    window.addEventListener('hashchange',onHash);window.addEventListener('focus',onFocus)
    return()=>{clearInterval(interval);window.removeEventListener('hashchange',onHash);window.removeEventListener('focus',onFocus)}
  },[])
  useLayoutEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[route])
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer)},[notice])

  const remaining=Math.max(0,dailyLimit-learnedToday)
  const currentBook=bookById(currentWordbook?.id)
  const currentPack=packs.find((pack)=>pack.id===currentWordbook?.id)
  const currentPool=currentWordbook?bookWords(words,currentWordbook.keys):words
  const currentProgress=bookProgress(words,currentPack)
  const dailyWords=chooseNewWords(words,remaining,currentWordbook?.keys)
  const vacationToday=isVacationDay(vacation,now)
  const dueWords=reviewQueue(words.filter((word)=>!vacationContains(vacation,word.dueAt)),now)
  const dueNow=dueWords.length
  const sources=reviewSources(dueWords,packs)
  const reviewReason=activeSession?.mode==='learn'?'请先完成进行中的新词轮次':activeSession?.mode==='review'?'':!dueNow?(vacationToday?'假期内到期词将在返程后分摊':'当前没有到期的复习词'):''
  const learnReason=dailyLimit===0?'':vacationToday?'假期内暂停新词':pausedToday?'今日已暂停新词，明天自动恢复':activeSession?.mode==='review'?'请先完成进行中的复习轮次':!remaining?'今日新词额度已用完':!dailyWords.length?(currentBook?'当前词书未学池已空，请切换词书':'没有未学词，请先添加或导入'):''
  const nextLevel=currentBook?nextBook(currentBook.id):null
  const currentUnlearned=currentBook?currentPool.filter((word)=>word.status==='未学').length:0
  const previousPrompt=!currentBook?levelPrompt(words):null
  const progressionPrompt=currentBook&&currentUnlearned<50?{
    text:nextLevel?(currentUnlearned===0?`${currentBook.level} 当前词书的未学词已学完，可切换或加入 ${nextLevel.level} 词书。`:`${currentBook.level} 当前词书未学词剩余 ${currentUnlearned} 个，可准备 ${nextLevel.level} 词书。`):`${currentBook.level} 当前词书未学词${currentUnlearned===0?'已学完':`剩余 ${currentUnlearned} 个`}，可导入下一等级词包。`,
    href:'#wordbooks',label:'去词书页',
  }:previousPrompt?{text:`${previousPrompt.current} 未学词剩余 ${previousPrompt.remaining} 个，可准备导入 ${previousPrompt.next} 词包。`,href:'#wordbooks',label:'去词书页'}:null
  const wrongWords=wrongBook(words)
  const sceneProgress=getGrammarProgress()
  const sceneUsedKeys={A1:completedScenarioWordKeys(sceneProgress,'A1'),A2:completedScenarioWordKeys(sceneProgress,'A2'),B1:completedScenarioWordKeys(sceneProgress,'B1'),B2:completedScenarioWordKeys(sceneProgress,'B2')}
  const levels=[...new Set(words.map((word)=>word.level).filter(Boolean))].sort()
  const filteredWords=(wrongBookOpen?wrongWords:words).filter((word)=>{
    const query=search.trim().toLocaleLowerCase()
    return (!query||[word.german,word.chinese,word.unit,word.exampleDe].some((value)=>value?.toLocaleLowerCase().includes(query)))
      &&(statusFilter==='all'||word.status===statusFilter)
      &&(levelFilter==='all'||(levelFilter==='ungraded'?!word.level:word.level===levelFilter))
      &&(layerFilter==='all'||(word.layer||'被动认读')===layerFilter)
  })
  const trainingCount=words.filter((word)=>word.status==='学习中').length
  const wrongTrainingCount=wrongWords.filter((word)=>word.status==='学习中').length
  const onAdd=()=>{setNotice('');setModalOpen(true)}
  async function saveWord(fields){const word=await addWord(fields);setWords((current)=>[word,...current]);setNotice(`已保存 ${word.article?`${word.article} `:''}${word.german}`)}
  async function trainWrongBook(){try{await startOutputTraining('mixed',true,true);location.hash='output'}catch(err){setNotice(err.message)}}
  async function dismissReminder(){try{await dismissBackupReminder();await loadWords(true)}catch(err){setNotice(err.message)}}
  async function afterRestore(){setRestoreRevision((value)=>value+1);await loadWords(true)}
  const activeNav=['learn','review','output'].includes(page)?'study':['a1exit','a2exit','b1exit','b2exit'].includes(page)?'data':page
  const dateLabel=now.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})
  const weekday=now.toLocaleDateString('de-DE',{weekday:'long'})
  const weekdayZh=now.toLocaleDateString('zh-CN',{weekday:'long'})
  const streak=currentStreak(metrics.activityDays,now,vacationHistory,vacation)

  return <div className="app-shell"><header className="site-header"><a className="site-brand" href="#study" aria-label="Wort 学习首页"><strong>Wort</strong><span>DEUTSCH LERNEN</span></a><nav className="site-nav" aria-label="主导航">{[['study','学习','#study'],['wordbooks','词书','#wordbooks'],['data','数据','#data-overview'],['grammar','语法','#grammar'],['settings','设置','#settings']].map(([id,label,href])=><a key={id} className={activeNav===id?'active':''} href={href} aria-current={activeNav===id?'page':undefined}>{label}</a>)}</nav></header>
  <div className="main-shell"><main id="main-content" className={['learn','review'].includes(page)?'study-main':undefined}>
    {page!=='study'&&!(page==='grammar'&&route.startsWith('grammar-')&&route!=='grammar-scenarios')&&<div className="page-heading"><div><p className="eyebrow">DEUTSCH · {pageLabels[page]}</p><h1>{pageLabels[page]}<span>{{wordbooks:'Wortschatz',data:'Daten',grammar:'Grammatik',a1exit:'A1 Prüfung',a2exit:'A2 Prüfung',b1exit:'B1 Prüfung',b2exit:'B2 Prüfung',settings:'Einstellungen',learn:'Neue Wörter',review:'Wiederholen',output:'Training'}[page]}</span></h1><p className="page-description">{{wordbooks:'选择词书，积累自己的词。',data:'查看进度和本地词库。',grammar:'从规则到练习。',a1exit:'六项测评全部通过后完成 A1。',a2exit:'六项测评全部通过后完成 A2。',b1exit:'六项测评全部通过后完成 B1。',b2exit:'六项测评全部通过后完成 B2。',settings:'按自己的节奏学习。',learn:'先回想，再翻面。',review:'按真实记忆自评。',output:'听写、拼写、冠词快测和例句挖空。'}[page]}</p></div>{page==='wordbooks'&&<button className="secondary-button add-top" onClick={onAdd} disabled={loading||!!error}><Plus size={18}/>添加单词</button>}</div>}
    {error?<div className="load-error" role="alert"><p>{error}</p><button className="text-button" onClick={()=>loadWords()}>重新读取 <ArrowRight size={16}/></button></div>:loading?<div className="loading" role="status"><LoaderCircle className="spin" size={22}/>正在读取本地词库…</div>:<>
      {page==='study'&&<div className="study-dashboard"><aside className="today-rail"><span className="section-kicker">HEUTE · 今天</span><strong className="today-date">{dateLabel}</strong><span className="today-weekday">{weekday} · {weekdayZh}</span><div className="today-rail-stat"><span>今日新词</span><strong>{learnedToday} <i>/</i> {dailyLimit}</strong></div><div className="today-rail-stat"><span>连续学习</span><strong>{streak} <small>天</small></strong>{vacationToday&&<small>假期内冻结</small>}</div></aside><div className="study-primary">
        {backupReminder&&<div className="continuity-banner backup-reminder" role="status"><span>距上次导出备份已超过 7 天，建议保存最新备份。</span><a className="text-button" href="#settings">去导出备份</a><button className="text-button" onClick={dismissReminder}>关闭提醒</button></div>}
        {progressionPrompt&&<div className="continuity-banner" role="status"><span>{progressionPrompt.text}</span><a className="text-button" href={progressionPrompt.href}>{progressionPrompt.label}</a></div>}
        <section className="learning-book" aria-label="当前词书"><span className="section-kicker">AKTUELLES WORTBUCH · 当前词书</span><div className="learning-book-line"><span className="learning-book-level">{currentBook?.level??currentPack?.level??'—'}</span><div className="learning-book-name"><h2>{currentBook?.name??currentPack?.name??'全部未学词'}</h2><p>{currentBook?.level==='B2'?'自建分层版':currentBook?'歌德分级 · 分层版':'选择词书后从本书未学池取词'}</p><a className="text-button" href="#wordbooks">切换当前词书 <ArrowRight size={15}/></a></div><div className="learning-book-count"><strong>{currentProgress.learned} <i>/</i> {currentProgress.total}</strong><span>本书已学 · {currentProgress.percent}%</span></div></div><div className="wordbook-progress"><span style={{width:`${currentProgress.percent}%`}}/></div></section>
        {activeSession&&<div className="resume-banner"><span>有一轮{activeSession.mode==='learn'?'新词学习':'复习'}尚未完成，已保存 {activeSession.index} 次作答。</span>{activeSession.mode==='learn'&&vacationToday?<span>假期结束后可继续</span>:<a className="text-button" href={`#${activeSession.mode}`}>继续本轮 <ArrowRight size={16}/></a>}</div>}
        <section className="learning-tasks" aria-label="今日学习任务"><div className="learning-task"><span className="section-kicker">NEUE WÖRTER · 今日新词</span><div className="task-count"><strong>{vacationToday?0:dailyWords.length}</strong><span>个可学 · 按{studyOptions.newOrder==='random'?'乱序':'词书顺序'}</span></div><button className="primary-button task-button" disabled={dailyLimit===0||!!learnReason} onClick={()=>location.hash='learn'}>{dailyLimit===0?'今日只复习':'学新词'} <ArrowRight size={18}/></button><p>{dailyLimit===0?'':learnReason||`今日已学 ${learnedToday} / ${dailyLimit}`}</p></div>
          <div className="learning-task"><span className="section-kicker">WIEDERHOLUNG · 复习来源</span><div className="review-sources">{sources.length?sources.map(item=><div key={item.id}><span>{item.name}</span><strong>{item.count} 个到期</strong></div>):<p>还没有词书来源；到期词会显示在这里。</p>}</div><button className="secondary-button task-button" disabled={!!reviewReason} onClick={()=>location.hash='review'}>开始复习 <strong>{dueNow}</strong><small>个到期</small><RotateCcw size={18}/></button><p>{reviewReason||'按设置的复习顺序出场。'}</p></div>
        </section><a className={`training-entry ${!trainingCount?'disabled':''}`} href={trainingCount?'#output':undefined} aria-disabled={!trainingCount}>强化训练 <span>{trainingCount?`学习中 ${trainingCount} 词 · 每轮最多 10 个`:'暂无学习中的词'}</span><ArrowRight size={17}/></a>
      </div></div>}
      {page==='data'&&<><div className="data-tabs" role="tablist" aria-label="数据视图"><a role="tab" aria-selected={dataTab==='overview'} className={dataTab==='overview'?'selected':''} href="#data-overview">概览</a><a role="tab" aria-selected={dataTab==='library'} className={dataTab==='library'?'selected':''} href="#data-library">词库</a></div>
        {dataTab==='overview'?<><div className="insight-reorder"><TodayInsights words={words} metrics={metrics} now={now} vacation={vacation} vacationHistory={vacationHistory} outputPassedIds={outputPassedIds} exitOverview={<ExitOverview/>}/></div><details className="exit-details"><summary>查看各级别六项成绩</summary><A1ExitSummary/><A2ExitSummary/><B1ExitSummary/><B2ExitSummary/></details><section className="words-section" aria-labelledby="wrong-title"><div className="section-heading"><div><h2 id="wrong-title">错词本<span className="count-badge">{wrongWords.length}</span></h2><p>答错至少 2 次，按答错次数排列。</p></div></div><button className="primary-button" disabled={!wrongTrainingCount} onClick={trainWrongBook}>用错词本强化训练</button>{wrongWords.length?<div className="word-grid wrong-grid">{wrongWords.map((word)=><WordCard key={word.id} word={word} showLapses sceneUsed={sceneUsedKeys[word.level]?.has(wordKey(word))}/>)}</div>:<p className="pack-empty">暂无错词。</p>}</section></>:<section className="words-section" aria-labelledby="words-title"><div className="section-heading"><div><h2 id="words-title">全部单词<span className="count-badge">{filteredWords.length}</span></h2><p>每一个词，都从这里开始。</p></div><ArticleLegend/></div><div className="library-filters"><button className="secondary-button" aria-pressed={!wrongBookOpen} onClick={()=>setWrongBookOpen(false)}>全部单词</button><button className="secondary-button" aria-pressed={wrongBookOpen} onClick={()=>setWrongBookOpen(true)}>错词本（{wrongWords.length}）</button>{wrongBookOpen&&<button className="primary-button" disabled={!wrongTrainingCount} onClick={trainWrongBook}>用错词本强化训练</button>}</div><div className="library-search"><label>搜索单词或释义<input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="德语、中文、例句或单元"/></label><label>状态<select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)}><option value="all">全部状态</option><option>未学</option><option>学习中</option><option>已掌握</option></select></label><label>级别<select value={levelFilter} onChange={(event)=>setLevelFilter(event.target.value)}><option value="all">全部级别</option>{levels.map((level)=><option key={level}>{level}</option>)}{words.some((word)=>!word.level)&&<option value="ungraded">未分级</option>}</select></label><label>词汇层<select value={layerFilter} onChange={(event)=>setLayerFilter(event.target.value)}><option value="all">全部词汇层</option><option>核心主动</option><option>被动认读</option><option>扩展认读</option></select></label></div>{filteredWords.length?<><div className="list-meta"><span>已收录 {words.length} 个单词</span><span><ArrowDown size={13}/>最近添加</span></div><div className="word-grid">{filteredWords.map((word)=><WordCard key={word.id} word={word} showLapses={wrongBookOpen} sceneUsed={sceneUsedKeys[word.level]?.has(wordKey(word))}/>)}</div></>:words.length?<p className="pack-empty">没有符合条件的词。</p>:<EmptyLibrary onAdd={onAdd}/>}</section>}
      </>}
      {page==='wordbooks'&&<><WordbooksPage key={`builtin-${restoreRevision}`} words={words} currentWordbook={currentWordbook} onChanged={()=>loadWords(true)}/><BulkImport key={`bulk-${restoreRevision}`} onImported={()=>loadWords(true)}/><WordPacks key={`packs-${restoreRevision}`} words={words} onImported={()=>loadWords(true)}/><section id="resources-heading" className="resources-section" aria-label="学习资源"><h2>学习资源</h2><ResourcesPage/></section></>}
      {page==='grammar'&&<GrammarPage key={location.hash} route={location.hash.slice(1)} speechRate={studyOptions.speechRate}/>}
      {page==='a1exit'&&<A1ExitPage key={location.hash} route={location.hash.slice(1)} speechRate={studyOptions.speechRate}/>}
      {page==='a2exit'&&<A2ExitPage key={location.hash} route={location.hash.slice(1)} speechRate={studyOptions.speechRate}/>}{page==='b1exit'&&<B1ExitPage key={location.hash} route={location.hash.slice(1)} speechRate={studyOptions.speechRate}/>}{page==='b2exit'&&<B2ExitPage key={location.hash} route={location.hash.slice(1)} speechRate={studyOptions.speechRate}/>}
      {page==='settings'&&<SettingsPage dailyLimit={dailyLimit} pausedToday={pausedToday} vacation={vacation} now={now} studyOptions={studyOptions} onChanged={()=>loadWords(true)} onRestored={afterRestore}/>}
      {['learn','review'].includes(page)&&<StudyPage key={page} mode={page} studyOptions={studyOptions} onChanged={()=>loadWords(true)}/>}
      {page==='output'&&<OutputPage studyOptions={studyOptions} onChanged={()=>loadWords(true)}/>}
    </>}
    <footer className="page-footer"><span>Wort für Wort — 一个词，一小步。</span><span>词库保存在此浏览器</span></footer>
  </main></div><div className="toast" role="status" aria-live="polite">{notice&&<span><Check size={17}/>{notice}</span>}</div><AddWordDialog open={modalOpen} onClose={()=>setModalOpen(false)} onSave={saveWord}/></div>
}

