import { normalizeWord, wordKey } from './word-model.js'
import { previewImport } from './import.js'
import { EMPTY_PROGRESS, dayKey, dueInDays, reviewQueue, initialLearnedProgress, reviewProgress, advanceSession } from './learning.js'
import { BACKUP_FORMAT, BACKUP_VERSION, validateBackup } from './backup.js'
import { OUTPUT_MODES, outputCandidates, cardMode, answerMatches, expectedAnswer } from './output.js'
import { parseLocalDate, isVacationDay, vacationContains, redistributeVacation, backupReminderDue } from './continuity.js'
import { DEFAULT_STUDY_OPTIONS, chooseNewWords, orderReviews } from './study-options.js'
import { announceDataChange } from './data-events.js'
import { clearGrammarProgress, getGrammarProgress, replaceGrammarProgress } from './grammar-progress.js'
import {clearA1ExitProgress,getA1ExitProgress,replaceA1ExitProgress} from './a1-exit-progress.js'
import {clearA2ExitProgress,getA2ExitProgress,replaceA2ExitProgress} from './a2-exit-progress.js'
import {clearB1ExitProgress,getB1ExitProgress,replaceB1ExitProgress} from './b1-exit-progress.js'
import {clearB2ExitProgress,getB2ExitProgress,replaceB2ExitProgress} from './b2-exit-progress.js'
export { normalizeWord } from './word-model.js'

const DB_NAME = 'wort-daily'
const STORE = 'words'
let databasePromise

function openDatabase() {
  if (databasePromise) return databasePromise
  databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('当前浏览器不支持 IndexedDB，请换用支持本地存储的浏览器。'))
      return
    }
    const request = indexedDB.open(DB_NAME, 3)
    let blocked = false
    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'id' })
      const transaction = request.transaction
      const words = transaction.objectStore(STORE)
      const read = words.getAll()
      read.onsuccess = () => {
        // Add fields without changing any existing content, IDs, or timestamps.
        const oldWords = read.result.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
        oldWords.forEach((word, index) => {
          const progress = word.status === '学习中' ? { ...EMPTY_PROGRESS, dueAt: dueInDays(0), intervalDays: 1 } : EMPTY_PROGRESS
          words.put({ ...progress, ...word, status: word.status ?? '未学', importOrder: event.oldVersion < 2 ? index + 1 : word.importOrder })
        })
        if (event.oldVersion < 2) {
          transaction.objectStore('settings').put({ key: 'importOrder', value: oldWords.length })
          transaction.objectStore('settings').put({ key: 'dailyLimit', value: 10 })
        }
      }
    }
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return }
      request.result.onversionchange = () => {
        request.result.close()
        databasePromise = undefined
      }
      resolve(request.result)
    }
    request.onerror = () => reject(new Error('无法打开本地词库，请检查浏览器存储权限。'))
    request.onblocked = () => {
      blocked = true
      reject(new Error('本地词库被其他标签页占用，请关闭其他页面后重试。'))
    }
  }).catch((error) => {
    databasePromise = undefined
    throw error
  })
  return databasePromise
}

async function transact(mode, operation) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = operation(transaction.objectStore(STORE))
    transaction.oncomplete = () => { if(mode==='readwrite') announceDataChange(); resolve(request.result) }
    transaction.onabort = () => reject(new Error(mode === 'readwrite'
      ? '保存失败，可能是存储空间不足。填写内容已保留，请重试。'
      : '读取本地词库失败，请重试。'))
    transaction.onerror = () => { /* onabort reports the final transaction failure. */ }
  })
}

export async function getWords() {
  const words = await transact('readonly', (store) => store.getAll())
  return words.sort((a, b) => b.importOrder - a.importOrder)
}

