import { useCallback, useEffect, useRef, useState } from 'react'
import { exportBackup, restoreBackup } from './db.js'
import { validateBackup } from './backup.js'
import { announceRestore } from './data-events.js'
import { supabase, supabaseConfigured } from './supabase.js'

const META_KEY = 'wort-cloud-sync-meta'
const SCHEMA_VERSION = 1
const SYNC_KEYS = ['wort-grammar-v1','wort-a1-exit-v1','wort-a2-exit-v1','wort-b1-exit-v1','wort-b2-exit-v1','wort-grammar-level']
const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') } catch { return {} } }
const saveMeta = (patch) => localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...patch }))

function captureLocalKeys() {
  return Object.fromEntries(SYNC_KEYS.flatMap((key) => {
    const value = localStorage.getItem(key)
    return value === null ? [] : [[key, value]]
  }))
}

async function localSnapshot() {
  return { backup: await exportBackup(), localKeys: captureLocalKeys() }
}

function hasData(snapshot) {
  const backup = snapshot?.backup
  return Boolean(backup && (backup.words.length || backup.packs.length
    || backup.settings.some(({key,value}) => key !== 'backupReminderSince'
      && !(key === 'dailyLimit' && value === 10) && !(key === 'importOrder' && value === 0))
    || Object.values(snapshot.localKeys || {}).some((value) => value !== '{}' && value !== '"A1"')))
}

function comparable(snapshot) {
  if (!snapshot) return ''
  const backup = { ...snapshot.backup, exportedAt: undefined }
  return JSON.stringify({ backup, localKeys: snapshot.localKeys || {} })
}

function counts(snapshot) {
  const words = snapshot.backup.words
  return {
    learned: words.filter((word) => word.status !== '未学').length,
    reviews: snapshot.backup.settings.find((entry) => entry.key === 'metric:reviewCount')?.value || 0,
    latest: (snapshot.backup.settings.filter((entry) => entry.key.startsWith('activity:') && entry.value)
      .map((entry) => entry.key.slice('activity:'.length)).sort().at(-1)) || '暂无',
  }
}

