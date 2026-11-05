"""Transcribe the six A2 exit sections from the supplied manuscript."""
import json
import re
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target=root/'src/data/a2Exit.json'

def section(text,start,end):return text.split(start,1)[1].split(end,1)[0].strip()

def choice(line,group=None):
    number,raw=re.match(r'(\d+)\. choice：(.+)',line).groups()
    parts=[part.strip() for part in raw.split('｜')]
    options=next(part.removeprefix('选项').strip() for part in parts if part.startswith('选项'))
    answer=int(next(part.removeprefix('答 ').strip() for part in parts if part.startswith('答 ')))
    result={'number':int(number),'type':'choice','q':parts[0],
            'options':[item.strip() for item in options.split(' / ')],'answer':answer}
    explain=next((part.removeprefix('解析：').strip() for part in parts if part.startswith('解析：')),None)
    if explain:result['explain']=explain
    if group:result['group']=group
    assert len(result['options'])>=2 and 0<=answer<len(result['options']),(line,result)
    return result

grammar_source=section(source,'## 一、语法总测题库','## 二、听力')
groups=[]
for heading in re.finditer(r'^### (.+?)组（抽 9[^）]*）$',grammar_source,re.M):
    groups.append(heading)
assert len(groups)==4,[match.group(0) for match in groups]
grammar=[]
for index,heading in enumerate(groups):
    end=groups[index+1].start() if index+1<len(groups) else len(grammar_source)
    lines=grammar_source[heading.end():end].splitlines()
    questions=[choice(line,heading.group(1)+'组') for line in lines if re.match(r'^\d+\. choice：',line)]
    assert len(questions)==12 and [q['number'] for q in questions]==list(range(1,13)),heading.group(1)
    grammar.extend(questions)

def passages(text,prefix,script_label):
    headings=list(re.finditer(r'^### ('+prefix+r'\d+) · (.+?)（(\d+) 题）$',text,re.M))
    result=[]
    for index,heading in enumerate(headings):
        end=headings[index+1].start() if index+1<len(headings) else len(text)
        chunk=text[heading.end():end]
        if script_label=='脚本：':
            body=next(line.removeprefix('脚本：').strip() for line in chunk.splitlines() if line.startswith('脚本：'))
        else:
            body='\n'.join(line.removeprefix('> ').strip() for line in chunk.splitlines() if line.startswith('> '))
        questions=[choice(line) for line in chunk.splitlines() if re.match(r'^\d+\. choice：',line)]
        assert len(questions)==int(heading.group(3)) and [q['number'] for q in questions]==list(range(1,len(questions)+1)),heading.group(1)
        result.append({'id':heading.group(1),'title':heading.group(2),'text':body,'questions':questions})
    return result

listening=passages(section(source,'## 二、听力','## 三、阅读'),'H','脚本：')
reading=passages(section(source,'## 三、阅读','## 四、写作'),'R','> ')
assert len(listening)==5 and sum(len(part['questions']) for part in listening)==12
assert len(reading)==4 and sum(len(part['questions']) for part in reading)==10

def task_sections(text,prefix):
    headings=list(re.finditer(r'^### ('+prefix+r'\d+) · (.+)$',text,re.M))
    result=[]
    for index,heading in enumerate(headings):
        end=headings[index+1].start() if index+1<len(headings) else len(text)
        result.append((heading.group(2),text[heading.end():end].strip()))
    return result

writing=[]
for title,chunk in task_sections(section(source,'## 四、写作','## 五、口语'),'W'):
    prompt=next(line.removeprefix('任务：').strip() for line in chunk.splitlines() if line.startswith('任务：'))
    checks=next(line.removeprefix('自查清单：').strip() for line in chunk.splitlines() if line.startswith('自查清单：'))
    writing.append({'title':title,'prompt':prompt,'checks':[re.sub(r'\s*□。?$', '',item.strip()) for item in checks.split('；')]})
assert [len(part['checks']) for part in writing]==[8,6]

speaking_source=section(source,'## 五、口语','## 六、词汇关')
speaking=[]
for title,chunk in task_sections(speaking_source,'S'):
    task='\n'.join(line.strip() for line in chunk.splitlines() if line.strip() and not line.strip()=='---')
    speaking.append({'title':title,'task':task})
assert len(speaking)==3

result={'grammar':grammar,'listening':listening,'reading':reading,'writing':writing,'speaking':speaking,
        'speakingRubric':next(line.removeprefix('> ').strip() for line in speaking_source.splitlines() if line.startswith('> 档位：')),
        'vocabulary':{'coreCount':355,'recognitionCount':201,'coreSample':100,'recognitionSample':100,'corePass':85,'recognitionPass':90}}
target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print({key:len(value) for key,value in result.items() if isinstance(value,list)})