export async function exportBackup(now = new Date()) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    // A single readonly transaction gives words, settings and packs one coherent snapshot.
    const transaction = db.transaction(['words','settings','packs'], 'readonly')
    const result = { format: BACKUP_FORMAT, formatVersion: BACKUP_VERSION, databaseVersion: db.version, exportedAt: now.toISOString() }
    for (const name of ['words','settings','packs']) {
      const request = transaction.objectStore(name).getAll()
      request.onsuccess = () => { result[name] = request.result }
    }
    transaction.oncomplete = () => resolve({...result,grammar:getGrammarProgress(),a1Exit:getA1ExitProgress(),a2Exit:getA2ExitProgress(),b1Exit:getB1ExitProgress(),b2Exit:getB2ExitProgress()})
    transaction.onabort = () => reject(new Error('读取备份失败，请重试。'))
  })
}

export async function restoreBackup(data) {
  const snapshot = validateBackup(structuredClone(data))
  const db = await openDatabase()
  const previousGrammar = getGrammarProgress()
  const previousExit = getA1ExitProgress()
  const previousA2Exit = getA2ExitProgress()
  const previousB1Exit = getB1ExitProgress()
  const previousB2Exit = getB2ExitProgress()
  replaceGrammarProgress(snapshot.grammar)
  replaceA1ExitProgress(snapshot.a1Exit)
  replaceA2ExitProgress(snapshot.a2Exit)
  replaceB1ExitProgress(snapshot.b1Exit)
  replaceB2ExitProgress(snapshot.b2Exit)
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['words','settings','packs'], 'readwrite')
    transaction.oncomplete = () => { announceDataChange(); resolve({ words: snapshot.words.length, packs: snapshot.packs.length }) }
    transaction.onabort = () => {
      replaceGrammarProgress(previousGrammar)
      replaceA1ExitProgress(previousExit)
      replaceA2ExitProgress(previousA2Exit)
      replaceB1ExitProgress(previousB1Exit)
      replaceB2ExitProgress(previousB2Exit)
      reject(new Error('恢复失败，原有词库和设置保持不变。请检查存储空间后重试。'))
    }
    transaction.onerror = () => {}
    try {
      for (const name of ['words','settings','packs']) {
        const store = transaction.objectStore(name)
        store.clear()
        for (const record of snapshot[name]) store.add(record)
      }
    } catch { try { transaction.abort() } catch { /* An already-aborted transaction reports through onabort. */ } }
  })
}

export async function addWord(fields) {
  const value = normalizeWord(fields)
  const result = await writeWords(() => ({ words: [value] }))
  return result.addedWords[0]
}

async function writeWords(prepare) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['words', 'settings'], 'readwrite')
    const store = transaction.objectStore('words')
    const settings = transaction.objectStore('settings')
    let result, failure
    const read = store.getAll()
    read.onsuccess = () => {
      const counter = settings.get('importOrder')
      counter.onsuccess = () => {
        try {
          const prepared = prepare(read.result)
          let order = counter.result?.value ?? 0
          const addedWords = prepared.words.map((word) => ({ ...word, ...EMPTY_PROGRESS, status: '未学', id: crypto.randomUUID(), createdAt: Date.now(), importOrder: ++order }))
          for (const word of addedWords) store.add(word)
          for (const word of prepared.updates ?? []) store.put(word)
          settings.put({ key: 'importOrder', value: order })
          result = { addedWords, added: addedWords.length, skipped: prepared.skipped ?? 0, errors: prepared.errors ?? 0, layerUpdated:(prepared.updates??[]).length }
        } catch (error) {
          failure = new Error(`保存失败，未写入任何单词。${error.message}`)
          try { transaction.abort() } catch { /* It may already have been aborted. */ }
        }
      }
    }
    transaction.oncomplete = () => { announceDataChange(); resolve(result) }
    transaction.onabort = () => reject(failure || new Error('保存失败，未写入任何单词。请检查存储空间后重试。'))
    transaction.onerror = () => {}
  })
}

