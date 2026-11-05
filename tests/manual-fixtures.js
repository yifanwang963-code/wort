import { getStudyState } from '../src/db.js'
import { EMPTY_PROGRESS, dueInDays } from '../src/learning.js'

const allowed = location.hostname === 'localhost' && location.port === '5174'
const message = document.querySelector('#message')
const base = { plural:'',exampleDe:'Ich lerne Deutsch.',exampleZh:'我在学德语。',unit:'第三步验收',level:'A1',partOfSpeech:'名词' }
const examples = [
  {german:'Apfel',article:'der',chinese:'苹果（新词第1个）',plural:'Äpfel'},
  {german:'Sonne',article:'die',chinese:'太阳（新词第2个）',plural:'Sonnen'},
  {german:'Buch',article:'das',chinese:'书（新词第3个）',plural:'Bücher'},
  {german:'Tisch',article:'der',chinese:'桌子（忘了：原7天/reps2/lapses2/ease1.4）',status:'学习中',dueAt:dueInDays(-20),intervalDays:7,reps:2,lapses:2,ease:1.4},
  {german:'Tür',article:'die',chinese:'门（模糊：原3天/reps2/ease2.5）',status:'学习中',dueAt:dueInDays(-19),intervalDays:3,reps:2},
  ...['Haus','Fenster','Auto','Kind','Bild','Wasser'].map((german,index)=>({german,article:'das',chinese:`阶梯验证：原 reps=${index}，记得后 ${[1,3,7,14,30,60][index]} 天`,status:'学习中',dueAt:dueInDays(index-18),intervalDays:[1,1,3,7,14,30][index],reps:index})),
  {german:'Geld',article:'das',chinese:'60天之后的算法边界：原reps6/间隔60，记得后108天',status:'学习中',dueAt:dueInDays(-12),intervalDays:60,reps:6},
  {german:'Tag',article:'der',chinese:'明天到期，不应出现在当前复习队列',status:'学习中',dueAt:dueInDays(1),intervalDays:1},
  {german:'Zeit',article:'die',chinese:'已掌握，即使过期也不复习',status:'已掌握',dueAt:dueInDays(-30),intervalDays:60,reps:6},
]

async function inspect() {
  if (!allowed) { message.textContent='请在 http://localhost:5174/tests/manual.html 打开本页。'; return }
  const state=await getStudyState()
  const body=document.querySelector('#rows');body.replaceChildren()
  for (const word of state.words.slice().reverse()) {
    const tr=document.createElement('tr')
    for (const value of [word.german,word.chinese,word.status,word.dueAt===null?'—':new Date(word.dueAt).toLocaleString(),word.intervalDays,word.ease,word.reps,word.lapses]) {
      const td=document.createElement('td');td.textContent=String(value);tr.append(td)
    }
    body.append(tr)
  }
  message.textContent=`每日上限：${state.dailyLimit}；今日已学：${state.learnedToday}；进行中：${state.session ? `${state.session.mode} ${state.session.index}/${state.session.queue.length}` : '无'}`
}

document.querySelector('#prepare').addEventListener('click',async()=>{
  if(!allowed)return inspect()
  const button=document.querySelector('#prepare');button.disabled=true
  try {
    const state=await getStudyState()
    const existing=new Set(state.words.map(word=>word.id))
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('wort-daily',3)
      request.onsuccess=()=>{
        const db=request.result
        const tx=db.transaction(['words','settings'],'readwrite')
        const store=tx.objectStore('settings')
        const count=store.get('importOrder')
        count.onsuccess=()=>{
          let order=count.result?.value??0
          examples.forEach((example,index)=>{
            const id=`qa-step3-${index}`
            if(!existing.has(id))tx.objectStore('words').add({...base,...EMPTY_PROGRESS,status:'未学',...example,id,createdAt:Date.now(),importOrder:++order})
          })
          store.put({key:'importOrder',value:order})
        }
        tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error)
      }
      request.onerror=()=>reject(request.error)
    })
    await inspect()
  }catch(error){message.textContent=error.message}finally{button.disabled=false}
})
document.querySelector('#inspect').addEventListener('click',()=>inspect().catch(error=>{message.textContent=error.message}))
inspect().catch(error=>{message.textContent=error.message})
