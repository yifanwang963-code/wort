import { WORD_FIELDS, PARTS_OF_SPEECH, WORD_LAYERS, normalizeWord, wordKey } from './word-model.js'

export function validateImportWord(value, defaultLevel = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('词条必须是 JSON 对象。')
  for (const field of [...WORD_FIELDS, 'level','layer']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw new Error(`${field} 必须是字符串，空值请写 ""。`)
  }
  for (const [field, label] of [['german', '德语单词'], ['chinese', '中文释义'], ['partOfSpeech', '词性']]) {
    if (!value[field]?.trim()) throw new Error(`缺少 ${field}（${label}）。`)
  }
  if (!PARTS_OF_SPEECH.includes(value.partOfSpeech.trim())) throw new Error(`不支持的词性：${value.partOfSpeech}。请使用中文词性。`)
  if (value.partOfSpeech.trim() !== '名词' && value.article?.trim()) throw new Error('非名词的 article 应为空字符串。')
  if(value.layer!==undefined && value.layer.trim() && !WORD_LAYERS.includes(value.layer.trim()))throw new Error('layer 须为核心主动、被动认读或扩展认读。')
  const word={...normalizeWord(value),level:value.level?.trim()||defaultLevel}
  if(value.layer?.trim())word.layer=value.layer.trim()
  return word
}

// RFC-style comma CSV, including BOM, CRLF, escaped quotes and quoted newlines.
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '')
  const records = []
  let cells = [], cell = '', quoted = false, closed = false, line = 1, start = 1, issue = ''
  const finishCell = () => { cells.push(cell); cell = ''; closed = false }
  const finishRow = () => {
    const hasData = cells.length > 0 || closed || cell.trim() || issue
    finishCell()
    if (hasData) records.push({ cells, row: start, parseError: issue })
    cells = []; issue = ''
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else { quoted = false; closed = true }
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[i + 1] === '\n') i++
        cell += '\n'; line++
      } else cell += char
    } else if (char === ',') finishCell()
    else if (char === '\r' || char === '\n') {
      finishRow()
      if (char === '\r' && text[i + 1] === '\n') i++
      line++; start = line
    } else if (char === '"' && cell === '' && !closed) quoted = true
    else {
      if (char === '"' || (closed && char.trim())) issue ||= 'CSV 引号格式错误。'
      if (!closed) cell += char
    }
  }
  if (quoted) issue = 'CSV 引号未闭合，请检查此行及其后续内容。'
  if (cells.length || cell || closed || issue) finishRow()
  if (!records.length) throw new Error('CSV 文件为空。')
  const header = records.shift()
  if (header.parseError) throw new Error(`CSV 表头：${header.parseError}`)
  const names = header.cells.map((value) => value.trim())
  if (names.some((name) => !name) || new Set(names).size !== names.length) throw new Error('CSV 表头存在空列名或重复列名。')
  for (const field of ['german', 'chinese', 'partOfSpeech']) if (!names.includes(field)) throw new Error(`CSV 表头缺少 ${field}。`)
  return records.map((record) => ({ row: record.row,
    value: Object.fromEntries(names.map((name, index) => [name, record.cells[index] ?? ''])),
    parseError: record.parseError || (record.cells.length !== names.length ? `列数为 ${record.cells.length}，应为 ${names.length}。` : ''),
  }))
}

export function parseImportFile(text, filename) {
  if (/\.csv$/i.test(filename)) return { rows: parseCsv(text), label: filename }
  if (!/\.json$/i.test(filename)) throw new Error('请选择 .csv 或 .json 文件。')
  let parsed
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new Error('JSON 格式错误，请检查引号、逗号及括号。') }
  if (parsed?.format === 'wort-backup') throw new Error('这是整库备份，请使用「备份与恢复」，不要作为词包导入。')
  const values = Array.isArray(parsed) ? parsed : parsed?.words
  if (!Array.isArray(values)) throw new Error('JSON 顶层需为词条数组，或包含 words 数组的词包对象。')
  if (!Array.isArray(parsed) && parsed.level !== undefined && typeof parsed.level !== 'string') throw new Error('词包 level 必须是字符串。')
  return { rows: values.map((value, index) => ({ row: index + 1, value })), label: filename, defaultLevel: Array.isArray(parsed) ? '' : parsed.level?.trim() || '' }
}

export function previewImport(rows, existingWords, defaultLevel = '') {
  const existing = new Set(existingWords.map(wordKey))
  const seen = new Set()
  const entries = rows.map(({ row, value, parseError }) => {
    try {
      if (parseError) throw new Error(parseError)
      const word = validateImportWord(value, defaultLevel)
      const key = wordKey(word)
      if (existing.has(key)) return { row, word, kind: 'duplicate', reason: '本地词库已存在。' }
      if (seen.has(key)) return { row, word, kind: 'duplicate', reason: '文件内重复词条。' }
      seen.add(key)
      return { row, word, kind: 'ready', reason: '' }
    } catch (error) { return { row, kind: 'error', reason: error.message } }
  })
  return { entries, total: entries.length, ready: entries.filter((row) => row.kind === 'ready').length,
    duplicates: entries.filter((row) => row.kind === 'duplicate').length,
    errors: entries.filter((row) => row.kind === 'error').length }
}

export function parseWordPack(text, filename) {
  let data
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new Error('词包 JSON 格式错误。') }
  if (data?.format === 'wort-backup') throw new Error('这是整库备份，请使用「备份与恢复」。')
  if (!data || Array.isArray(data) || typeof data.name !== 'string' || !data.name.trim()
    || typeof data.level !== 'string' || !data.level.trim() || !Array.isArray(data.words)) {
    throw new Error('词包须包含非空 name、level 字符串和 words 数组。')
  }
  if (!data.words.length) throw new Error('词包 words 不能为空。')
  const parsed = parseImportFile(text, filename)
  const preview = previewImport(parsed.rows, [], parsed.defaultLevel)
  if (preview.errors) throw new Error(preview.entries.filter((entry) => entry.kind === 'error').map((entry) => `第 ${entry.row} 条：${entry.reason}`).join('\n'))
  return { id: JSON.stringify([data.name.trim(), data.level.trim()]), name: data.name.trim(), level: data.level.trim(),
    words: preview.entries.map((entry) => entry.word), sourceCount: preview.total }
}