// Both entry points use this transaction: validation + dedup are repeated at commit time.
export function importWords(rows, defaultLevel = '') {
  return writeWords((existing) => {
    const preview = previewImport(rows, existing, defaultLevel)
    const byKey=new Map(existing.map((word)=>[wordKey(word),word]))
    const correctedSchulerin=preview.entries.find((entry)=>entry.kind==='ready'&&entry.word.german==='Schülerin'&&entry.word.article==='die'&&entry.word.level==='B1')
    const oldSchulerin=byKey.get(wordKey({german:'Schülerin',article:'der'}))
    const migrateSchulerin=correctedSchulerin&&oldSchulerin&&!byKey.has(wordKey(correctedSchulerin.word))
    const updates=preview.entries.filter((entry)=>entry.kind==='duplicate'&&entry.word?.layer&&byKey.has(wordKey(entry.word)))
      .map((entry)=>({...byKey.get(wordKey(entry.word)),layer:entry.word.layer}))
      .filter((word)=>word.layer!==byKey.get(wordKey(word)).layer)
    if(migrateSchulerin)updates.push({...oldSchulerin,...correctedSchulerin.word})
    return { words: preview.entries.filter((entry) => entry.kind === 'ready'&&(!migrateSchulerin||entry!==correctedSchulerin)).map((entry) => entry.word), updates, skipped: preview.duplicates+Number(!!migrateSchulerin), errors: preview.errors }
  })
}

export async function getDailyLimit() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('settings').objectStore('settings').get('dailyLimit')
    request.onsuccess = () => resolve(request.result?.value ?? 10)
    request.onerror = () => reject(new Error('无法读取每日上限。'))
  })
}

export async function setDailyLimit(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('每日上限须为大于等于 0 的整数。')
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite')
    const store = transaction.objectStore('settings')
    const active = store.get('studySession')
    let failure
    active.onsuccess = () => {
      if (active.result?.value?.mode === 'learn') {
        failure = new Error('请先完成进行中的新词轮次，再调整每日上限。')
        transaction.abort()
      } else store.put({ key: 'dailyLimit', value })
    }
    transaction.oncomplete = () => { announceDataChange(); resolve() }
    transaction.onabort = () => reject(failure || new Error('设置保存失败，请重试。'))
  })
}

export function setStudyOptions(patch) {
  return studyTransaction(({settings,settingsStore})=>{
    const next = {...DEFAULT_STUDY_OPTIONS,...(settings.get('studyOptions') ?? {}),...patch}
    if (!['sequential','random'].includes(next.newOrder) || !['due','random'].includes(next.reviewOrder)
      || typeof next.autoSpeak !== 'boolean' || !Number.isFinite(next.speechRate) || next.speechRate < 0.5 || next.speechRate > 1.5
      || typeof next.voiceURI !== 'string')
      throw new Error('学习设置无效，请检查选项和语速。')
    settingsStore.put({key:'studyOptions',value:next})
    return next
  })
}

export async function getReviewLog() {
  const db = await openDatabase()
  return new Promise((resolve,reject)=>{
    const request = db.transaction('settings','readonly').objectStore('settings').getAll()
    request.onsuccess = () => resolve(request.result.filter((item)=>item.key.startsWith('reviewLog:')).map((item)=>item.value).sort((a,b)=>a.at.localeCompare(b.at)))
    request.onerror = () => reject(new Error('读取复习流水失败，请重试。'))
  })
}

export async function clearAllData() {
  const db = await openDatabase()
  return new Promise((resolve,reject)=>{
    const transaction = db.transaction(['words','settings','packs'],'readwrite')
    for (const name of ['words','settings','packs']) transaction.objectStore(name).clear()
    const settings = transaction.objectStore('settings')
    settings.put({key:'dailyLimit',value:10})
    settings.put({key:'importOrder',value:0})
    transaction.oncomplete = () => {clearGrammarProgress();clearA1ExitProgress();clearA2ExitProgress();clearB1ExitProgress();clearB2ExitProgress();announceDataChange();resolve()}
    transaction.onabort = () => reject(new Error('清除失败，原有数据保持不变。'))
  })
}

export async function getPacks() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('packs').objectStore('packs').getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法读取词库包。'))
  })
}

