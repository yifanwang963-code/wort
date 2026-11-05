"""Transcribe B2-2's eight lessons into the existing grammar-unit format."""
import json
import itertools
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target = Path(sys.argv[2]) if len(sys.argv) > 2 else root / 'src/data/grammarB2Part2.json'
for before, after in [
    ('tokens [„zu", „Die Ergebnisse"', 'tokens [„Die Ergebnisse"'),
    ('15. choice：与格词尾', '15. fill：与格词尾'),
    ('ist, der Bahnhof bleibt geöffnet.', 'ist, bleibt der Bahnhof geöffnet.'),
]:
    assert source.count(before) == 1, before
    source = source.replace(before, after)
ids = ['g-b2-06', 't-b2-03', 'g-b2-07', 'g-b2-08',
       'g-b2-09', 't-b2-04', 'g-b2-10', 'g-b2-11']

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
    def normalize(value):
        return re.sub(r'[\s/,.;!?→„“"]+', '', value)
    expected = normalize(sentence)
    matches = [candidate for candidate in itertools.permutations(tokens)
               if normalize(' '.join(candidate)) == expected]
    assert len(matches) == 1, (tokens, sentence, len(matches))
    return list(matches[0])

def exercise(line, unit_id):
    number, raw = re.match(r'(\d+)\. (.+)', line).groups()
    parts = [part.strip() for part in raw.split('｜')]
    kind, prompt = re.split(r'[：:]', parts[0], maxsplit=1)
    result = {'type':kind, 'q':prompt.strip()}
    explain = next((re.sub(r'^解析[：:]', '', part) for part in parts if re.match(r'^解析[：:]', part)), None)
    if explain:
        result['explain'] = explain.strip()
    audio = next((re.search(r'`([^`]+)`', part).group(1)
                  for part in parts if re.match(r'^audio[：:]', part)), None)
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
        options = next((re.sub(r'^选项[：:]', '', part).strip() for part in parts if re.match(r'^选项[：:]', part)), None)
        assert options is not None, (unit_id, number, parts)
        result['options'] = [option.strip() for option in re.split(r'\s+/\s*|/\s+', options)]
        result['answer'] = int(answer)
        assert len(result['options']) >= 2 and 0 <= result['answer'] < len(result['options']), (unit_id, number, result['options'], result['answer'])
    elif kind in ('fill', 'listen_fill', 'listen_dictation'):
        result['answer'] = answer
    elif kind == 'order':
        tokens = next(part for part in parts if part.startswith('tokens '))
        result['tokens'] = re.findall(r'„([^”"]+)[”"]', re.search(r'\[([^\]]+)\]', tokens).group(1))
        assert result['tokens'], (unit_id, number, tokens)
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
    practice = span(chunk, '**练习（', '**阅读**')
    exercises = []
    for line in practice.splitlines():
        if re.match(r'^\d+\. ', line):
            number, item = exercise(line, unit_id)
            assert number == len(exercises) + 1, (unit_id, number)
            exercises.append(item)
    assert len(exercises) == 16, (unit_id, len(exercises))

    next_section = '**口头任务**' if unit_id == 't-b2-03' else '**写作**'
    passage = span(chunk, '**阅读**', next_section)
    passage_lines = [line.removeprefix('> ').strip() for line in passage.splitlines()
                     if line.startswith('> ')]
    reading = {'text':'\n'.join(passage_lines), 'parts':[], 'questions':[],
               'tasks':next(line for line in passage.splitlines() if line.startswith('任务：'))}
    if unit_id == 't-b2-03':
        raw = chunk.split('**口头任务**', 1)[1]
        task, remainder = raw.split('**范文**', 1)
        sample, selfcheck = remainder.split('**自查**', 1)
        writing = {'task':task.removeprefix('：').strip(),
                   'sample':'范文：' + sample.removeprefix('：').strip().rstrip('｜').strip(),
                   'selfcheck':'自查：' + selfcheck.removeprefix('：').strip().split('\n')[0]}
        writing_label = '口头任务'
    else:
        raw = chunk.split('**写作**', 1)[1]
        task, remainder = raw.split('**范文**', 1)
        sample, selfcheck = remainder.split('**自查**', 1)
        writing = {'task':task.removeprefix('：').strip(),
                   'sample':'范文：' + sample.removeprefix('：').strip().rstrip('｜').strip(),
                   'selfcheck':'自查：' + selfcheck.removeprefix('：').strip().split('\n')[0]}
        writing_label = '写作'

    def parse_example(line):
        value = line[2:].strip()
        found = re.match(r'^(.*?)(（[^（）]*）)$', value)
        return {'de':found.group(1).strip(), 'zh':found.group(2)} if found else {'de':value, 'zh':''}
    return {'id':unit_id, 'level':'B2', 'order':index+9, 'title':match.group(2), 'titleDe':'',
            'table':tables[0], 'extraTables':tables[1:],
            'rules':[line[2:].strip() for line in rules.splitlines() if line.startswith('- ')],
            'examples':[parse_example(line) for line in examples.splitlines() if line.startswith('- ')],
            'pitfalls':[line[2:].strip() for line in pitfalls.splitlines() if line.startswith('- ')],
            'exercises':exercises, 'reading':reading, 'readingLabel':'阅读',
            'writing':writing, 'writingLabel':writing_label}

headings = list(re.finditer(r'^## 单元 (\d+) · (.+?) ([pgt]-b2-\d+)（order (\d+)）$', source, re.M))
assert len(headings) == 8
units = []
for index, match in enumerate(headings):
    end = headings[index+1].start() if index+1 < len(headings) else source.index('**B2-2 自查口径**')
    assert match.group(3) == ids[index] and int(match.group(4)) == index+9
    units.append(parse_unit(source[match.end():end], match, index))
target.write_text(json.dumps(units, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print([(unit['id'], len(unit['exercises'])) for unit in units])
