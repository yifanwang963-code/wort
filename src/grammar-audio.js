const germanOnly = (value) => value.replaceAll('**','').replace(/（[^）]*）/gu,'').replace(/[\p{Script=Han}]+/gu,'').replace(/[…→]/gu,' ').trim().replace(/\s+/gu,' ')

export function tableCellAudio(table,rowIndex,columnIndex) {
  const row=table.rows[rowIndex]
  if (!row) return []
  const header=table.headers[0]
  const cell=row[columnIndex]
  const single=(speak)=>[{label:cell,speak}]
  if (header==='德语') return columnIndex===0?single(germanOnly(cell)):[]
  if (header==='字母') return (table.headers.length===6?[0,2,4]:[0]).includes(columnIndex)?single(germanOnly(cell)):[]
  if (header==='关键句型') return single(germanOnly(cell))
  if (header==='音组') return columnIndex===2 ? single(germanOnly(cell)) : []
  if (table.headers.some((heading)=>/der 类/u.test(heading))) {
    return columnIndex>0 && germanOnly(cell) && !cell.startsWith('—')?single(germanOnly(cell)):[]
  }
  if (header==='词尾类型') return columnIndex>0?single(germanOnly(cell)):[]
  if (header==='否定的对象') return columnIndex>0 && germanOnly(cell)?single(germanOnly(cell)):[]
  if (header==='所有者') return cell && germanOnly(cell)?single(germanOnly(cell).replace(/-$/u,'')):[]
  if (header==='人称') {
    const firstForm=table.headers[1]==='词尾'?2:1
    return columnIndex>=firstForm?single(`${row[0].replaceAll('/',' ')} ${germanOnly(cell)}`):[]
  }
  if (header==='变化类型') {
    if (columnIndex===1) return single(germanOnly(cell))
    if (columnIndex===2 || columnIndex===3) return single(`${table.headers[columnIndex].split('/')[0]} ${germanOnly(cell)}`)
    return []
  }
  if (header==='判定' || header==='拼写') {
    return columnIndex===2?cell.split(/[,，]/u).map((part)=>({label:part.trim(),speak:germanOnly(part)})):[]
  }
  if (header==='原形') return columnIndex===0?single(germanOnly(cell)):single(`${table.headers[columnIndex].replaceAll('/',' ')} ${germanOnly(cell)}`)
  if (header==='对象') return columnIndex>=2?single(`${row[0]} ${germanOnly(cell)}`):[]
  if (header==='类型') return columnIndex===2?cell.split('，').map((part)=>({label:part.trim(),speak:germanOnly(part)})):[]
  if (header==='动词') {
    if (table.headers[1]==='意思') return columnIndex===0||columnIndex===2?single(germanOnly(cell)):[]
    return single(germanOnly(cell))
  }
  return single(`${table.headers[columnIndex].replaceAll('/',' ')} ${germanOnly(cell)}`)
}

export function tableCellSpeech(table,rowIndex,columnIndex) {
  return tableCellAudio(table,rowIndex,columnIndex)[0]?.speak ?? null
}

export function splitSentences(text) {
  return text.match(/[^.!?]+(?:[.!?]+[”"']*|$)/gu)?.map((part)=>part.trim()).filter(Boolean) ?? []
}

export function spokenWordCount(text) {
  return text.replace(/[.!?。！？]+$/u,'').trim().split(/\s+/u).filter(Boolean).length
}