export async function savePack(pack) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['packs','settings'], 'readwrite')
    const store = transaction.objectStore('packs')
    const read = store.get(pack.id)
    let failure, exists = false, upgraded = false
    read.onsuccess = () => {
      exists = !!read.result
      if (exists && JSON.stringify(read.result.words) !== JSON.stringify(pack.words)) {
        const old=read.result
        const a1Upgrade=pack.id==='builtin:goethe-a1'&&old.level==='A1'&&old.words.length===682&&pack.words.length===745
          &&new Set(old.words.map(wordKey)).size===682
          &&old.words.every((word)=>pack.words.some((entry)=>wordKey(entry)===wordKey(word)))
        const a2Upgrade=pack.id==='builtin:goethe-a2'&&old.level==='A2'&&old.words.length===605&&pack.words.length===556
          &&new Set(old.words.map(wordKey)).size===605
        const oldKeys=new Set(old.words.map(wordKey)),newKeys=new Set(pack.words.map(wordKey))
        const b1Upgrade=pack.id==='builtin:goethe-b1'&&old.level==='B1'&&old.words.length===1745&&pack.words.length===1740
          &&oldKeys.size===1745&&newKeys.size===1740
          &&[...oldKeys].filter((key)=>!newKeys.has(key)).sort().join('|')===
            ['danach','fühlen','her','herein','hungrig'].map((german)=>wordKey({german,article:''})).concat(wordKey({german:'Schülerin',article:'der'})).sort().join('|')
          &&[...newKeys].filter((key)=>!oldKeys.has(key)).join('|')===wordKey({german:'Schülerin',article:'die'})
        if(a1Upgrade||a2Upgrade||b1Upgrade){
          upgraded=true;store.put(pack)
          const settings=transaction.objectStore('settings')
          const current=settings.get('currentWordbook')
          current.onsuccess=()=>{if(current.result?.value?.id===pack.id)settings.put({key:'currentWordbook',value:{id:pack.id,keys:[...new Set(pack.words.map(wordKey))]}})}
        } else {
          failure = new Error('已有同名、同级别的不同词包，请修改词包 name 后再添加。')
          transaction.abort()
        }
      } else if (!exists) store.add(pack)
    }
    transaction.oncomplete = () => { if(!exists||upgraded) announceDataChange(); resolve({ exists, upgraded }) }
    transaction.onabort = () => reject(failure || new Error('词包保存失败，请重试。'))
  })
}

export async function setCurrentWordbook(packId) {
  const db = await openDatabase()
  return new Promise((resolve,reject)=>{
    const transaction = db.transaction(['packs','settings'],'readwrite')
    const settings = transaction.objectStore('settings')
    let failure, selected
    const active = settings.get('studySession')
    active.onsuccess = () => {
      if (active.result?.value?.mode === 'learn') {
        failure = new Error('请先完成进行中的新词轮次，再切换当前词书。')
        transaction.abort(); return
      }
      const request = transaction.objectStore('packs').get(packId)
      request.onsuccess = () => {
        if (!request.result) {
          failure = new Error('请先将这本词书加入学习。')
          transaction.abort(); return
        }
        selected = {id:packId,keys:[...new Set(request.result.words.map(wordKey))]}
        settings.put({key:'currentWordbook',value:selected})
      }
    }
    transaction.oncomplete = () => { announceDataChange(); resolve(selected) }
    transaction.onabort = () => reject(failure || new Error('当前词书保存失败，请重试。'))
  })
}

async function studyTransaction(operation, mode = 'readwrite', shouldNotify = () => mode === 'readwrite') {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['words', 'settings'], mode)
    const wordsStore = transaction.objectStore('words')
    const settingsStore = transaction.objectStore('settings')
    let result, failure
    const wordsRequest = wordsStore.getAll()
    wordsRequest.onsuccess = () => {
      const settingsRequest = settingsStore.getAll()
      settingsRequest.onsuccess = () => {
        try {
          const settings = new Map(settingsRequest.result.map((entry) => [entry.key, entry.value]))
          result = operation({ words: wordsRequest.result, settings, wordsStore, settingsStore })
        } catch (error) {
          failure = error
          try { transaction.abort() } catch { /* Already aborted. */ }
        }
      }
    }
    transaction.oncomplete = () => { if(shouldNotify()) announceDataChange(); resolve(result) }
    transaction.onabort = () => reject(failure || new Error('学习进度保存失败，本次操作未生效，请重试。'))
    transaction.onerror = () => {}
  })
}

