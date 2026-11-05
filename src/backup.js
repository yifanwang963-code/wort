import { WORD_FIELDS, STATUSES, WORD_LAYERS } from './word-model.js'
import { validateImportWord } from './import.js'
import { dayKey } from './learning.js'
import { validateGrammarProgress } from './grammar-progress.js'
import {validateA1ExitProgress} from './a1-exit-progress.js'
import {validateA2ExitProgress} from './a2-exit-progress.js'
import {validateB1ExitProgress} from './b1-exit-progress.js'
import {validateB2ExitProgress} from './b2-exit-progress.js'

export const BACKUP_FORMAT = 'wort-backup'
export const BACKUP_VERSION = 1
export function backupFilename(date = new Date()) { return `Wort-backup-${dayKey(date)}-${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}.json` }
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value) => typeof value === 'string' && value.trim().length > 0
const integer = (value) => Number.isSafeInteger(value) && value >= 0
function requireValue(condition, message) { if (!condition) throw new Error(`备份校验失败：${message}`) }

export function parseBackup(source) {
  let data
  try { data = JSON.parse(source.replace(/^\uFEFF/, '')) } catch { throw new Error('无法解析备份 JSON，请选择完整的备份文件。') }
  return validateBackup(data)
}

// No normalization or deduplication: restoration preserves the exact stored records.
export function validateBackup(data) {
  requireValue(object(data) && data.format === BACKUP_FORMAT, '这不是 Wort 整库备份。词包请使用词包导入。')
  requireValue(data.formatVersion === BACKUP_VERSION && data.databaseVersion === 3, '不支持此备份版本，请使用匹配的网站版本。')
  requireValue(typeof data.exportedAt === 'string' && Number.isFinite(Date.parse(data.exportedAt)), '导出时间无效。')
  for (const key of ['words','settings','packs']) requireValue(Array.isArray(data[key]), `缺少 ${key} 数组。`)
  const ids = new Set(), orders = new Set()
  let maxOrder = 0
  for (const [index, word] of data.words.entries()) {
    const label = `第 ${index + 1} 个单词`
    requireValue(object(word) && text(word.id) && !ids.has(word.id), `${label} 的 ID 缺失或重复。`)
    ids.add(word.id)
    for (const field of WORD_FIELDS) requireValue(typeof word[field] === 'string', `${label} 的 ${field} 必须是字符串。`)
    requireValue(text(word.german) && text(word.chinese) && text(word.partOfSpeech), `${label} 缺少必要内容。`)
    requireValue(['','der','die','das'].includes(word.article), `${label} 的冠词无效。`)
    requireValue(word.level === undefined || typeof word.level === 'string', `${label} 的 level 无效。`)
    requireValue(word.layer === undefined || WORD_LAYERS.includes(word.layer), `${label} 的 layer 无效。`)
    requireValue(Number.isFinite(word.createdAt) && Math.abs(word.createdAt) <= 8.64e15, `${label} 的添加时间无效。`)
    requireValue(integer(word.importOrder) && word.importOrder > 0 && !orders.has(word.importOrder), `${label} 的导入顺序无效或重复。`)
    orders.add(word.importOrder); maxOrder = Math.max(maxOrder, word.importOrder)
    requireValue(STATUSES.includes(word.status), `${label} 的 status 无效。`)
    requireValue(word.dueAt === null || (Number.isFinite(word.dueAt) && Math.abs(word.dueAt) <= 8.64e15), `${label} 的 dueAt 无效。`)
    for (const field of ['intervalDays','reps','lapses']) requireValue(integer(word[field]), `${label} 的 ${field} 须为非负整数。`)
    // The existing fuzzy-rating rule can make ease lower than 1.3. Preserve it exactly.
    requireValue(Number.isFinite(word.ease), `${label} 的 ease 无效。`)
  }
  const settings = new Map()
  for (const setting of data.settings) {
    requireValue(object(setting) && text(setting.key) && Object.hasOwn(setting,'value') && !settings.has(setting.key), '设置项缺失、无效或重复。')
    settings.set(setting.key, setting.value)
    if (setting.key.startsWith('learned:')) {
      const date = setting.key.slice(8)
      requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)), '今日已学记录的日期无效。')
      requireValue(Array.isArray(setting.value) && setting.value.every((id) => ids.has(id)) && new Set(setting.value).size === setting.value.length, '今日已学记录包含无效或重复的单词 ID。')
    }
  }
  requireValue(integer(settings.get('dailyLimit')), '每日上限缺失或无效。')
  requireValue(integer(settings.get('importOrder')) && settings.get('importOrder') >= maxOrder, '导入顺序计数器缺失或小于已有单词顺序。')
  const session = settings.get('studySession')
  if (session != null) {
    requireValue(object(session) && text(session.id) && ['learn','review'].includes(session.mode) && integer(session.version), '进行中轮次格式无效。')
    requireValue(Array.isArray(session.wordIds) && session.wordIds.length > 0 && session.wordIds.every((id) => ids.has(id)) && new Set(session.wordIds).size === session.wordIds.length, '轮次引用了无效单词。')
    const originals = new Set(session.wordIds), repeats = new Set()
    requireValue(Array.isArray(session.queue) && session.queue.length >= originals.size && integer(session.index) && session.index < session.queue.length, '轮次队列或当前位置无效。')
    for (const [index, entry] of session.queue.entries()) {
      requireValue(object(entry) && originals.has(entry.id) && typeof entry.repeat === 'boolean', '轮次卡片格式无效。')
      if (index < session.wordIds.length) requireValue(entry.id === session.wordIds[index] && !entry.repeat, '轮次初始顺序无效。')
      else {
        requireValue(entry.repeat && !repeats.has(entry.id), '轮次重现次数无效。')
        repeats.add(entry.id)
      }
    }
    if (session.mode === 'learn') requireValue(data.words.filter((word) => originals.has(word.id)).every((word) => word.status === '未学'), '新词轮次包含非未学词。')
  }
  const packIds = new Set()
  for (const pack of data.packs) {
    requireValue(object(pack) && text(pack.id) && !packIds.has(pack.id) && text(pack.name) && text(pack.level) && Array.isArray(pack.words), '词包记录无效或 ID 重复。')
    packIds.add(pack.id)
    for (const word of pack.words) { try { validateImportWord(word, pack.level) } catch (error) { throw new Error(`备份词包「${pack.name}」无效：${error.message}`) } }
  }
  data.grammar = validateGrammarProgress(data.grammar ?? {})
  data.a1Exit = validateA1ExitProgress(data.a1Exit ?? {})
  data.a2Exit = validateA2ExitProgress(data.a2Exit ?? {})
  data.b1Exit = validateB1ExitProgress(data.b1Exit ?? {})
  data.b2Exit = validateB2ExitProgress(data.b2Exit ?? {})
  return data
}
