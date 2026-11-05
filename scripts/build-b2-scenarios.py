"""Transcribe the supplied B2-4 scenes into the existing structured scenario format."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text(encoding='utf-8-sig')
wordbook = json.loads((root / 'public/wordbooks/b2.json').read_text(encoding='utf-8'))['words']


def clean(value):
    return value.strip().replace('**', '')


def between(value, start, end):
    return value.split(start, 1)[1].split(end, 1)[0].strip()


def parse_exercise(line, unit_id, number):
    raw = re.match(r'^\d+\. (.+)', line).group(1)
    parts = [part.strip() for part in raw.split('｜')]
    kind, prompt = re.split('[：:]', parts[0], maxsplit=1)
    item = {'type': kind, 'q': clean(prompt)}
    item['explain'] = clean(next(part.split('解析：', 1)[1] for part in parts if part.startswith('解析：')))
    answer = next((part for part in parts if part.startswith(('answer ', '答 '))), None)
    assert answer, (unit_id, number)
    answer = clean(re.sub(r'^(?:answer|答)\s+', '', answer))
    if kind in ('choice', 'listen_choice'):
        options = next(part.split('选项：', 1)[1] for part in parts if part.startswith('选项：'))
        item['options'] = [clean(option) for option in options.split(' / ')]
        item['answer'] = int(answer)
        assert len(item['options']) == 3 and 0 <= item['answer'] < 3, (unit_id, number)
    elif kind == 'fill':
        item['answer'] = answer
    elif kind == 'order':
        raw_tokens = next(part.split('tokens ', 1)[1] for part in parts if part.startswith('tokens '))
        item['tokens'] = [clean(token.strip('[] „“"')) for token in raw_tokens.split(',')]
        item['answer'] = answer.split(' → ')
        assert len(item['tokens']) == len(item['answer']) == 5, (unit_id, number)
        assert sorted(item['tokens']) == sorted(item['answer']), (unit_id, number, item)
    else:
        raise ValueError((unit_id, number, kind))
    audio = next((part.split('`')[1] for part in parts if part.startswith('audio：')), None)
    if audio:
        item['audio'] = audio
    return item


headings = list(re.finditer(r'^## 情景 (\d+) · (.+?) (s-b2-\d+)$', source, re.M))
assert len(headings) == 10
scenes = []
for index, match in enumerate(headings):
    unit_id = match.group(3)
    assert unit_id == f's-b2-{index + 1:02d}'
    end = headings[index + 1].start() if index + 1 < len(headings) else source.index('**B2-4 自查口径**')
    chunk = source[match.end():end]
    intro = between(chunk, '**场景说明**：', '**完整对话**：')
    dialogue = []
    for line in between(chunk, '**完整对话**：', '**重点表达**：').splitlines():
        line = line.strip()
        if not line:
            continue
        if ':' not in line and '：' not in line:
            raise ValueError((unit_id, line))
        speaker, text = re.split('[：:]', line, maxsplit=1)
        dialogue.append({'speaker': speaker, 'text': text.strip(), 'audio': text.strip()})
    expressions = [line[2:].strip() for line in between(chunk, '**重点表达**：', '**练习（').splitlines() if line.startswith('- ')]
    table = {'caption': '重点表达', 'headers': ['德语', '用途'], 'rows': [], 'hl': []}
    for expression in expressions:
        found = re.match(r'(.+?)（(.+)[）)]$', expression)
        assert found, (unit_id, expression)
        table['rows'].append([found.group(1), found.group(2)])
    exercises = []
    for line in between(chunk, '**练习（', '**口头任务**：').splitlines():
        found = re.match(r'^(\d+)\. ', line)
        if found:
            assert int(found.group(1)) == len(exercises) + 1, (unit_id, line)
            exercises.append(parse_exercise(line, unit_id, len(exercises) + 1))
    assert len(exercises) == 10, (unit_id, len(exercises))
    oral = chunk.split('**口头任务**：', 1)[1].split('---', 1)[0].strip()
    parts = re.split(r'\*\*范文\*\*[：:]|\*\*自查\*\*：', oral)
    assert len(parts) == 3, (unit_id, parts)
    dialogue_text = '\n'.join(line['text'] for line in dialogue)
    scene_words = []
    seen = set()
    for word in wordbook:
        german, article = word['german'], word.get('article', '')
        key = (german, article)
        if key not in seen and re.search(r'(?<![A-Za-zÄÖÜäöüß])' + re.escape(german) + r'(?![A-Za-zÄÖÜäöüß])', dialogue_text):
            scene_words.append(' '.join(part for part in [article, german] if part))
            seen.add(key)
    scenes.append({'id': unit_id, 'level': 'B2', 'order': index + 1, 'title': match.group(2),
                   'recommended': '', 'prerequisites': [], 'sceneIntro': intro, 'dialogue': dialogue,
                   'table': table, 'exercises': exercises, 'speaking': clean(parts[0]),
                   'speakingSample': clean(parts[1]), 'speakingSelfcheck': '自查：' + clean(parts[2]),
                   'sceneWords': scene_words})

target = root / 'src/data/scenariosB2.json'
target.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print([(scene['id'], len(scene['dialogue']), len(scene['table']['rows']), len(scene['exercises']), len(scene['sceneWords'])) for scene in scenes])