export function useCloudSync() {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState(supabaseConfigured ? '未登录' : '尚未配置')
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const timer = useRef(null)
  const busy = useRef(false)
  const pending = useRef(false)
  const suppress = useRef(false)
  const statusRef = useRef(status)
  statusRef.current = status

  const upload = useCallback(async (userId, snapshot) => {
    setStatus('同步中'); setError('')
    const updatedAt = new Date().toISOString()
    const { error: writeError } = await supabase.from('user_data').upsert({ user_id: userId, data: snapshot, schema_version: SCHEMA_VERSION, updated_at: updatedAt }, { onConflict: 'user_id' })
    if (writeError) throw writeError
    saveMeta({ userId, localUpdatedAt: updatedAt, cloudUpdatedAt: updatedAt })
    setLastSyncedAt(updatedAt); setStatus('已同步')
  }, [])

  const download = useCallback(async (userId, snapshot, updatedAt) => {
    validateBackup(structuredClone(snapshot?.backup))
    if (!snapshot.localKeys || typeof snapshot.localKeys !== 'object' || Array.isArray(snapshot.localKeys)
      || Object.entries(snapshot.localKeys).some(([key,value]) => !SYNC_KEYS.includes(key) || typeof value !== 'string')) {
      throw new Error('云端附加设置无效，未还原任何数据。')
    }
    const previousKeys = captureLocalKeys()
    suppress.current = true
    try {
      for (const key of SYNC_KEYS) localStorage.removeItem(key)
      for (const [key, value] of Object.entries(snapshot.localKeys || {})) if (SYNC_KEYS.includes(key)) localStorage.setItem(key, value)
      await restoreBackup(snapshot.backup)
      window.dispatchEvent(new Event('wort-cloud-restored'))
      announceRestore()
      saveMeta({ userId, localUpdatedAt: updatedAt, cloudUpdatedAt: updatedAt })
      setLastSyncedAt(updatedAt); setStatus('已同步')
    } catch (error) {
      for (const key of SYNC_KEYS) localStorage.removeItem(key)
      for (const [key, value] of Object.entries(previousKeys)) localStorage.setItem(key, value)
      throw error
    } finally { suppress.current = false }
  }, [])

  const pullCloud = useCallback(async (userId) => {
    const { data, error: readError } = await supabase.from('user_data').select('data,schema_version,updated_at').eq('user_id', userId).maybeSingle()
    if (readError) throw readError
    return data
  }, [])

  const reconcile = useCallback(async (userId, forcedChoice = null) => {
    if (busy.current) return
    busy.current = true
    try {
      const [local, cloud] = await Promise.all([localSnapshot(), pullCloud(userId)])
      if (!cloud) { await upload(userId, local); return }
      if (cloud.schema_version !== SCHEMA_VERSION) throw new Error('云端数据版本与当前网站不匹配，暂未覆盖本地数据。')
      const meta = readMeta()
      const bothHaveData = hasData(local) && hasData(cloud.data)
      const same = comparable(local) === comparable(cloud.data)
      if (forcedChoice) {
        if (forcedChoice === 'cloud') await download(userId, cloud.data, cloud.updated_at)
        else await upload(userId, local)
        setConflict(null); return
      }
      if (meta.userId !== userId && bothHaveData && !same) {
        const localCounts = counts(local), cloudCounts = counts(cloud.data)
        setConflict({ userId, local, cloud: cloud.data, cloudUpdatedAt: cloud.updated_at,
          localCounts, cloudCounts,
          preferred: localCounts.learned + localCounts.reviews >= cloudCounts.learned + cloudCounts.reviews ? 'local' : 'cloud' })
        setStatus('等待选择保留的数据'); return
      }
      if (!hasData(local) && hasData(cloud.data)) { await download(userId, cloud.data, cloud.updated_at); return }
      if (hasData(local) && !hasData(cloud.data)) { await upload(userId, local); return }
      const localTime = Date.parse(meta.localUpdatedAt || '') || 0
      const cloudTime = Date.parse(cloud.updated_at || 0)
      if (cloudTime > localTime) await download(userId, cloud.data, cloud.updated_at)
      else if (localTime > cloudTime || !same) await upload(userId, local)
      else { setLastSyncedAt(cloud.updated_at); setStatus('已同步') }
    } catch (syncError) {
      setError(syncError.message || '同步失败，请稍后重试。'); setStatus('同步失败待重试')
    } finally { busy.current = false }
  }, [download, pullCloud, upload])

  const flush = useCallback(async () => {
    if (!session?.user?.id) return
    if (conflict || busy.current) { pending.current = true; return }
    try { await upload(session.user.id, await localSnapshot()); pending.current = false }
    catch (syncError) { pending.current = true; setError(syncError.message || '同步失败，请稍后重试。'); setStatus('同步失败待重试') }
  }, [session, conflict, upload])

  const chooseConflict = useCallback(async (choice) => {
    if (!conflict) return
    await reconcile(conflict.userId, choice)
  }, [conflict, reconcile])

  useEffect(() => {
    if (!supabase) return undefined
    let alive = true
    supabase.auth.getSession().then(({data}) => { if (alive) setSession(data.session) })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setRecovery(event === 'PASSWORD_RECOVERY')
      if (event === 'PASSWORD_RECOVERY' && location.hash !== '#settings') location.hash = 'settings'
      setSession(nextSession)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) { setStatus(supabaseConfigured ? '未登录' : '尚未配置'); return }
    void reconcile(session.user.id)
  }, [session?.user?.id, reconcile])

  useEffect(() => {
    const changed = () => {
      if (suppress.current) return
      const localUpdatedAt = new Date().toISOString()
      saveMeta({ localUpdatedAt })
      if (!session?.user?.id) return
      setStatus('同步中')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), 5000)
    }
    const online = () => { if (session?.user?.id && (pending.current || statusRef.current === '同步失败待重试')) void reconcile(session.user.id) }
    const pageHidden = () => { if (document.visibilityState === 'hidden') void flush() }
    window.addEventListener('wort-data-changed', changed)
    window.addEventListener('online', online)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', pageHidden)
    return () => {
      window.removeEventListener('wort-data-changed', changed); window.removeEventListener('online', online)
      window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', pageHidden)
      clearTimeout(timer.current)
    }
  }, [session, flush, reconcile])

  const signIn = async (email, password) => {
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) throw authError
  }
  const signUp = async (email, password) => {
    const { data, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) throw authError
    if (!data.session) throw new Error('注册已提交，但当前 Supabase 仍要求邮箱确认；请检查项目的邮箱确认开关。')
  }
  const resetPassword = async (email) => {
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/#settings` })
    if (authError) throw authError
  }
  const updatePassword = async (password) => {
    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) throw authError
    setRecovery(false)
  }
  const signOut = async () => { const { error: authError } = await supabase.auth.signOut(); if (authError) throw authError }

  return { configured: supabaseConfigured, session, status, lastSyncedAt, error, conflict, recovery,
    signIn, signUp, resetPassword, updatePassword, signOut, flush,
    chooseConflict, retry: () => session?.user?.id && reconcile(session.user.id) }
}
