import { useEffect, useState } from 'react'
import { dayKey } from './learning.js'
import { endVacation, setVacation } from './db.js'

export default function VacationSettings({vacation,now,onChanged}) {
  const [start,setStart] = useState(dayKey(now))
  const [end,setEnd] = useState(dayKey(now))
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  useEffect(()=>{if(vacation){setStart(vacation.start);setEnd(vacation.end)}},[vacation?.start,vacation?.end])
  async function save(event) {
    event.preventDefault(); if(busy)return
    setBusy(true);setMessage('')
    try {await setVacation(start,end);await onChanged();setMessage('假期模式已保存。')}
    catch(error){setMessage(error.message)}finally{setBusy(false)}
  }
  async function finish() {
    if(busy)return
    setBusy(true);setMessage('')
    try {const count=await endVacation();await onChanged();setMessage(`假期已提前结束，${count} 个词已按实际日期顺延。`)}
    catch(error){setMessage(error.message)}finally{setBusy(false)}
  }
  return <section className="vacation-settings" aria-labelledby="vacation-title"><h2 id="vacation-title">假期模式</h2>
    {vacation && <p className="vacation-status">{dayKey(now)<vacation.start?'已安排':'进行中'}：{vacation.start} 至 {vacation.end}。假期内暂停新词和新到期复习。</p>}
    <form onSubmit={save}><label>开始日期<input type="date" required value={start} disabled={busy} onChange={(event)=>setStart(event.target.value)} /></label><label>结束日期<input type="date" required value={end} disabled={busy} onChange={(event)=>setEnd(event.target.value)} /></label><div><button className="secondary-button" disabled={busy}>{vacation?'更新假期日期':'开启假期模式'}</button>{vacation && <button type="button" className="secondary-button" disabled={busy} onClick={finish}>提前结束</button>}</div></form>
    {message && <p role="status" className="import-note">{message}</p>}
  </section>
}
