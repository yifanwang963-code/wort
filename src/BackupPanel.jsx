import { useRef, useState } from 'react'
import { Download, Upload, Archive } from 'lucide-react'
import { exportBackup, restoreBackup, recordBackupExport } from './db.js'
import { backupFilename, parseBackup } from './backup.js'
import { announceRestore } from './data-events.js'

export default function BackupPanel({ onRestored, onExported }) {
  const input = useRef(null)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [backup, setBackup] = useState(null)
  const [filename, setFilename] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function download() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const now = new Date()
      const snapshot = await exportBackup(now)
      snapshot.settings = snapshot.settings.filter((setting) => !['lastBackupExportAt','backupReminderDismissedAt'].includes(setting.key))
      snapshot.settings.push({key:'lastBackupExportAt',value:now.getTime()})
      const blob = new Blob([JSON.stringify(snapshot,null,2)], { type:'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = backupFilename(now)
      document.body.append(link); link.click(); link.remove()
      await recordBackupExport(now)
      await onExported?.()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setMessage(`已发起下载：${link.download}（${snapshot.words.length} 个单词）。请保存好文件。`)
    } catch (err) { setError(err.message || '导出失败，请重试。') }
    finally { lock.current = false; setBusy(false) }
  }

  async function choose(event) {
    const file = event.target.files[0]; event.target.value = ''
    if (!file || lock.current) return
    lock.current = true; setBusy(true); setError(''); setMessage(''); setBackup(null); setConfirmed(false)
    try {
      const parsed = parseBackup(await file.text())
      setBackup(parsed); setFilename(file.name)
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(false) }
  }

  async function restore() {
    if (!confirmed || !backup || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await restoreBackup(backup)
      setBackup(null); setConfirmed(false)
      setMessage(`恢复成功：${result.words} 个单词、${result.packs} 个词包，学习进度、语法进度和设置已还原。`)
      announceRestore()
      await onRestored()
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="import-panel backup-panel" aria-labelledby="backup-heading">
    <div className="import-panel-heading"><div><h2 id="backup-heading"><Archive size={19} />备份与恢复</h2><p>备份全部单词、学习进度、语法进度、设置与词包。恢复会整库替换，词包导入仍是合并去重。</p></div></div>
    <div className="backup-actions"><button className="secondary-button" disabled={busy} onClick={download}><Download size={16} />导出备份</button><button className="secondary-button" disabled={busy} onClick={() => input.current.click()}><Upload size={16} />选择备份恢复</button><input type="file" hidden ref={input} accept=".json,application/json" aria-label="上传整库备份" onChange={choose} /></div>
    {busy && <p role="status" className="import-note">正在处理，请稍候…</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {message && <p role="status" className="import-success">{message}</p>}
    {backup && <div className="restore-preview">
      <h3>恢复前确认</h3><p className="import-filename">{filename}</p>
      <p>备份时间：{new Date(backup.exportedAt).toLocaleString('zh-CN')}</p>
      <p>{backup.words.length} 个单词 · {backup.packs.length} 个词包 · 每日上限 {backup.settings.find((setting) => setting.key === 'dailyLimit').value}</p>
      <p>将替换当前全部单词、学习进度、设置、已学记录和词包列表。备份中没有的现有内容会移除，建议先导出当前备份。</p>
      <label className="restore-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} /><span>我确认用此备份替换当前整库数据</span></label>
      <div className="backup-actions"><button className="secondary-button" disabled={busy} onClick={() => { setBackup(null); setConfirmed(false) }}>取消恢复</button><button className="primary-button" disabled={busy || !confirmed} onClick={restore}>确认整库恢复</button></div>
    </div>}
  </section>
}