function settleVacation({words,settings,wordsStore,settingsStore},now) {
  const vacation = settings.get('vacation')
  if (!vacation || dayKey(now) <= vacation.end) return words
  const changes = redistributeVacation(words,vacation.start,vacation.end)
  const updated = words.map((word)=>changes.get(word.id) ?? word)
  for (const word of changes.values()) wordsStore.put(word)
  settingsStore.delete('vacation')
  const history = [...(settings.get('vacationHistory') ?? []), vacation]
  settingsStore.put({key:'vacationHistory',value:history})
  settings.delete('vacation')
  settings.set('vacationHistory',history)
  return updated
}

export function getStudyState(now = new Date()) {
  let changed = false
  return studyTransaction((context) => {
    const {settings,settingsStore} = context
    if (settings.get('vacation') && dayKey(now) > settings.get('vacation').end) changed = true
    const words = settleVacation(context,now)
    const baseline = settings.get('backupReminderSince') ?? now.getTime()
    if (!settings.has('backupReminderSince')) { changed = true; settingsStore.put({key:'backupReminderSince',value:baseline}) }
    return {
    words: words.sort((a, b) => b.importOrder - a.importOrder),
    dailyLimit: settings.get('dailyLimit') ?? 10,
    learnedToday: (settings.get(`learned:${dayKey(now)}`) ?? []).length,
    session: settings.get('studySession') ?? null,
    pausedToday: settings.get(`pauseNew:${dayKey(now)}`) === true,
    currentWordbook: settings.get('currentWordbook') ?? null,
    studyOptions: {...DEFAULT_STUDY_OPTIONS,...(settings.get('studyOptions') ?? {})},
    vacation: settings.get('vacation') && dayKey(now) <= settings.get('vacation').end ? settings.get('vacation') : null,
    vacationHistory: settings.get('vacationHistory') ?? [],
    backupReminder: backupReminderDue(settings.get('lastBackupExportAt'),baseline,settings.get('backupReminderDismissedAt'),now),
    outputPassedIds:[...settings.keys()].filter((key)=>key.startsWith('outputPassed:')&&settings.get(key)===true).map((key)=>key.slice('outputPassed:'.length)),
    metrics: {
      reviewCount: settings.get('metric:reviewCount') ?? 0,
      outputCorrect: settings.get('metric:outputCorrect') ?? 0,
      outputTotal: settings.get('metric:outputTotal') ?? 0,
      activityDays: [...settings.keys()].filter((key) => (key.startsWith('activity:') && settings.get(key)) || (key.startsWith('learned:') && settings.get(key)?.length)).map((key) => key.slice(key.indexOf(':') + 1)),
    },
  }
  }, 'readwrite', () => changed)
}

export function setVacation(start,end,now = new Date()) {
  if (!parseLocalDate(start) || !parseLocalDate(end) || start > end || end < dayKey(now)) return Promise.reject(new Error('请填写有效的起止日期，结束日期不能早于今天。'))
  return studyTransaction((context)=>{
    const {settings,settingsStore} = context
    settleVacation(context,now)
    if (settings.get('studySession')?.mode === 'learn') throw new Error('请先完成进行中的新词轮次，再开启假期模式。')
    settingsStore.put({key:'vacation',value:{start,end}})
    return {start,end}
  })
}

export function endVacation(now = new Date()) {
  return studyTransaction((context)=>{
    const {words,settings,wordsStore,settingsStore} = context
    const vacation = settings.get('vacation')
    if (!vacation) return 0
    const yesterday = dayKey(new Date(dueInDays(-1,now)))
    const actualEnd = dayKey(now) > vacation.end ? vacation.end : yesterday
    const changes = actualEnd >= vacation.start ? redistributeVacation(words,vacation.start,actualEnd) : new Map()
    for (const word of changes.values()) wordsStore.put(word)
    settingsStore.delete('vacation')
    if (actualEnd >= vacation.start) settingsStore.put({key:'vacationHistory',value:[...(settings.get('vacationHistory') ?? []),{start:vacation.start,end:actualEnd}]})
    return changes.size
  })
}

