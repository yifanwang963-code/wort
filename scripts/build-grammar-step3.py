"""One-time transcription of the supplied Step 3 grammar manuscript.

Run with the manuscript path as argument. The generated JSON is committed so the
site never depends on a file outside the project.
"""
import json
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text(encoding='utf-8')
output = Path(__file__).resolve().parents[1] / 'src/data/grammarA1More.json'


def plain(value):
    return value.replace('**', '').strip()


def block(text, start, end):
    match = re.search(start + r'\s*(.*?)(?:' + end + r')', text, re.S)
    if not match:
        raise ValueError(f'Missing block: {start}')
    return match.group(1).strip()


def bullets(text):
    return [plain(line[2:]) for line in text.splitlines() if line.startswith('- ')]


def table(text, name):
    match = re.search(r'\*\*' + name + r'\*\*（caption：(.*?)）：\s*\n((?:\|.*\n)+)', text)
    if not match:
        raise ValueError(f'Missing {name} table')
    lines = [[cell.strip() for cell in line.strip().strip('|').split('|')] for line in match.group(2).strip().splitlines()]
    headers, rows = lines[0], lines[2:]
    highlights = [[ri, ci] for ri, row in enumerate(rows) for ci, cell in enumerate(row) if '**' in cell]
    return {'caption': plain(match.group(1)), 'headers': headers,
            'rows': [[plain(cell) for cell in row] for row in rows], 'hl': highlights}


def answer_order(tokens, sentence):
    remaining = sentence.rstrip('.!?')
    result = []
    while remaining:
        matches = [token for token in tokens if remaining.startswith(token)]
        if not matches:
            raise ValueError(f'Cannot match order: {remaining} in {tokens}')
        token = max(matches, key=len)
        result.append(token)
        remaining = remaining[len(token):].lstrip()
    return result


def parse_options(value):
    value = value.removeprefix('选项 ')
    protected = value.replace('er/sie/es', 'er§sie§es')
    return [part.strip().replace('er§sie§es', 'er/sie/es') for part in protected.split('/')]


def exercises(text):
    result = []
    for line in text.splitlines():
        if not re.match(r'^\d+\. ', line):
            continue
        line = re.sub(r'^\d+\. ', '', line)
        kind, detail = line.split('：', 1) if '：' in line and not line.startswith('listen_') else (None, None)
        if line.startswith('listen_'):
            kind = line.split('｜', 1)[0]
            fields = line.split('｜')[1:]
            audio = re.search(r'`([^`]+)`', fields[0]).group(1)
            if kind == 'listen_choice':
                q = fields[1].removeprefix('q：')
                choices = parse_options(fields[2])
                answer = int(fields[3].removeprefix('答 '))
                explanation = fields[4].removeprefix('解析：')
                result.append({'type': kind, 'audio': audio, 'q': q, 'options': choices, 'answer': answer, 'explain': explanation})
            elif kind == 'listen_fill':
                display = fields[1].removeprefix('display：')
                answer = fields[2].removeprefix('答 ')
                explanation = fields[3].removeprefix('解析：')
                result.append({'type': kind, 'audio': audio, 'display': display, 'answer': answer, 'explain': explanation})
            else:
                answer = fields[1].removeprefix('答 ')
                explanation = fields[2].removeprefix('解析：')
                result.append({'type': kind, 'audio': audio, 'answer': answer, 'explain': explanation})
        elif kind == 'order':
            fields = detail.split('｜')
            tokens = [part.strip() for part in re.search(r'tokens \[(.*?)\]', fields[1]).group(1).split(',')]
            sentence = fields[2].removeprefix('answer ')
            result.append({'type': kind, 'tokens': tokens, 'answer': answer_order(tokens, sentence),
                           'explain': fields[3].removeprefix('解析：')})
        elif kind == 'choice':
            fields = detail.split('｜')
            result.append({'type': kind, 'q': fields[0], 'options': parse_options(fields[1]),
                           'answer': int(fields[2].removeprefix('答 ')), 'explain': fields[3].removeprefix('解析：')})
        elif kind == 'fill':
            fields = detail.split('｜')
            result.append({'type': kind, 'q': fields[0], 'answer': fields[1].removeprefix('答 '),
                           'explain': fields[2].removeprefix('解析：')})
        else:
            raise ValueError(f'Unknown exercise: {line}')
    return result


def make_unit(text, unit_id, title, order):
    unit = {'id': unit_id, 'level': 'A1', 'order': order, 'title': title}
    unit['titleDe'] = re.search(r'\*\*titleDe\*\*：(.+)', text).group(1).strip()
    unit['table'] = table(text, '主表')
    unit['extraTables'] = [table(text, '附加表')]
    unit['rules'] = bullets(block(text, r'\*\*规则要点\*\*：', r'\*\*audioChips\*\*|\*\*例句\*\*'))
    examples_text = block(text, r'\*\*例句\*\*[^\n]*：', r'\*\*易错点\*\*')
    unit['examples'] = []
    for line in examples_text.splitlines():
        if line.startswith('- '):
            de, zh = re.match(r'- (.*?)（(.*)）', line).groups()
            unit['examples'].append({'de': de, 'zh': zh})
    unit['pitfalls'] = [item.removeprefix('⚠ ') for item in bullets(block(text, r'\*\*易错点\*\*：', r'\*\*练习'))]
    unit['exercises'] = exercises(block(text, r'\*\*练习[^\n]*：', r'\*\*短文'))
    reading_text = block(text, r'\*\*短文[^\n]*?\*\*：', r'\*\*写作')
    reading_lines = [line for line in reading_text.splitlines() if line.strip()]
    unit['reading'] = {'text': reading_lines[0], 'questions': []}
    for line in reading_lines[1:]:
        if not line.startswith('理解题'):
            continue
        fields = line.split('｜')
        q = re.sub(r'^理解题 \d+：', '', fields[0])
        q = q.split('——此题改问：')[-1]
        unit['reading']['questions'].append({'q': q, 'options': parse_options(fields[1]),
                                             'answer': int(fields[2].removeprefix('答 ')),
                                             'explain': fields[3].removeprefix('解析：')})
    writing = re.search(r'\*\*写作[^\n]*\*\*：(.*?)\n范文：(.*)', text, re.S)
    unit['writing'] = {'task': writing.group(1).strip(), 'sample': writing.group(2).split('\n---', 1)[0].strip()}
    return unit


pronunciation = block(source, r'## 三、发音单元数据[^\n]*', r'## 四、新单元数据')
units = [make_unit(pronunciation, 'g-a1-00', '发音入门：字母与读音规则', 1)]
units[0]['audioChips'] = [
    {'group': '字母表', 'items': [{'label': item, 'speak': item} for item in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']},
    {'group': '变元音与 ß', 'items': [{'label': item, 'speak': item} for item in 'ÄÖÜß']},
    {'group': '字母自测词', 'items': [{'label': item, 'speak': item} for item in 'Anna Berlin China Danke Essen Fußball Garten Haus'.split()]},
]
for order, title, unit_id, body in re.findall(r'### 单元 (\d+) · (.*?) (g-a1-\d+)\s*\n(.*?)(?=\n### 单元|\n---\n\n## 五、|\Z)', source, re.S):
    units.append(make_unit(body, unit_id, title, int(order)))
assert len(units) == 5, [unit['id'] for unit in units]
assert [len(unit['exercises']) for unit in units] == [12, 15, 15, 15, 15]
assert all(len(unit['reading']['questions']) == 2 for unit in units)
output.write_text(json.dumps(units, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Generated {output} with {[len(unit["exercises"]) for unit in units]} exercises')
