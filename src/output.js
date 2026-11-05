export const OUTPUT_MODES = ['mixed', 'dictation', 'translation', 'article', 'cloze']

export function clozePrompt(word) {
  if (!word?.german || !word?.exampleDe) return null
  const source = word.exampleDe.normalize('NFC')
  const target = word.german.normalize('NFC')
  const tokens = [...source.matchAll(/[\p{L}\p{M}]+/gu)]
  const exact = tokens.find((match) => match[0] === target)
  const stem = [...target].slice(0, 4).join('').toLocaleLowerCase('de-DE')
  const selected = exact || (stem.length === 4 ? tokens.find((match) => match[0].toLocaleLowerCase('de-DE').startsWith(stem)) : null)
  if (!selected) return null
  return { sentence: `${source.slice(0, selected.index)}____${source.slice(selected.index + selected[0].length)}`, answer: selected[0] }
}

export function wrongBook(words) {
  return words.filter((word) => (word.lapses ?? 0) >= 2)
    .sort((a, b) => b.lapses - a.lapses || a.importOrder - b.importOrder || a.id.localeCompare(b.id))
}

export function outputCandidates(words, wrongOnly = false, mode = 'mixed') {
  return words.filter((word) => word.status === '学习中' && (!wrongOnly || (word.lapses ?? 0) >= 2)
    && (mode !== 'article' || (word.partOfSpeech === '名词' && ['der', 'die', 'das'].includes(word.article)))
    && (mode !== 'cloze' || clozePrompt(word)))
    .sort((a, b) => (b.lapses ?? 0) - (a.lapses ?? 0) || a.importOrder - b.importOrder || a.id.localeCompare(b.id))
    .slice(0, 10)
}

export function cardMode(word, index, mode) {
  if (mode !== 'mixed') return mode
  const selected = ['dictation', 'translation', 'article', 'cloze'][index % 4]
  if (selected === 'article' && word.partOfSpeech !== '名词') return 'translation'
  if (selected === 'cloze' && !clozePrompt(word)) return 'translation'
  return selected
}

export function expectedAnswer(word, mode) {
  if (mode === 'article') return word.article
  if (mode === 'cloze') return clozePrompt(word)?.answer ?? ''
  return [word.article, word.german].filter(Boolean).join(' ')
}

export function answerMatches(word, mode, answer) {
  // German capitalization and umlauts are significant; only whitespace is tidied.
  if (typeof answer !== 'string') return false
  if (mode === 'cloze') return answer.trim().normalize('NFC') === expectedAnswer(word, mode).normalize('NFC')
  return answer.trim().replace(/\s+/g, ' ').normalize('NFC') === expectedAnswer(word, mode).normalize('NFC')
}