export function dismissBackupReminder(now = new Date()) {
  return studyTransaction(({settingsStore})=>settingsStore.put({key:'backupReminderDismissedAt',value:now.getTime()}))
}

export function recordBackupExport(now = new Date()) {
  return studyTransaction(({settingsStore})=>{
    settingsStore.put({key:'lastBackupExportAt',value:now.getTime()})
    settingsStore.delete('backupReminderDismissedAt')
  })
}

export function setNewWordPaused(paused, now = new Date()) {
  return studyTransaction(({ settings, settingsStore }) => {
    if (paused && settings.get('studySession')?.mode === 'learn') throw new Error('请先完成进行中的新词轮次，再暂停新词。')
    const key = `pauseNew:${dayKey(now)}`
    if (paused) settingsStore.put({ key, value: true })
    else settingsStore.delete(key)
    return paused
  })
}

export function startStudy(mode, now = new Date()) {
  if (!['learn', 'review'].includes(mode)) return Promise.reject(new Error('无效的学习模式。'))
  return studyTransaction((context) => {
    const {settings,settingsStore} = context
    const words = settleVacation(context,now)
    const active = settings.get('studySession')
    if (active) {
      if (active.mode !== mode) throw new Error(`请先完成进行中的${active.mode === 'learn' ? '新词学习' : '复习'}轮次。`)
      if (mode === 'learn' && isVacationDay(settings.get('vacation'),now)) return {session:null,words}
      return { session: active, words }
    }
    if (mode === 'learn' && settings.get(`pauseNew:${dayKey(now)}`)) return { session: null, words }
    if (mode === 'learn' && isVacationDay(settings.get('vacation'),now)) return {session:null,words}
    const remaining = Math.max(0, (settings.get('dailyLimit') ?? 10) - (settings.get(`learned:${dayKey(now)}`) ?? []).length)
    const currentKeys = settings.get('currentWordbook')?.keys
    const options = {...DEFAULT_STUDY_OPTIONS,...(settings.get('studyOptions') ?? {})}
    const selected = mode === 'learn'
      ? chooseNewWords(words,remaining,currentKeys,options.newOrder)
      : orderReviews(reviewQueue(words, now).filter((word)=>!vacationContains(settings.get('vacation'),word.dueAt)),options.reviewOrder)
    if (!selected.length) return { session: null, words }
    const session = { id: crypto.randomUUID(), mode, wordIds: selected.map((word) => word.id),
      queue: selected.map((word) => ({ id: word.id, repeat: false })), index: 0, version: 0 }
    settingsStore.put({ key: 'studySession', value: session })
    return { session, words }
  })
}

