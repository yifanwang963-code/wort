import { useState } from 'react'
import { Cloud, LogOut, RefreshCw } from 'lucide-react'

function dateLabel(value) {
  if (!value) return '尚无同步记录'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN') : '尚无同步记录'
}

export default function SyncAccountPanel({ sync }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action) {
    setBusy(true); setMessage('')
    try { await action(); setMessage('请求已完成。') }
    catch (error) { setMessage(error.message || '操作失败，请重试。') }
    finally { setBusy(false) }
  }

  return <section className="settings-group account-group"><h2>账号</h2>
    {!sync.configured ? <p className="import-note">账号同步尚未配置。</p> : sync.session ? <>
      <div className="account-summary"><div><strong>{sync.session.user.email}</strong><span><Cloud size={15}/>{sync.status}</span><small>上次同步：{dateLabel(sync.lastSyncedAt)}</small></div><button className="secondary-button" disabled={busy} onClick={()=>run(sync.signOut)}><LogOut size={16}/>登出</button></div>
      {(sync.status==='同步失败待重试'||sync.error)&&<div className="account-error" role="status"><span>{sync.error || '同步失败，等待重试。'}</span><button className="secondary-button" disabled={busy} onClick={()=>run(sync.retry)}><RefreshCw size={15}/>重试</button></div>}
      {sync.conflict&&<div className="sync-conflict-backdrop"><section className="sync-conflict" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
        <span className="section-kicker">首次同步 · 选择数据</span><h3 id="sync-conflict-title">保留哪一份学习数据？</h3><p>本机和云端都有不同的数据。选择后，另一份会被整包替换。</p>
        <div className="sync-choice-grid">{[['local','本机数据',sync.conflict.localCounts],['cloud','云端数据',sync.conflict.cloudCounts]].map(([key,label,data])=><div className={`sync-choice ${key===sync.conflict.preferred?'preferred-choice':''}`} key={key}><strong>{label}{key===sync.conflict.preferred&&<small>建议选择</small>}</strong><span>已学词数 <b>{data.learned}</b></span><span>累计复习 <b>{data.reviews}</b></span><span>最近学习 <b>{data.latest}</b></span></div>)}</div>
        <div className="sync-conflict-actions"><button className="secondary-button" disabled={busy} onClick={()=>run(()=>sync.chooseConflict('local'))}>保留本机数据并上传</button><button className="primary-button" disabled={busy} onClick={()=>run(()=>sync.chooseConflict('cloud'))}>保留云端数据并下载</button></div>
      </section></div>}
    </> : <>
      <div className="account-mode-tabs" role="tablist"><button className={mode==='login'?'selected':''} onClick={()=>{setMode('login');setMessage('')}}>登录</button><button className={mode==='signup'?'selected':''} onClick={()=>{setMode('signup');setMessage('')}}>注册</button></div>
      <form className="account-form" onSubmit={(event)=>{event.preventDefault();void run(()=>mode==='login'?sync.signIn(email,password):sync.signUp(email,password))}}>
        <label>邮箱<input type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)}/></label>
        <label>密码<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength="6" required value={password} onChange={(event)=>setPassword(event.target.value)}/></label>
        <button className="primary-button" disabled={busy}>{mode==='login'?'登录并同步':'创建账号'}</button>
      </form>
      {mode==='login'&&<button className="text-button account-reset" disabled={busy||!email} onClick={()=>void run(()=>sync.resetPassword(email))}>忘记密码？发送重置邮件</button>}
    </>}
    {sync.recovery&&<form className="account-form recovery-form" onSubmit={(event)=>{event.preventDefault();void run(()=>sync.updatePassword(password))}}><label>设置新密码<input type="password" autoComplete="new-password" minLength="6" required value={password} onChange={(event)=>setPassword(event.target.value)}/></label><button className="primary-button" disabled={busy}>更新密码</button></form>}
    {message&&<p className="import-note" role="status">{message}</p>}
  </section>
}
