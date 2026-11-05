// Refresh other open tabs after whole-database restoration without changing stored data.
let channel
try { if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('wort-data-changes') } catch { /* Focus refresh remains available. */ }
export function listenForRestore() { if (channel) channel.onmessage = (event) => { if (event.data === 'restored') location.reload() } }
export function announceRestore() { channel?.postMessage('restored') }
