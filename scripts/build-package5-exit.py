"""Transcribe the A1 exit assessment from package 5."""
import ast
import json
import re
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
shared=ast.parse((root/'scripts/build-package2.py').read_text(encoding='utf-8'))
functions=[node for node in shared.body if isinstance(node,ast.FunctionDef)]
exec(compile(ast.Module(body=functions,type_ignores=[]),'<shared grammar parser>','exec'),globals())

def between(start,end):return source.split(start,1)[1].split(end,1)[0]
grammar_text=between('### 语法总测','### 听力测')
grammar=[]
for line in grammar_text.splitlines():
    if not re.match(r'^\d+\. ',line):continue
    number,item=exercise(line)
    assert number==len(grammar)+1,line
    group=re.search(r'｜\[([^\]]+)\]$',line)
    assert group,line
    item['group']=group.group(1)
    grammar.append(item)
assert len(grammar)==30

def questions(line):
    result=[]
    for match in re.finditer(r'题\s*(\d+)[:：](.*?)选项 (.*?)｜答 (\d+)(?=。题|。?$|\s*题\s*\d+[:：])',line):
        result.append({'number':int(match.group(1)),'q':match.group(2).strip().rstrip('｜').strip(),
                       'options':[x.strip() for x in match.group(3).split(' / ')],
                       'answer':int(match.group(4))})
    return result

listening_text=between('### 听力测','### 阅读测')
listening=[];part=None
for line in listening_text.splitlines():
    if line.startswith('**Teil '):
        title=line.split('**',2)[1]
        if title.startswith('Teil '):
            part={'title':title,'clips':[]};listening.append(part)
    if '`' in line and part:
        clips=re.findall(r'`([^`]+)`',line)
        if clips:
            qs=questions(line)
            assert qs,line
            part['clips'].append({'audio':clips[0],'questions':qs})
assert len(listening)==4 and [sum(len(c['questions']) for c in p['clips']) for p in listening]==[4,2,2,2]
assert [q['number'] for p in listening for c in p['clips'] for q in c['questions']]==list(range(1,11))

reading_text=between('### 阅读测','### 写作测')
reading=[]
for line in reading_text.splitlines():
    if line.startswith('**Text '):
        m=re.match(r'\*\*(Text \d+ [^*]+)\*\*：(.*)',line)
        assert m,line
        reading.append({'title':m.group(1),'text':m.group(2).strip(),'questions':questions(line)})
    elif line.startswith('题 ') and reading:reading[-1]['questions'].extend(questions(line))
assert len(reading)==3 and [len(x['questions']) for x in reading]==[2,3,3]
assert [q['number'] for p in reading for q in p['questions']]==list(range(1,9))

writing_text=between('### 写作测','### 口语测')
writing=[]
for line in writing_text.splitlines():
    if line.startswith('**Teil '):
        h=re.match(r'\*\*(Teil \d+ [^*]+)\*\*：(.*)',line);assert h,line
        title,body=h.groups()
        prompt,check_text=body.split('自查表：',1)
        checks=[x.strip().rstrip('。') for x in re.split('[①②③④]',check_text) if x.strip()]
        assert len(checks)==4,line
        writing.append({'title':title,'prompt':prompt.strip(),'checks':checks})
assert len(writing)==2

speaking_text=between('### 口语测','### 词汇关')
speaking=[];rubric=''
for line in speaking_text.splitlines():
    if line.startswith('**Teil '):
        h=re.match(r'\*\*(Teil \d+ [^*]+)\*\*：(.*)',line);assert h,line
        speaking.append({'title':h.group(1),'task':h.group(2).strip()})
    if line.startswith('**评分清单'):rubric=line
assert len(speaking)==3 and rubric

output={'grammar':grammar,'listening':listening,'reading':reading,'writing':writing,
        'speaking':speaking,'speakingRubric':rubric,'vocabulary':{'coreCount':340,'recognitionCount':405,
        'coreSample':100,'recognitionSample':100,'corePass':85,'recognitionPass':90}}
(root/'src/data/a1Exit.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
book=json.loads((root/'public/wordbooks/goethe-a1.json').read_text(encoding='utf-8'))
vocab=[{key:w[key] for key in ['german','article','chinese','partOfSpeech','layer']} for w in book['words']]
(root/'src/data/a1Vocabulary.json').write_text(json.dumps(vocab,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('A1 exit: 30 grammar, 10 listening, 8 reading, 2 writing, 3 speaking, 745 vocabulary')
