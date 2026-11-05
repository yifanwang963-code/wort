import {ArrowRight} from 'lucide-react'
import {getA1ExitProgress,a1ExitComplete} from './a1-exit-progress.js'
import {getA2ExitProgress,a2ExitComplete} from './a2-exit-progress.js'
import {getB1ExitProgress,b1ExitComplete} from './b1-exit-progress.js'
import {getB2ExitProgress,b2ExitComplete} from './b2-exit-progress.js'

export default function ExitOverview(){
  const levels=[
    ['A1',getA1ExitProgress(),a1ExitComplete],
    ['A2',getA2ExitProgress(),a2ExitComplete],
    ['B1',getB1ExitProgress(),b1ExitComplete],
    ['B2',getB2ExitProgress(),b2ExitComplete],
  ]
  return <section className="exit-overview" aria-labelledby="exit-overview-title"><h2 id="exit-overview-title" className="section-kicker">PRÜFUNGEN · 出口测评</h2><div className="exit-overview-grid">{levels.map(([level,progress,complete])=>{
    const started=['grammar','listening','reading','writing','speaking','vocabulary','vocab'].some(gate=>!!progress[gate])
    const passed=complete(progress)
    return <a href={`#${level.toLowerCase()}-exit`} className="exit-overview-item" key={level}><strong>{level}</strong><span className={passed?'status-complete':started?'status-active':'status-idle'}>{passed?'已通过':started?'进行中':'未考'}</span><small>{passed?`${level} 完成`:started?'继续测评':'六项测评'}</small><ArrowRight size={17}/></a>
  })}</div></section>
}
