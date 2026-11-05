"""Copy package 2's T1–T4 manuscript into static grammar data."""
import json
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target = Path(__file__).resolve().parents[1] / 'src/data/languageToolsA1.json'

def field(line): return line.split('：', 1)[1].strip()
def options(raw):
    if raw.startswith('Ich / kaufe heute /'):
        return ['Ich / kaufe heute / im Supermarkt / Brot und Milch.', 'Ich kaufe / heute im / Supermarkt Brot / und Milch.']
    return [x.strip() for x in re.split(r'\s*/\s*', raw)]

def order_answer(tokens, sentence):
    remaining = sentence
    result=[]
    while remaining.strip(' ,;.!?'):
        matches=[token for token in tokens if remaining.startswith(token)]
        if not matches: raise ValueError((tokens,sentence,remaining))
        token=max(matches,key=len);result.append(token)
        remaining=remaining[len(token):].lstrip(' ,;.!?')
    return result

def table(lines, n):
    caption = re.search(r'caption：(.+?)）', lines[n]).group(1)
    n += 1
    while n < len(lines) and not lines[n].startswith('|'): n += 1
    rows = []
    while n < len(lines) and lines[n].startswith('|'):
        cells = [x.strip() for x in lines[n].strip().strip('|').split('|')]
        if not all(re.fullmatch('-+', x) for x in cells): rows.append(cells)
        n += 1
    return {'caption':caption, 'headers':rows[0], 'rows':rows[1:], 'hl':[]}

def exercise(line):
    num, raw = re.match(r'(\d+)\. (.+)', line).groups()
    parts = [x.strip() for x in raw.split('｜')]
    intro = parts[0]
    kind = intro.split('：',1)[0].split('（',1)[0]
    e = {'type': 'choice' if '按 choice 录入' in raw else kind}
    if kind.startswith('listen_'):
        m = re.search(r'audio：`([^`]+)`', raw)
        e['audio'] = m.group(1)
        if kind == 'listen_choice': e['q'] = next((field(x) for x in parts if x.startswith('q：')), '你听到的是？')
        if kind == 'listen_fill': e['display'] = next(field(x) for x in parts if x.startswith('display：'))
    else: e['q'] = intro.split('：',1)[1].strip()
    explanation = next((x for x in parts if x.startswith('解析：')), None)
    if explanation: e['explain'] = field(explanation)
    answer = next((x[2:] for x in parts if x.startswith('答 ')), None)
    if e['type'] in ('choice','listen_choice'):
        option_text = next(x.split('选项 ',1)[1] for x in parts if '选项 ' in x)
        e['options'] = options(option_text); e['answer'] = int(answer)
        assert 0 <= e['answer'] < len(e['options']), line
    elif kind in ('fill','listen_fill','listen_dictation'): e['answer'] = answer
    elif kind == 'classify':
        pairs = [x.split('→',1) for x in re.split(r'\s*/\s*', parts[1])]
        assert all(len(x)==2 for x in pairs), line
        for p in pairs:
            p[1] = re.sub(r'（(?:共 )?\d+ 条）$', '', p[1].strip())
            if p[1].startswith('首音节（'): p[1] = '首音节'
            if p[1].startswith('后缀('): p[1] = '后缀'
        groups = list(dict.fromkeys(p[1] for p in pairs))
        e.update(groups=groups, items=[{'text':p[0].strip(),'group':groups.index(p[1])} for p in pairs])
    elif kind == 'order':
        tokens = re.search(r'tokens(?:（打乱给出）)?\s*\[([^\]]+)\]', raw)
        answer_match = re.search(r'answer\s*(?:\[([^\]]+)\]|([^｜]+))', raw)
        assert tokens and answer_match, line
        e['tokens'] = [x.strip() for x in re.split('[,，]',tokens.group(1))]
        expected = re.sub(r'（判分[^）]+）','',answer_match.group(1) or answer_match.group(2)).strip()
        e['answer'] = [x.strip() for x in re.split('[,，]',expected)] if answer_match.group(1) or '，' in tokens.group(1) else order_answer(e['tokens'],expected)
        assert len(e['tokens']) == len(e['answer']), line
        assert sorted(e['tokens']) == sorted(e['answer']), line
    else: raise ValueError(line)
    return int(num), e

