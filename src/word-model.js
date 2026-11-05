export const WORD_FIELDS = ['german', 'article', 'plural', 'chinese', 'partOfSpeech', 'exampleDe', 'exampleZh', 'unit']
export const PARTS_OF_SPEECH = ['名词', '动词', '形容词', '副词', '代词', '介词', '连词', '数词', '感叹词', '其他', '短语']
export const STATUSES = ['未学', '学习中', '已掌握']
export const WORD_LAYERS = ['核心主动', '被动认读', '扩展认读']

export function normalizeWord(fields) {
  const word = Object.fromEntries(WORD_FIELDS.map((key) => [key, String(fields[key] ?? '').trim()]))
  if (!word.german || !word.chinese || !word.partOfSpeech) throw new Error('请填写德语单词、中文释义和词性。')
  if (word.partOfSpeech === '名词' && !['der', 'die', 'das'].includes(word.article)) throw new Error('请为名词选择冠词。')
  if (word.partOfSpeech !== '名词') { word.article = ''; word.plural = '' }
  return word
}

// Case-sensitive and tuple-based: avoid merging distinct German words or ambiguous concatenations.
export function wordKey(word) { return JSON.stringify([word.german.trim().normalize('NFC'), (word.article || '').trim()]) }

export function selectDailyWords(words, limit = 10) {
  return words.filter((word) => (word.status ?? '未学') === '未学')
    .sort((a, b) => (a.importOrder ?? a.createdAt) - (b.importOrder ?? b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.floor(Number(limit) || 0)))
}
