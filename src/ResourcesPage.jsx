import { ExternalLink } from 'lucide-react'

const GROUPS = [
  { title: '课程与练习', items: [
    {name:'DW Nicos Weg',url:'https://dw.com/nico',description:'用短剧和配套练习学习 A1 到 B1 德语。'},
    {name:'歌德免费材料',url:'https://www.goethe.de/ins/de/en/kur/ueb.html',description:'按级别寻找免费德语练习、视频和音频。'},
    {name:'Schubert 在线练习',url:'https://www.schubert-verlag.de/aufgaben/',description:'做分级语法和词汇练习，查漏补缺。'},
  ] },
  { title: '查词', items: [
    {name:'DWDS',url:'https://www.dwds.de/',description:'查询德语词义、用法和语料例句。'},
    {name:'LEO 中德词典',url:'https://www.leo.org/chinesisch-deutsch/',description:'查询德中互译和常见表达。'},
  ] },
  { title: '考试准备', items: [
    {name:'歌德考试样题',url:'https://www.goethe.de/en/spr/prf/ueb.html',description:'按考试级别练习听、说、读、写样题。'},
  ] },
]

export default function ResourcesPage() {
  return <div className="resources-page">{GROUPS.map((group)=><section className="resource-group" key={group.title}><h2>{group.title}</h2><div className="resource-list">{group.items.map((item)=><a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer"><span><strong>{item.name}</strong><small>{item.description}</small></span><ExternalLink size={18} aria-hidden="true"/></a>)}</div></section>)}</div>
}
