"""Transcribe B2-5 assessment from the supplied Markdown file."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text(encoding='utf-8-sig')


def section(start, end):
    return source.split(start, 1)[1].split(end, 1)[0].strip()


def clean(text):
    return text.replace('**', '').strip()


def question(line, group=None):
    match = re.match(r'^([A-D]?\d+)\. (.+)', line)
    assert match, line
    parts = [part.strip() for part in match.group(2).split('｜')]
    if group:
        kind, prompt = re.split('[：:]', parts[0], maxsplit=1)
    else:
        kind, prompt = 'choice', parts[0]
    item = {'number': match.group(1), 'type': kind, 'q': clean(prompt)}
    if group:
        item['group'] = group
    options = next((part.split('选项：', 1)[1] for part in parts if part.startswith('选项：')), None)
    answer = next((part for part in parts if part.startswith(('答 ', 'answer '))), None)
    assert answer, line
    answer = clean(re.sub(r'^(?:答|answer)\s+', '', answer))
    if kind == 'choice':
        assert options, line
        item['options'] = [clean(option) for option in options.split(' / ')]
        item['answer'] = int(answer)
        assert 0 <= item['answer'] < len(item['options']), line
    elif kind == 'fill':
        item['answer'] = answer
    else:
        raise ValueError((kind, line))
    explanation = next((part.split('解析：', 1)[1] for part in parts if part.startswith('解析：')), None)
    if explanation:
        item['explain'] = clean(explanation)
    return item


grammar = []
for group in 'ABCD':
    lines = [line for line in source.splitlines() if re.match(r'^' + group + r'\d+\. ', line)]
    assert len(lines) == 18, (group, len(lines))
    items = [question(line, group) for line in lines]
    assert [item['number'] for item in items] == [f'{group}{number}' for number in range(1, 19)]
    grammar.extend(items)

listening_text = section('## 三、听力', '## 四、阅读')
listening = []
for match in re.finditer(r'^\*\*(L\d+) (.+?)\*\*', listening_text, re.M):
    end_match = re.search(r'^\*\*L\d+ ', listening_text[match.end():], re.M)
    end = match.end() + end_match.start() if end_match else len(listening_text)
    chunk = listening_text[match.end():end]
    audio = re.search(r'audio：`([^`]+)`', chunk).group(1)
    items = [question(line) for line in chunk.splitlines() if re.match(r'^\d+\. ', line)]
    assert len(items) == 3, match.group(1)
    listening.append({'id': match.group(1), 'title': match.group(2), 'text': audio, 'questions': items})
assert len(listening) == 4

reading_text = section('## 四、阅读', '## 五、写作')
reading = []
headings = list(re.finditer(r'^\*\*(R\d+) (.+?)\*\*', reading_text, re.M))
for index, match in enumerate(headings):
    end = headings[index + 1].start() if index + 1 < len(headings) else len(reading_text)
    chunk = reading_text[match.end():end]
    lines = [clean(line[2:]) for line in chunk.splitlines() if line.startswith('> ')]
    items = [question(line) for line in chunk.splitlines() if re.match(r'^\d+\. ', line)]
    assert lines and len(items) == [4, 3, 3, 3, 2][index], match.group(1)
    reading.append({'id': match.group(1), 'title': match.group(2), 'text': '\n'.join(lines), 'questions': items})
assert len(reading) == 5

writing_text = section('## 五、写作', '## 六、口语')
writing = []
headings = list(re.finditer(r'^\*\*(W[12]) (.+?)\*\*', writing_text, re.M))
assert len(headings) == 2
for index, match in enumerate(headings):
    end = headings[index + 1].start() if index + 1 < 2 else len(writing_text)
    chunk = writing_text[match.end():end]
    prompt = chunk.split('**范文**', 1)[0].lstrip('。').strip()
    sample = chunk.split('**范文**', 1)[1].split('**自查**：', 1)[0].strip()
    sample = re.sub(r'^（约 \d+ 词）：', '', sample)
    if index == 1:
        sample = sample.replace('（换行）', '\n').replace('(换行）', '\n')
        sample = re.sub(r'\n\s+', '\n', sample)
    checks = [re.sub(r'\s*□[。]?$', '', item.strip()) for item in chunk.split('**自查**：', 1)[1].split('；')]
    writing.append({'title': match.group(2), 'prompt': clean(prompt), 'sample': clean(sample), 'checks': checks})

speaking_text = section('## 六、口语', '## 七、词汇关')
speaking = []
headings = list(re.finditer(r'^\*\*(S[12]) (.+?)\*\*：', speaking_text, re.M))
assert len(headings) == 2
for index, match in enumerate(headings):
    end = headings[index + 1].start() if index + 1 < 2 else len(speaking_text)
    chunk = speaking_text[match.end():end].strip()
    task, checklist = chunk.split('评分自查', 1)
    checks = [re.sub(r'\s*□[。]?$', '', item.strip()) for item in re.sub(r'^（[^）]+）：|^：', '', checklist).split('；')]
    speaking.append({'title': match.group(2), 'task': clean(task), 'checks': checks})

data = {'grammar': grammar, 'listening': listening, 'reading': reading, 'writing': writing,
        'speaking': speaking, 'vocabulary': {'coreCount': 664, 'recognitionCount': 1352,
        'coreSample': 150, 'recognitionSample': 150, 'corePass': 128, 'recognitionPass': 135}}
(root / 'src/data/b2Exit.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print({key: len(value) for key, value in data.items() if isinstance(value, list)})
