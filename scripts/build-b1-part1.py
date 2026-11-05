"""Transcribe B1-1's eight lessons into the existing grammar-unit format."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target = root / 'src/data/grammarB1Part1.json'
ids = ['p-b1-01', 'p-b1-02', 'g-b1-01', 'g-b1-02',
       'g-b1-03', 't-b1-06', 'g-b1-04', 'g-b1-05']

def span(text, start, end):
    return text.split(start, 1)[1].split(end, 1)[0].strip()

def plain(text):
    return text.replace('**', '').strip()

def table(lines, start):
    caption = lines[start].rstrip('：').strip()
    index = start + 1
    while index < len(lines) and not lines[index].startswith('|'):
        index += 1
    assert index < len(lines), caption
    headers = [cell.strip() for cell in lines[index].strip().strip('|').split('|')]
    rows = []
    index += 2
    while index < len(lines) and lines[index].startswith('|'):
        cells = [cell.strip() for cell in lines[index].strip().strip('|').split('|')]
        if len(cells) > len(headers):
            cells = cells[:len(headers)-1] + [' | '.join(cells[len(headers)-1:])]
        assert len(cells) == len(headers), (caption, lines[index])
        rows.append(cells)
        index += 1
    return {'caption':caption, 'headers':headers, 'rows':rows, 'hl':[]}

def classify(parts):
    baskets = []
    for part in parts:
        found = re.match(r'筐 ([A-C]) (.+?) \[([^\]]+)\]', part)
        if found:
            baskets.append((found.group(1), found.group(2),
                            [item.strip() for item in found.group(3).split(',')]))
    assert len(baskets) >= 2, parts
    groups = [name for _, name, _ in baskets]
    requested = next(part for part in parts if part.startswith(('待分词', '待分句')))
    items = []
    for pair in requested.split(' ', 1)[1].split('、'):
        label, letter = pair.rsplit('→', 1)
        label, letter = label.strip(), letter.strip()
        matches = [(index, values) for index, (basket, _, values) in enumerate(baskets)
                   if basket == letter]
        assert len(matches) == 1, (label, letter)
        index, values = matches[0]
        number = re.match(r'(\d+)\.', label)
        expected = number.group(1) if number else plain(label)
        assert expected in [plain(value) for value in values], (label, values)
        items.append({'text':label, 'group':index})
    assert len(items) == sum(len(values) for _, _, values in baskets)
    return groups, items

def order_answer(tokens, sentence):
    remaining = sentence
    available = list(tokens)
    result = []
    while remaining.strip(' ,;.!?'):
        matches = [token for token in available if remaining.startswith(token)]
        assert matches, (tokens, sentence, remaining)
        token = max(matches, key=len)
        result.append(token)
        available.remove(token)
        remaining = remaining[len(token):].lstrip(' ,;.!?')
    assert not available, (tokens, sentence, available)
    return result

def exercise(line, unit_id):
    number, raw = re.match(r'(\d+)\. (.+)', line).groups()
    parts = [part.strip() for part in raw.split('｜')]
    kind, prompt = parts[0].split('：', 1)
    result = {'type':kind, 'q':prompt.strip()}
    explain = next((part.split('解析：', 1)[1] for part in parts if part.startswith('解析：')), None)
    if explain:
        result['explain'] = explain.strip()
    audio = next((re.search(r'`([^`]+)`', part).group(1)
                  for part in parts if part.startswith('audio：')), None)
    if audio:
        result['audio'] = audio
    display = next((part for part in parts if part.startswith('题干')), None)
    if display:
        result['display'] = re.sub(r'^题干(?:（[^）]+）)?\s*', '', display)
    answer = next((part for part in parts if part.startswith(('answer ', '答 '))), None)
    if answer:
        answer = re.sub(r'^(?:answer|答)\s+', '', answer).strip()
    else:
        assert kind == 'classify', (unit_id, number)
    if kind in ('choice', 'listen_choice'):
        options = next(part.removeprefix('选项').strip() for part in parts if part.startswith('选项'))
        result['options'] = [option.strip() for option in options.split(' / ')]
        result['answer'] = int(answer)
        assert len(result['options']) >= 2 and 0 <= result['answer'] < len(result['options'])
    elif kind in ('fill', 'listen_fill', 'listen_dictation'):
        result['answer'] = answer
        if unit_id == 't-b1-06' and int(number) == 10:
            assert answer == 'nahm fest'
            result['blankAnswers'] = ['nahm', 'fest']
    elif kind == 'order':
        tokens = next(part for part in parts if part.startswith('tokens '))
        result['tokens'] = [token.strip() for token in re.search(r'\[([^\]]+)\]', tokens).group(1).split(',')]
        result['answer'] = order_answer(result['tokens'], answer)
        result['displayAnswer'] = answer
    elif kind == 'classify':
        result['groups'], result['items'] = classify(parts)
    else:
        raise ValueError((unit_id, number, kind))
    return int(number), result

def parse_unit(chunk, match, index):
    unit_id = match.group(3)
    lines = chunk.splitlines()
    tables = [table(lines, i) for i, line in enumerate(lines) if line.startswith('彩色总表')]
    assert tables, unit_id
    rules = span(chunk, '规则要点：', '例句（')
    examples = span(chunk, '例句（', '易错点：')
    pitfalls = span(chunk, '易错点：', '**练习（')
    after_practice = '**跟读短文**' if unit_id.startswith('p-') else '**阅读**'
    practice = span(chunk, '**练习（', after_practice)
    exercises = []
    for line in practice.splitlines():
        if re.match(r'^\d+\. ', line):
            number, item = exercise(line, unit_id)
            assert number == len(exercises) + 1, (unit_id, number)
            exercises.append(item)
    assert len(exercises) == 16, (unit_id, len(exercises))

    if unit_id.startswith('p-'):
        passage = span(chunk, '**跟读短文**', '**标注任务**')
        passage_lines = [line.removeprefix('> ').strip() for line in passage.splitlines()
                         if line.startswith('> ')]
        annotation = chunk.split('**标注任务**', 1)[1]
        writing_lines = [line.strip() for line in annotation.splitlines() if line.strip() and line.strip() != '---']
        task = writing_lines[0].removeprefix('：').strip()
        prompts, references = [], []
        for line in writing_lines[1:]:
            if not re.match(r'^\d+\. ', line):
                continue
            prompt, reference = line.split('（参考：', 1)
            prompts.append(prompt.strip())
            references.append(f'{prompt.split(". ", 1)[0]}. {reference.rstrip("）")}')
        assert len(prompts) == len(references) == 3
        reading = {'text':'\n'.join(passage_lines), 'parts':[], 'questions':[], 'tasks':''}
        writing = {'task':'\n'.join([task, *prompts]),
                   'sample':'参考：\n' + '\n'.join(references),
                   'selfcheck':next(line for line in writing_lines if line.startswith('自查：'))}
        reading_label = '跟读短文'
    else:
        passage = span(chunk, '**阅读**', '**写作**')
        passage_lines = [line.removeprefix('> ').strip() for line in passage.splitlines()
                         if line.startswith('> ')]
        reading = {'text':'\n'.join(passage_lines), 'parts':[], 'questions':[],
                   'tasks':next(line for line in passage.splitlines() if line.startswith('任务：'))}
        writing_lines = [line.strip() for line in chunk.split('**写作**', 1)[1].splitlines()
                         if line.strip() and line.strip() != '---']
        writing = {'task':writing_lines[0].removeprefix('：').strip(),
                   'sample':next(line for line in writing_lines if line.startswith('范文：')),
                   'selfcheck':next(line for line in writing_lines if line.startswith('自查：'))}
        reading_label = '阅读'

    return {'id':unit_id, 'level':'B1', 'order':index+1, 'title':match.group(2), 'titleDe':'',
            'table':tables[0], 'extraTables':tables[1:],
            'rules':[line[2:].strip() for line in rules.splitlines() if line.startswith('- ')],
            'examples':[{'de':line[2:].strip(), 'zh':''} for line in examples.splitlines() if line.startswith('- ')],
            'pitfalls':[line[2:].strip() for line in pitfalls.splitlines() if line.startswith('- ')],
            'exercises':exercises, 'reading':reading, 'readingLabel':reading_label,
            'writing':writing}

headings = list(re.finditer(r'^## 单元 (\d+) · (.+?) ([pgt]-b1-\d+)（order (\d+)）$', source, re.M))
assert len(headings) == 8
units = []
for index, match in enumerate(headings):
    end = headings[index+1].start() if index+1 < len(headings) else source.index('## 本包验收')
    assert match.group(3) == ids[index] and int(match.group(4)) == index+1
    units.append(parse_unit(source[match.end():end], match, index))
target.write_text(json.dumps(units, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print([(unit['id'], len(unit['exercises'])) for unit in units])