export function rateStudy(sessionId, version, rating, now = new Date()) {
  return studyTransaction(({ words, settings, wordsStore, settingsStore }) => {
    const session = settings.get('studySession')
    if (!session || session.id !== sessionId || session.version !== version) throw new Error('本轮进度已变化，可能已在其他标签页作答。请重新读取进度。')
    const entry = session.queue[session.index]
    const word = words.find((item) => item.id === entry.id)
    if (!word) throw new Error('当前单词不存在，请重新读取进度。')
    const valid = session.mode === 'learn' ? ['known', 'unknown'] : ['forgot', 'hard', 'remember']
    if (!valid.includes(rating)) throw new Error('无效的自评。')
    const next = advanceSession(session, rating === 'unknown' || rating === 'forgot')
    const done = next.index === next.queue.length
    if (session.mode === 'review') {
      const updated = { ...word, ...reviewProgress(word, rating, now) }
      wordsStore.put(updated)
      words[words.indexOf(word)] = updated
      settingsStore.put({key:`reviewLog:${now.getTime()}:${crypto.randomUUID()}`,value:{at:now.toISOString(),wordId:word.id,german:word.german,article:word.article,rating,dueAtBefore:word.dueAt,dueAtAfter:updated.dueAt,intervalDaysBefore:word.intervalDays,intervalDaysAfter:updated.intervalDays}})
      settingsStore.put({ key: 'metric:reviewCount', value: (settings.get('metric:reviewCount') ?? 0) + 1 })
      settingsStore.put({ key: `activity:${dayKey(now)}`, value: true })
    }
    if (done && session.mode === 'learn') {
      const completedIds = []
      for (const id of session.wordIds) {
        const index = words.findIndex((item) => item.id === id)
        if (index === -1 || words[index].status !== '未学') throw new Error('本轮新词状态已变化，请重新读取进度。')
        const updated = { ...words[index], ...initialLearnedProgress(now) }
        wordsStore.put(updated); words[index] = updated; completedIds.push(id)
      }
      const ledgerKey = `learned:${dayKey(now)}`
      const learned = new Set(settings.get(ledgerKey) ?? [])
      completedIds.forEach((id) => learned.add(id))
      settingsStore.put({ key: ledgerKey, value: [...learned] })
      settingsStore.put({ key: `activity:${dayKey(now)}`, value: true })
    }
    if (done) settingsStore.delete('studySession')
    else settingsStore.put({ key: 'studySession', value: next })
    return { session: done ? null : next, words, completed: done ? session.wordIds.length : 0 }
  })
}

export function startOutputTraining(mode = 'mixed', wrongOnly = false, reset = false) {
  if (!OUTPUT_MODES.includes(mode)) return Promise.reject(new Error('无效的强化训练模式。'))
  return studyTransaction(({ words, settings, settingsStore }) => {
    const active = settings.get('outputSession')
    if (active && !reset) return { session: active, words }
    const selected = outputCandidates(words, wrongOnly, mode)
    if (!selected.length) {
      if (active) settingsStore.delete('outputSession')
      return { session: null, words, completed: false }
    }
    const session = { id: crypto.randomUUID(), mode, wrongOnly, queue: selected.map((word, index) => ({ id: word.id, mode: cardMode(word, index, mode) })), index: 0, version: 0, correct: 0, wrong: 0 }
    settingsStore.put({ key: 'outputSession', value: session })
    return { session, words }
  })
}

export function answerOutputTraining(sessionId, version, answer, now = new Date()) {
  return studyTransaction(({ words, settings, settingsStore, wordsStore }) => {
    const session = settings.get('outputSession')
    if (!session || session.id !== sessionId || session.version !== version) throw new Error('训练进度已变化，请重新读取。')
    const entry = session.queue[session.index]
    const word = words.find((item) => item.id === entry?.id)
    if (!word || word.status !== '学习中') throw new Error('当前词条状态已变化，请重新开始强化训练。')
    const correct = answerMatches(word, entry.mode, answer)
    settingsStore.put({ key: 'metric:outputTotal', value: (settings.get('metric:outputTotal') ?? 0) + 1 })
    if (correct) settingsStore.put({ key: 'metric:outputCorrect', value: (settings.get('metric:outputCorrect') ?? 0) + 1 })
    if (correct && entry.mode==='translation') settingsStore.put({key:`outputPassed:${word.id}`,value:true})
    settingsStore.put({ key: `activity:${dayKey(now)}`, value: true })
    if (!correct) {
      const updated = { ...word, ...reviewProgress(word, 'forgot', now) }
      wordsStore.put(updated)
      words[words.indexOf(word)] = updated
    }
    const next = { ...session, index: session.index + 1, version: session.version + 1,
      correct: session.correct + Number(correct), wrong: session.wrong + Number(!correct) }
    const done = next.index >= next.queue.length
    if (done) settingsStore.delete('outputSession')
    else settingsStore.put({ key: 'outputSession', value: next })
    return { session: done ? null : next, words, feedback: { correct, expected: expectedAnswer(word, entry.mode) }, completed: done, totals: { correct: next.correct, wrong: next.wrong } }
  })
}

export function isSameLocalDay(timestamp, today = new Date()) {
  const date = new Date(timestamp)
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}
