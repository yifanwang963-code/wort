import { readFileSync, writeFileSync } from 'node:fs'
import { alphabetTips, alphabetFallback, lessons } from './pronunciation-source.mjs'

const book = JSON.parse(readFileSync(new URL('../public/wordbooks/goethe-a1.json', import.meta.url), 'utf8'))
const bookWords = [...new Set(book.words.map((word) => word.german))]
const bookSet = new Set(bookWords)
const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Ä', 'Ö', 'Ü', 'ß']
const examples = (words) => words.map((label) => ({ label, speak: label.replaceAll('/', ' '), source: bookSet.has(label) ? '词包' : '课程补充' }))
const alphabetGroups = letters.map((letter) => {
  const matches = bookWords.filter((word) => word.toLocaleUpperCase('de-DE').startsWith(letter)).slice(0, 4)
  const fallback = alphabetFallback[letter] ?? []
  const words = [...new Set([...matches, ...fallback])].slice(0, 4)
  if (words.length < 4) throw new Error(`字母 ${letter} 缺少 4 个例词`)
  return { title: letter, tip: alphabetTips[letter], words }
})

function makeExercise(group, groupIndex, groups, lesson) {
  const target = lesson.id === 'g-a1-00' ? group.title : group.words[groupIndex % group.words.length]
  const distractors = []
  for (let offset = 1; distractors.length < 3 && offset < groups.length; offset++) {
    const other = groups[(groupIndex + offset) % groups.length]
    const candidate = lesson.id === 'g-a1-00' ? other.title : other.words[0]
    if (candidate !== target && !distractors.includes(candidate)) distractors.push(candidate)
  }
  const position = groupIndex % 4
  const options = [...distractors]
  options.splice(position, 0, target)
  const spoken = target.replaceAll('/', ' ')
  const recognition = { type: 'listen_choice', audio: spoken, q: lesson.id === 'g-a1-00' ? '听到的是哪个字母名？' : '听到的是哪个词或句子？', options, answer: position, explain: group.tip }
  const written = (lesson.id === 'g-a1-00' ? group.words[0] : target).replaceAll('/', ' ')
  const spelling = written.includes(' ')
    ? { type: 'listen_dictation', audio: written, answer: written, explain: `写出 ${written}；${group.tip}` }
    : { type: 'listen_fill', audio: written, display: '听音拼写：___', answer: written, explain: `拼写 ${written}；${group.tip}` }
  return [recognition, spelling]
}

function makeUnit(lesson) {
  const groups = lesson.id === 'g-a1-00' ? [...alphabetGroups, ...lesson.extras] : lesson.groups
  const soundGroups = groups.map((item) => ({ title: item.title, tip: item.tip, words: examples(item.words) }))
  const isAlphabet = lesson.id === 'g-a1-00'
  const table = isAlphabet ? {
    caption: '26 个字母与 Ä/Ö/Ü/ß：点字母听字母名，点例词听词中读音',
    headers: ['字母', '字母名与发音要点', '例词'],
    rows: alphabetGroups.map((item) => [item.title, item.tip, item.words[0]]), hl: [],
  } : {
    caption: '逐项听、读、拼：点例词可听标准德语语音',
    headers: ['音组', '口型、舌位与规则', '例词'],
    rows: groups.map((item) => [item.title, item.tip, item.words[0]]), hl: [],
  }
  const exercises = groups.flatMap((item, index) => makeExercise(item, index, groups, lesson))
  for (const [a, b] of lesson.pairs ?? []) {
    exercises.push({ type: 'listen_choice', audio: a, q: '辨认听到的词形。', options: [a, b], answer: 0, explain: `对比 ${a} / ${b} 的元音长度或音色。` })
    exercises.push({ type: 'listen_choice', audio: b, q: '辨认听到的词形。', options: [a, b], answer: 1, explain: `对比 ${a} / ${b} 的元音长度或音色。` })
    exercises.push({ type: 'listen_fill', audio: b, display: '听音拼写：___', answer: b, explain: `写作 ${b}，注意与 ${a} 的区别。` })
  }
  exercises.push(...lesson.special ?? [])
  return {
    id: lesson.id, level: 'A1', order: lesson.order, title: lesson.title, titleDe: lesson.titleDe,
    table, extraTables: [], rules: lesson.rules, soundGroups,
    examples: lesson.examples.map(([de, zh]) => ({ de, zh })), pitfalls: lesson.pitfalls,
    exercises, reading: { text: lesson.reading, questions: lesson.questions.map(([q, options, answer, explain]) => ({ q, options, answer, explain })) },
    writing: { task: lesson.writing[0], sample: lesson.writing[1] },
    ...(lesson.dialogues ? { dialogues: lesson.dialogues } : {}),
  }
}

