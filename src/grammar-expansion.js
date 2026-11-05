import expansion from './data/grammarExpansionA1.json' with { type: 'json' }
import comparisonsA2 from './data/grammarComparisonsA2.json' with { type: 'json' }
import comparisonsB1 from './data/grammarComparisonsB1.json' with { type: 'json' }
import comparisonsB2 from './data/grammarComparisonsB2.json' with { type: 'json' }

export const grammarComparisons=[...expansion.comparisons,...comparisonsA2,...comparisonsB1,...comparisonsB2]

export const finalGrammarOrder=[
  'g-a1-p1','g-a1-p2','g-a1-p3','g-a1-p4','g-a1-p5','g-a1-p6',
  'g-a1-21','g-a1-19','g-a1-20','g-a1-01','g-a1-02','g-a1-03',
  'g-a1-04','g-a1-05','g-a1-06','g-a1-11','g-a1-07','g-a1-08',
  'g-a1-09','g-a1-10','g-a1-12','g-a1-26','g-a1-24','g-a1-13',
  'g-a1-23','g-a1-14','g-a1-25','g-a1-15','g-a1-16','g-a1-17',
  'g-a1-18','g-a1-22',
]

export function expandGrammarUnits(baseUnits) {
  const byId=new Map([...baseUnits,...expansion.newUnits].map((unit)=>[unit.id,unit]))
  byId.set('g-a1-13',expansion.replacement)
  return finalGrammarOrder.map((id,index)=>{
    const unit=byId.get(id)
    if(!unit)throw new Error(`缺少语法单元 ${id}`)
    const addition=expansion.additions[id]
    if(!addition)return {...unit,order:index+1}
    let table=unit.table
    let extraTables=[...unit.extraTables,...addition.tables]
    if(id==='g-a1-10'){
      extraTables=extraTables.map((entry,position)=>position===0?{
        ...entry,rows:[...entry.rows,['与格','meinem','meiner','meinem','meinen']],
      }:entry)
    }
    if(id==='g-a1-12'){
      table={...table,rows:[...table.rows,['与格','mir','dir','ihm','ihr','ihm','uns','euch','ihnen','Ihnen']]}
    }
    return {...unit,order:index+1,table,extraTables,
      extensionContent:[...(unit.extensionContent||[]),...addition.content.filter((item)=>item.text).map((item)=>`${item.label}：${item.text}`)],
      additionalReading:addition.additionalReading,
      audioChips:[...(unit.audioChips||[]),...(addition.audioChips||[])],
      exercises:[...unit.exercises,...addition.exercises],
    }
  })
}
