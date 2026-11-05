import { useEffect, useRef, useState } from 'react'
import { Upload, Package, Check } from 'lucide-react'
import { getWords, importWords, getPacks, savePack } from './db.js'
import { parseImportFile, previewImport, parseWordPack } from './import.js'
import { wordKey } from './word-model.js'

function importMessage(result) {
  return `新增 ${result.added} 个，跳过重复 ${result.skipped} 个${result.errors ? `，错误 ${result.errors} 行未导入` : ''}。`
}

export function BulkImport({ onImported }) {
  const fileRef = useRef(null)
  const generation = useRef(0)
  const busyRef = useRef(false)
  const [source, setSource] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  useEffect(() => () => { generation.current++ }, [])

  async function choose(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file || busyRef.current) return
    const current = ++generation.current
    setSource(null); setPreview(null); setError(''); setResult(''); setBusy(true)
    try {
      const parsed = parseImportFile(await file.text(), file.name)
      const existing = await getWords()
      if (current !== generation.current) return
      setPreview(previewImport(parsed.rows, existing, parsed.defaultLevel))
      setSource(parsed)
    } catch (err) { if (current === generation.current) setError(err.message) }
    finally { if (current === generation.current) setBusy(false) }
  }

  async function confirm() {
    if (busyRef.current || !preview?.ready) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      const imported = await importWords(source.rows, source.defaultLevel)
      setResult(importMessage(imported)); setSource(null); setPreview(null)
      await onImported()
    } catch (err) { setError(err.message) }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <section className="import-panel" aria-labelledby="bulk-heading">
    <div className="import-panel-heading"><div><h2 id="bulk-heading"><Upload size={19} />批量导入</h2><p>上传 CSV 或 JSON，先检查预览，再确认入库。</p></div>
      <button className="secondary-button" onClick={() => fileRef.current.click()} disabled={busy}><Upload size={16} />选择 CSV / JSON</button>
      <input ref={fileRef} hidden type="file" accept=".csv,.json,text/csv,application/json" onChange={choose} aria-label="上传批量导入文件" />
    </div>
    {busy && <p className="import-note" role="status">正在处理，请稍候…</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {result && <p role="status" className="import-success"><Check size={16} />{result}</p>}
    {preview && <div className="import-preview">
      <p className="import-filename">{source.label}</p>
      <div className="preview-counts" aria-label="导入预览统计"><span>总行数<strong>{preview.total}</strong></span><span>可导入<strong>{preview.ready}</strong></span><span>重复<strong>{preview.duplicates}</strong></span><span>错误<strong>{preview.errors}</strong></span></div>
      <p className="import-note">CSV 行号对应文件物理行；JSON 对应词条序号。空行和 CSV 表头不计入总行数。</p>
      <div className="preview-table-scroll"><table className="preview-table"><caption>词条预览{preview.total > 50 ? '（前 50 条）' : ''}</caption><thead><tr><th>行号</th><th>德语</th><th>中文</th><th>结果 / 原因</th></tr></thead><tbody>
        {preview.entries.slice(0, 50).map((entry) => <tr key={entry.row}><td>{entry.row}</td><td lang="de">{entry.word ? `${entry.word.article} ${entry.word.german}`.trim() : '—'}</td><td>{entry.word?.chinese || '—'}</td><td><span className={`import-kind ${entry.kind}`}>{entry.kind === 'ready' ? '可导入' : entry.kind === 'duplicate' ? '重复' : '错误'}</span>{entry.reason && <p>{entry.reason}</p>}</td></tr>)}
      </tbody></table></div>
      {preview.errors > 0 && <div className="import-errors"><h3>全部错误行及原因</h3><ul>{preview.entries.filter((entry) => entry.kind === 'error').map((entry) => <li key={entry.row}>第 {entry.row} 行：{entry.reason}</li>)}</ul></div>}
      <div className="import-confirm"><p>确认后仅导入有效新词，状态均为「未学」。重复和错误行会跳过。<br />入库时再次核对重复，最终数量可能变化。</p><div><button className="secondary-button" disabled={busy} onClick={() => { setPreview(null); setSource(null); setError('') }}>取消</button><button className="primary-button" disabled={busy || !preview.ready} onClick={confirm}>确认导入 {preview.ready} 个词</button></div></div>
    </div>}
  </section>
}

export function WordPacks({ words, onImported }) {
  const fileRef = useRef(null)
  const busyRef = useRef(false)
  const [packs, setPacks] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const existing = new Set(words.map(wordKey))
  async function loadPacks() {
    try { setPacks(await getPacks()); setLoadFailed(false); setError('') }
    catch (err) { setError(err.message); setLoadFailed(true) }
  }
  useEffect(() => { loadPacks() }, [])
  async function choose(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file || busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setMessage('')
    try {
      if (!/\.json$/i.test(file.name)) throw new Error('词包请选择 JSON 文件。')
      const pack = parseWordPack(await file.text(), file.name)
      const result = await savePack(pack)
      await loadPacks()
      setMessage(result.exists ? '此词包已在列表中。' : '词包已添加到列表，点击「导入」后才会写入词库。')
    } catch (err) { setError(err.message) }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function importPack(pack) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const result = await importWords(pack.words.map((value, index) => ({ row: index + 1, value })), pack.level)
      setMessage(`${pack.name}：${importMessage(result)}`)
      await onImported()
    } catch (err) { setError(err.message) }
    finally { busyRef.current = false; setBusy(false) }
  }
  return <section className="import-panel" aria-labelledby="packs-heading">
    <div className="import-panel-heading"><div><h2 id="packs-heading"><Package size={19} />词库包</h2><p>添加你的 JSON 词包，再按需导入。词包列表保存在本机。</p></div><button className="secondary-button" disabled={busy} onClick={() => fileRef.current.click()}><PlusIcon />添加词包文件</button><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={choose} aria-label="上传词库包 JSON" /></div>
    {error && <p className="error-message preserve-lines" role="alert">{error}</p>}
    {loadFailed && <button className="text-button" onClick={loadPacks}>重新读取词包</button>}
    {message && <p className="import-success" role="status">{message}</p>}
    {!packs.length && !loadFailed && <p className="pack-empty">还没有词库包。准备好 JSON 文件后，从这里添加。</p>}
    <div className="pack-list">{packs.map((pack) => {
      const keys = new Set(pack.words.map(wordKey))
      const imported = [...keys].filter((key) => existing.has(key)).length
      return <article className="pack-card" key={pack.id}><div><h3>{pack.name}</h3><p><span className="level-badge">{pack.level}</span><span>{keys.size} 词</span><span>已导入 {imported} / {keys.size}</span></p>{pack.words.length > keys.size && <p className="import-note">源文件 {pack.words.length} 条，含 {pack.words.length - keys.size} 条重复</p>}</div><button className="secondary-button" disabled={busy} onClick={() => importPack(pack)}>导入</button></article>
    })}</div>
    {packs.length > 0 && <p className="import-note">词数按 german + article 去重计算；已导入数包含通过手动或批量导入已有的相同词。</p>}
  </section>
}

function PlusIcon() { return <span aria-hidden="true" className="pack-plus">+</span> }