const units = lessons.map(makeUnit)
for (const unit of units) {
  for (const group of unit.soundGroups) if (group.words.length < 4) throw new Error(`${unit.id}: ${group.title} 缺少例词`)
  if (unit.exercises.length < unit.soundGroups.length * 2) throw new Error(`${unit.id}: 缺少辨音或拼写题`)
}
writeFileSync(new URL('../src/data/pronunciationA1.json', import.meta.url), JSON.stringify(units, null, 2) + '\n')
const lines = [
  '# A1 发音 P1–P6 覆盖表', '',
  '每项包含口型/舌位或读音提示、至少 4 个可点读例词、1 道听辨题和 1 道听写/拼写题。「词包」指当前内置歌德 A1 词包中的原样词条；「课程补充」指课程自编的常见示例词或短句，不在该词包 682 条原样词条中。词包缺词的音组经用户同意使用补充例词。', '',
]
for (const unit of units) {
  lines.push(`## ${unit.title}`, '', '| 覆盖项 | 提示 | 例词及来源 | 听辨 | 拼写 |', '| --- | --- | --- | --- | --- |')
  for (const group of unit.soundGroups) {
    lines.push(`| ${group.title} | ${group.tip.replaceAll('|', '／')} | ${group.words.map((word) => `${word.label}（${word.source}）`).join('、')} | ✓ | ✓ |`)
  }
  lines.push('')
}
lines.push('语音由设备 Web Speech API 的 de-DE 语音提供。最小对立对和句调的实际听感依赖浏览器与设备语音；视觉与判分检查不能替代真人听辨验收。', '')
const sampleRules = [
  ['Name','重读开音节，a 读长音。'],['Mann','nn 提示前面的 a 短。'],['Bahn','ah 提示长 a。'],['Bett','tt 提示短 e。'],
  ['Bier','ie 通常读一个长 i。'],['Kind','辅音群提示短 i；词尾 d 清化。'],['Sohn','oh 提示长 o。'],['Koffer','ff 提示短 o。'],
  ['Buch','ch 在 u 后读 ach 音。'],['Hund','词尾 d 清化；u 在辅音群前短。'],['Mädchen','-chen 的 ch 读 ich 音。'],['möchten','ö 圆唇且较短；ch 读 ich 音。'],
  ['mein','ei 是双元音。'],['Haus','au 是双元音。'],['heute','eu 是双元音。'],['Schule','sch 读 /ʃ/。'],
  ['ich','i 后 ch 读 ich 音。'],['auch','au 后 ch 读 ach 音。'],['lang','ng 是鼻音，不另加 g。'],['Apfel','pf 两个动作连续。'],
  ['Straße','词首 st 读 /ʃt/；长音后写 ß。'],['stehen','词首 st 读 /ʃt/；eh 提示长 e。'],['aufstehen','可分前缀 auf 带重音。'],['bekommen','be- 前缀不带主重音。'],
  ['Bahnhof','复合词通常重读第一成分；ah 提示长 a。'],['Wasser','w 读 /v/；ss 提示短 a。'],['sprechen','词首 sp 读 /ʃp/；e 后 ch 读 ich 音。'],['schön','sch 读 /ʃ/；ö 圆唇、长读。'],
  ['Geld','词尾 d 清化。'],['Polizei','-ei 附近带主重音。'],
]
if (sampleRules.length !== 30 || sampleRules.some(([word]) => !bookSet.has(word))) throw new Error('30 词抽查表含非词包词')
lines.push('## 30 个词包词的读音规则抽查', '', '| 词包词 | 可解释的规则 |', '| --- | --- |')
for (const [word, rule] of sampleRules) lines.push(`| ${word} | ${rule} |`)
lines.push('')
writeFileSync(new URL('../PRONUNCIATION_COVERAGE.md', import.meta.url), lines.join('\n'))
console.log(`Generated P1–P6: ${units.map((unit) => `${unit.id} ${unit.soundGroups.length}项/${unit.exercises.length}题`).join('；')}`)
