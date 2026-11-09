let voices = []
let initialized = false
let selectedVoiceURI = 'auto'
const listeners = new Set()

function publish() { listeners.forEach((listener) => listener()) }

function refresh() {
  if (!globalThis.speechSynthesis) return
  voices = speechSynthesis.getVoices()
  publish()
}

function initialize() {
  if (initialized || !globalThis.speechSynthesis) return
  initialized = true
  refresh()
  speechSynthesis.addEventListener?.('voiceschanged', refresh)
}

export function subscribeSpeechVoices(listener) {
  initialize()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getGermanVoices() {
  initialize()
  return voices.filter((voice) => voice.lang?.toLowerCase().startsWith('de'))
}

export function setPreferredVoiceURI(uri = 'auto') {
  selectedVoiceURI = uri || 'auto'
  publish()
}

export function getPreferredVoiceURI() { return selectedVoiceURI }

export function chooseGermanVoice(uri = selectedVoiceURI) {
  const candidates = getGermanVoices()
  if (uri && uri !== 'auto') {
    const selected = candidates.find((voice) => voice.voiceURI === uri)
    if (selected) return selected
  }
  const qualityNames = ['google deutsch', 'katja', 'conrad', 'anna']
  const quality = candidates.find((voice) => qualityNames.some((name) => voice.name?.toLowerCase().includes(name)))
  if (quality) return quality
  const germanGermany = candidates.filter((voice) => voice.lang?.toLowerCase() === 'de-de')
  const nonLocal = germanGermany.find((voice) => voice.localService === false)
  if (nonLocal) return nonLocal
  if (germanGermany.length) return germanGermany[0]
  return candidates[0] || null
}

export function applyGermanVoice(utterance, uri = selectedVoiceURI) {
  const voice = chooseGermanVoice(uri)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'de-DE'
  }
  return voice
}
