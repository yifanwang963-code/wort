import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'

let activeKey = null
let activeCancel = null
const listeners = new Set()

function publish(key) {
  activeKey = key
  listeners.forEach((listener) => listener(key))
}

export function cancelExampleSpeech() {
  activeCancel?.()
  activeCancel = null
  window.speechSynthesis?.cancel()
  publish(null)
}

export default function ExampleAudioButton({ text, rate = 1, className = 'icon-button' }) {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    const listener = (key) => setSpeaking(key === text)
    listeners.add(listener)
    listener(activeKey)
    return () => {
      listeners.delete(listener)
      if (activeKey === text) cancelExampleSpeech()
    }
  }, [text])

  function play(event) {
    event.preventDefault()
    event.stopPropagation()
    if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return
    if (activeKey === text && window.speechSynthesis.speaking) {
      cancelExampleSpeech()
      return
    }
    activeCancel?.()
    window.speechSynthesis.cancel()
    publish(null)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'de-DE'
    utterance.rate = rate
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => voice.lang === 'de-DE' && voice.localService)
      || voices.find((voice) => voice.lang === 'de-DE') || null
    const key = text
    const finish = () => {
      if (activeKey === key) {
        activeCancel = null
        publish(null)
      }
    }
    utterance.onend = finish
    utterance.onerror = finish
    activeCancel = finish
    publish(key)
    window.speechSynthesis.speak(utterance)
  }

  return <button type="button" className={`${className} example-audio-button${speaking ? ' speaking' : ''}`} onClick={play} aria-label={speaking ? '停止播放例句' : '朗读德语例句'} aria-pressed={speaking}><Volume2 size={18}/></button>
}
