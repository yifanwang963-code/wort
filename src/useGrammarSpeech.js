import { useEffect, useRef, useState } from 'react'
import { applyGermanVoice } from './speech-voices.js'

export function useGrammarSpeech() {
  const epoch=useRef(0)
  const [active,setActive]=useState(null)
  const [error,setError]=useState('')
  useEffect(()=>()=>{epoch.current++;globalThis.speechSynthesis?.cancel()},[])

  function prepare(text,rate,token,onEnd) {
    const utterance=new SpeechSynthesisUtterance(text)
    utterance.rate=rate
    applyGermanVoice(utterance)
    utterance.onend=()=>{if(epoch.current===token)onEnd()}
    utterance.onerror=(event)=>{
      if(epoch.current!==token)return
      if(!['canceled','interrupted'].includes(event.error))setError('德语发音暂不可用。')
      setActive(null)
    }
    speechSynthesis.speak(utterance)
  }
  function start(texts,kind,rate=1) {
    epoch.current++
    const token=epoch.current
    setError('');setActive(null)
    if (!globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) {setError('当前浏览器不支持语音朗读。');return}
    speechSynthesis.cancel()
    function next(index) {
      if(epoch.current!==token)return
      if(index>=texts.length){setActive(null);return}
      setActive({kind,index})
      const item=texts[index]
      prepare(typeof item==='string'?item:item.text,typeof item==='string'?rate:item.rate,token,()=>next(index+1))
    }
    next(0)
  }
  function stop() {epoch.current++;globalThis.speechSynthesis?.cancel();setActive(null)}
  return {
    active,error,
    speak:(text,kind='single',rate=1)=>start([text],kind,rate),
    sequence:(texts,kind,rate=1)=>start(texts,kind,rate),
    stop,
  }
}