def reading_question(line):
    p = line.split('｜')
    return {'q':re.sub(r'^理解题\s*\d+：','',p[0]).strip(), 'options':options(p[1].removeprefix('选项 ')),
            'answer':int(p[2].removeprefix('答 ')), 'explain':field(p[3])}

units = []
for section in re.split(r'(?=^## T[1-4] )',source,flags=re.M)[1:]:
    section = section.split('## 本包验收标准')[0]
    lines = section.splitlines()
    h = re.match(r'## T(\d+) (.+?) (g-a1-\d+)（order (\d+)）',lines[0]); assert h, lines[0]
    n = int(h.group(1)); u = {'id':h.group(3),'level':'A1','order':int(h.group(4)),'title':h.group(2),
        'titleDe':'','table':None,'extraTables':[],'rules':[],'examples':[],'pitfalls':[],
        'exercises':[],'reading':{'text':'','questions':[]},'writing':{'task':'','sample':''}}
    mode = None; expected_count = None
    for i,line in enumerate(lines):
        if line.startswith('**titleDe**'): u['titleDe']=field(line)
        elif line.startswith('**主表**'): u['table']=table(lines,i)
        elif line.startswith('**附加表**'): u['extraTables'].append(table(lines,i))
        elif line.startswith('**规则要点**'): mode='rules'
        elif line.startswith('**例句**'): mode='examples'
        elif line.startswith('**易错点**'): mode='pitfalls'
        elif line.startswith('**练习（'): mode='exercises'; expected_count=int(re.search(r'（(\d+) 题）',line).group(1))
        elif line.startswith('**短文'): mode='reading'; u['reading']['text']=field(line)
        elif line.startswith('**写作'): mode='writing'; u['writing']['task']=field(line)
        elif line.startswith('**audioChips**'): mode='chips'; u['audioChips']=[]
        elif mode=='rules' and line.startswith('- '): u['rules'].append(line[2:])
        elif mode=='examples' and line.startswith('- '):
            raw=line[2:]; split=raw.rfind('（'); assert split>0,line
            u['examples'].append({'de':raw[:split].strip(),'zh':raw[split+1:].removesuffix('）').strip()})
        elif mode=='pitfalls' and line.startswith('- '): u['pitfalls'].append(line[2:].removeprefix('⚠ ').strip())
        elif mode=='exercises' and re.match(r'^\d+\. ',line):
            index, e=exercise(line); assert index==len(u['exercises'])+1,line; u['exercises'].append(e)
        elif mode=='reading' and line.startswith('理解题'): u['reading']['questions'].append(reading_question(line))
        elif mode=='reading' and line and not line.startswith('**') and not line.startswith('---'):
            u['reading']['text'] += '\n' + line
        elif mode=='writing' and line.startswith('范文'): u['writing']['sample']+= ('\n' if u['writing']['sample'] else '')+line
        elif mode=='chips' and line.startswith('- 组'):
            group=line.split('「',1)[1].split('」',1)[0]; raw=field(line)
            items=([{'label':x,'speak':x} for x in raw.split('（')[0].split(' ')] if group=='字母表'
                   else [json.loads(x) for x in re.findall(r'\{[^}]+\}',raw)])
            u['audioChips'].append({'group':group,'items':items})
    assert len(u['exercises'])==expected_count,(n,len(u['exercises']),expected_count)
    assert u['table'] and u['rules'] and u['examples'] and u['pitfalls'] and u['reading']['questions'] and u['writing']['sample']
    units.append(u)
assert [u['id'] for u in units]==['g-a1-21','g-a1-19','g-a1-20','g-a1-22']
target.write_text(json.dumps(units,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print([(u['id'],len(u['exercises'])) for u in units])
