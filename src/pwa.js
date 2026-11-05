export function registerServiceWorker() {
  // The development server must stay live; only the built app installs an offline shell.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const register = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      await navigator.serviceWorker.ready
      document.documentElement.dataset.offlineReady = 'true'
    } catch (error) { console.warn('离线资源未准备完成，请联网重新打开 Wort。', error) }
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
