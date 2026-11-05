import {useState} from 'react'
import {reviewForecast,currentStreak,levelOverview} from './overview.js'
import {wrongBook} from './output.js'

export default function TodayInsights({words,metrics,now,vacation,vacationHistory,outputPassedIds=[],exitOverview}){
  const [level,setLevel]=useState('all')
  const levels=[...new Set(words.map(word=>word.level).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
  const allLevels=words.some(word=>!word.level)?[...levels,'ungraded']:levels
  const breakdown=levelOverview(words,level,outputPassedIds)
  const forecast=reviewForecast(words,now,vacation)
  const highest=Math.max(...forecast.map(day=>day.count))
  const top=wrongBook(words).slice(0,10)
  const accuracy=metrics.outputTotal?`${Math.round(metrics.outputCorrect/metrics.outputTotal*100)}%`:'—'
  const total=breakdown.reduce((sum,item)=>sum+item.count,0)
  return <>
    <section className="insight-panel" aria-labelledby="overview-title"><div className="overview-heading"><h2 id="overview-title" className="section-kicker">ÜBERBLICK · 学习概览</h2><label>当前级别 <select value={level} onChange={event=>setLevel(event.target.value)}><option value="all">全部级别</option>{levels.map(item=><option key={item} value={item}>{item}</option>)}{words.some(word=>!word.level)&&<option value="ungraded">未分级</option>}</select></label></div>
      <div className="overview-states">{breakdown.map(item=><div key={item.status} className={`state-${item.status}`}><span>{item.status}</span><strong>{item.count}</strong><small>{item.percent}% · 共 {total} 词</small></div>)}</div>
      <div className="overview-segment" aria-label="未学、学习中、已掌握比例">{breakdown.map(item=><span key={item.status} className={`state-${item.status}`} style={{width:`${item.percent}%`}}/>)}</div>
      {allLevels.length>0&&<div className="level-breakdown" aria-label="各级别学习状态"><h3 className="section-kicker">NIVEAUS · 各级别进度</h3><div className="level-breakdown-row level-breakdown-head"><span>级别</span><span>已学 / 总数</span><span>进度</span><span>百分比</span></div>{allLevels.map(item=>{const states=levelOverview(words,item,outputPassedIds);const count=states.reduce((sum,state)=>sum+state.count,0);const learned=states.filter(state=>state.status!=='未学').reduce((sum,state)=>sum+state.count,0);const percent=count?Math.round(learned/count*100):0;return <div className="level-breakdown-row" key={item}><strong>{item==='ungraded'?'未分级':item}</strong><span>{learned} / {count}</span><div className="wordbook-progress"><span style={{width:`${percent}%`}}/></div><span>{percent}%</span></div>})}</div>}
    </section>
    {exitOverview}
    <section className="insight-panel" aria-label="学习统计"><h2 className="section-kicker">STATISTIK · 学习统计</h2><div className="overview-metrics"><p><span>连续天数</span><strong>{currentStreak(metrics.activityDays,now,vacationHistory,vacation)}</strong><small>天{vacation?' · 假期内冻结':''}</small></p><p><span>累计复习次数</span><strong>{metrics.reviewCount}</strong><small>次</small></p><p><span>强化正确率</span><strong>{accuracy}</strong><small>{metrics.outputCorrect} / {metrics.outputTotal}</small></p></div><p className="import-note">复习次数与强化正确率从本次更新起累计；此前完成的新词天数已计入连续天数。</p></section>
    <section className="insight-panel" aria-labelledby="wrong-top-title"><h2 id="wrong-top-title" className="section-kicker">FEHLER · 错词 Top 10</h2>{top.length?<ol className="overview-wrong">{top.map(word=><li key={word.id}><span lang="de"><span className={word.article}>{word.article&&`${word.article} `}</span>{word.german}</span><span>答错 {word.lapses} 次</span></li>)}</ol>:<p className="pack-empty">还没有答错至少 2 次的词。</p>}</section>
    <section className="insight-panel" aria-labelledby="forecast-title"><h2 id="forecast-title" className="section-kicker">VORSCHAU · 未来 7 天复习预报</h2><div className="forecast-grid">{forecast.map(day=><div key={day.date.getTime()} className={`forecast-day ${day.level}`}><span>{day.date.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',weekday:'short'})}</span><strong>{day.count}</strong><small>个词</small></div>)}</div>{highest>80?<p className="forecast-advice">有单日超过 80 词：可在到期当天分早晚两次复习，并暂停当天新词，分摊学习量。</p>:highest>50?<p className="forecast-advice">有单日超过 50 词：建议到期当天分批复习，预留时间。</p>:null}</section>
  </>
}
