"""Transcribe the ten A1 scenario lessons from package 4."""
import ast
import json
import re
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target=root/'src/data/scenariosA1.json'
shared=ast.parse((root/'scripts/build-package2.py').read_text(encoding='utf-8'))
functions=[node for node in shared.body if isinstance(node,ast.FunctionDef)]
exec(compile(ast.Module(body=functions,type_ignores=[]),'<shared grammar parser>','exec'),globals())

def dialogue_line(line):
    raw=line[2:]; n=raw.rfind('（')
    assert n>0,line
    return {'de':raw[:n].strip(),'zh':raw[n+1:].removesuffix('）').strip()}

units=[]
for section in re.split(r'(?=^## S\d+ )',source,flags=re.M)[1:]:
    section=section.split('## 本包验收标准')[0]
    lines=section.splitlines()
    h=re.match(r'## S(\d+) (.+?) (s-a1-\d+)（建议先学完：(.+?)）',lines[0]); assert h,lines[0]
    n=int(h.group(1))
    u={'id':h.group(3),'level':'A1','order':n,'title':h.group(2),'titleDe':'',
       'recommended':h.group(4),'table':None,'extraTables':[],'rules':[],
       'examples':[],'pitfalls':[],'exercises':[],'reading':{'text':'','questions':[]},
       'writing':{'task':'','sample':''},'speaking':'','sceneWords':[],'readingLabel':'阅读'}
    mode=None
    for line in lines:
        if line.startswith('**场景词串**'):
            u['sceneWords']=[x.strip() for x in field(line).split(', ')]
            u['audioChips']=[{'group':'场景词串','items':[{'label':x,'speak':re.sub(r'（[^）]+）','',x).strip()} for x in u['sceneWords']]}]
        elif line.startswith('**模范对话**'):mode='dialogue'
        elif line.startswith('**关键句型**'):
            raw=field(line)
            u['table']={'caption':'关键句型','headers':['关键句型'],'rows':[[raw]],'hl':[]}
            mode=None
        elif line.startswith('**练习（'):
            mode='exercises';expected=int(re.search(r'（(\d+) 题）',line).group(1))
        elif line.startswith('**阅读'):
            mode='reading';u['reading']['text']=field(line)
        elif line.startswith('**口头任务卡**'):
            mode='speaking';u['speaking']=field(line)
        elif line.startswith('**写作**'):
            mode='writing';u['writing']['task']=field(line)
        elif mode=='dialogue' and line.startswith('- '):u['examples'].append(dialogue_line(line))
        elif mode=='exercises' and re.match(r'^\d+\. ',line):
            if line.startswith('4. order：组句｜tokens [lerne, Ich, Deutsch, Abend, am, jeden]｜answer Ich lerne jeden Abend Deutsch.'):
                line=line.replace('tokens [lerne, Ich, Deutsch, Abend, am, jeden]','tokens [lerne, Ich, Deutsch, Abend, jeden]')
            number,e=exercise(line);assert number==len(u['exercises'])+1,line;u['exercises'].append(e)
        elif mode=='reading' and line.startswith('理解题'):u['reading']['questions'].append(reading_question(line))
        elif mode=='writing' and line.startswith('范文'):u['writing']['sample']=line
    assert len(u['exercises'])==expected==8,u['id']
    assert len(u['reading']['questions'])==2,u['id']
    assert u['examples'] and u['sceneWords'] and u['table'] and u['speaking'] and u['writing']['sample'],u['id']
    units.append(u)
assert [u['id'] for u in units]==[f's-a1-{n:02}' for n in range(1,11)]
target.write_text(json.dumps(units,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Scenarios:',[(u['id'],len(u['examples']),len(u['exercises'])) for u in units])
