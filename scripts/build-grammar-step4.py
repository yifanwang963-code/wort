"""Transcribe the supplied Step 4 manuscript to static site data."""
import json
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text(encoding='utf-8')
output = Path(__file__).resolve().parents[1] / 'src/data/grammarA1Cases.json'


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
    rows = lines[2:]
    return {'caption': plain(match.group(1)), 'headers': lines[0],
            'rows': [[plain(cell) for cell in row] for row in rows],
            'hl': [[ri, ci] for ri, row in enumerate(rows) for ci, cell in enumerate(row) if '**' in cell]}


def parse_options(value):
    protected = value.removeprefix('选项 ').replace('er/sie/es', 'er§sie§es')
    return [part.strip().replace('er§sie§es', 'er/sie/es') for part in protected.split('/')]


def order_answer(tokens, sentence):
    remaining = sentence.rstrip('.!?')
    ordered = []
    while remaining:
        matches = [token for token in tokens if remaining.startswith(token)]
        if not matches:
            raise ValueError(f'Cannot match order: {remaining} in {tokens}')
        token = max(matches, key=len)
        ordered.append(token)
        remaining = remaining[len(token):].lstrip()
    return ordered


def exercises(text):
    result = []
    for line in text.splitlines():
        if not re.match(r'^\d+\. ', line):
            continue
        line = re.sub(r'^\d+\. ', '', line)
        if line.startswith('classify：'):
            prompt, pairs = line.removeprefix('classify：').split('｜')
            groups = ['der', 'die', 'das']
            items = []
            for pair in pairs.split(' / '):
                name, group = pair.split('→')
                items.append({'text': name, 'group': groups.index(group)})
            result.append({'type': 'classify', 'prompt': prompt, 'groups': groups, 'items': items})
            continue
        if line.startswith('listen_'):
            fields = line.split('｜')
            kind = fields[0]
            audio = re.search(r'`([^`]+)`', fields[1]).group(1)
            if kind == 'listen_choice':
                result.append({'type': kind, 'audio': audio, 'q': fields[2].removeprefix('q：'),
                               'options': parse_options(fields[3]), 'answer': int(fields[4].removeprefix('答 ')),
                               'explain': fields[5].removeprefix('解析：')})
            elif kind == 'listen_fill':
                result.append({'type': kind, 'audio': audio, 'display': fields[2].removeprefix('display：'),
                               'answer': fields[3].removeprefix('答 '), 'explain': fields[4].removeprefix('解析：')})
            else:
                result.append({'type': kind, 'audio': audio, 'answer': fields[2].removeprefix('答 '),
                               'explain': fields[3].removeprefix('解析：')})
            continue
        kind, detail = line.split('：', 1)
        fields = detail.split('｜')
        if kind == 'order':
            tokens = [part.strip() for part in re.search(r'tokens \[(.*?)\]', fields[1]).group(1).split(',')]
            result.append({'type': kind, 'tokens': tokens, 'answer': order_answer(tokens, fields[2].removeprefix('answer ')),
                           'explain': fields[3].removeprefix('解析：')})
        elif kind == 'choice':
            result.append({'type': kind, 'q': fields[0], 'options': parse_options(fields[1]),
                           'answer': int(fields[2].removeprefix('答 ')), 'explain': fields[3].removeprefix('解析：')})
        elif kind == 'fill':
            result.append({'type': kind, 'q': fields[0], 'answer': fields[1].removeprefix('答 '),
                           'explain': fields[2].removeprefix('解析：')})
        else:
            raise ValueError(f'Unknown exercise: {line}')
    return result


def make_unit(text, unit_id, title, order):
    unit = {'id': unit_id, 'level': 'A1', 'order': order, 'title': title,
            'titleDe': re.search(r'\*\*titleDe\*\*：(.+)', text).group(1).strip(),
            'table': table(text, '主表'),
            'extraTables': [table(text, '附加表')] if '**附加表**' in text else []}
    unit['rules'] = bullets(block(text, r'\*\*规则要点\*\*：', r'\*\*例句\*\*'))
    unit['examples'] = []
    for line in block(text, r'\*\*例句\*\*：', r'\*\*易错点\*\*').splitlines():
        if line.startswith('- '):
            de, zh = re.match(r'- (.*?)（(.*)）', line).groups()
            unit['examples'].append({'de': de, 'zh': zh})
    unit['pitfalls'] = [part.removeprefix('⚠ ') for part in bullets(block(text, r'\*\*易错点\*\*：', r'\*\*练习'))]
    unit['exercises'] = exercises(block(text, r'\*\*练习[^\n]*：', r'\*\*短文'))
    reading = block(text, r'\*\*短文\*\*：', r'\*\*写作')
    lines = [line for line in reading.splitlines() if line.strip()]
    unit['reading'] = {'text': lines[0], 'questions': []}
    for line in lines[1:]:
        if line.startswith('理解题'):
            fields = line.split('｜')
            unit['reading']['questions'].append({'q': re.sub(r'^理解题 \d+：', '', fields[0]),
                                                 'options': parse_options(fields[1]),
                                                 'answer': int(fields[2].removeprefix('答 ')),
                                                 'explain': fields[3].removeprefix('解析：')})
    writing = re.search(r'\*\*写作\*\*：(.*?)\n范文：(.*)', text, re.S)
    unit['writing'] = {'task': writing.group(1).strip(), 'sample': writing.group(2).split('\n---', 1)[0].strip()}
    return unit


units = []
for order, title, unit_id, body in re.findall(r'## 单元 (\d+) · (.*?) (g-a1-\d+)（order \d+）\s*\n(.*?)(?=\n## 单元|\n---\n\n## 五、|\Z)', source, re.S):
    units.append(make_unit(body, unit_id, title, int(order)))
assert [unit['id'] for unit in units] == ['g-a1-07', 'g-a1-08', 'g-a1-09', 'g-a1-10']
assert [len(unit['exercises']) for unit in units] == [15] * 4
assert all(len(unit['reading']['questions']) == 2 for unit in units)
output.write_text(json.dumps(units, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Generated {output} with {len(units)} units')
