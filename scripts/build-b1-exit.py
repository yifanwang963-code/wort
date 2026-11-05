"""Transcribe the B1-5 exit assessment into the existing exit data shape."""
import json
import re
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target=root/'src/data/b1Exit.json'

def block(text,start,end):return text.split(start,1)[1].split(end,1)[0].strip()
def clean(text):return text.replace('**','').strip()

def order_answer(tokens,sentence):
    remaining=sentence
    available=list(tokens)
    answer=[]
    while remaining.strip(' ,;:!?.'):
        matches=[token for token in available if remaining.startswith(token)]
        assert matches,(tokens,sentence,remaining)
        token=max(matches,key=len)
        answer.append(token)
        available.remove(token)
        remaining=remaining[len(token):].lstrip(' ,;:!?.')
    assert not available,(tokens,sentence,available)
    return answer

def question(line,group=None):
    number,raw=re.match(r'(\d+)\. (.+)',line).groups()
    parts=[part.strip() for part in raw.split('｜')]
    kind,prompt=parts[0].split('：',1)
    item={'number':int(number),'type':kind,'q':clean(prompt)}
    if group:item['group']=group
    explain=next((part.split('解析：',1)[1] for part in parts if part.startswith('解析：')),None)
    if explain:item['explain']=clean(explain)
    display=next((part for part in parts if part.startswith('题干')),None)
    if display:item['display']=clean(re.sub(r'^题干(?:（[^）]+）)?\s*','',display))
    answer=next((part for part in parts if part.startswith(('答 ','answer '))),None)
    if answer:answer=clean(re.sub(r'^(?:答|answer)\s+','',answer))
    else:assert kind=='classify',(number,raw)
    if kind=='choice':
        options=next(part.removeprefix('选项').strip() for part in parts if part.startswith('选项'))
        item['options']=[clean(option) for option in options.split(' / ')]
        item['answer']=int(answer)
        assert len(item['options'])>=2 and 0<=item['answer']<len(item['options']),line
    elif kind=='fill':item['answer']=answer
    elif kind=='order':
        tokens=[clean(token) for token in re.search(r'\[([^\]]+)\]',next(part for part in parts if part.startswith('tokens '))).group(1).split(',')]
        item['tokens']=tokens
        item['answer']=order_answer(tokens,answer)
        item['displayAnswer']=answer
    elif kind=='classify':
        baskets=[]
        for part in parts:
            match=re.match(r'筐 ([A-D]) (.+?) \[([^\]]+)\]',part)
            if match:baskets.append((match.group(1),clean(match.group(2)),[number.strip() for number in match.group(3).split(',')]))
        assert len(baskets)>=2,line
        requested=next(part for part in parts if part.startswith(('待分句','待分短语','待分词')))
        items=[]
        for pair in requested.split(' ',1)[1].split('、'):
            value,letter=pair.rsplit('→',1)
            value=value.strip();letter=letter.strip()
            ordinal=re.match(r'^(\d+)\.',value).group(1)
            matches=[index for index,(name,_,numbers) in enumerate(baskets) if name==letter and ordinal in numbers]
            assert len(matches)==1,(line,value)
            items.append({'text':value,'group':matches[0]})
        assert len(items)==sum(len(numbers) for _,_,numbers in baskets)
        item['groups']=[name for _,name,_ in baskets]
        item['items']=items
    else:raise ValueError((number,kind))
    return item

grammar_text=block(source,'## 一、语法总测题库','## 二、听力')
group_headings=list(re.finditer(r'^### (组[一二三四]) · (.+?)（15 题[^）]*）$',grammar_text,re.M))
assert len(group_headings)==4
grammar=[]
for index,heading in enumerate(group_headings):
    end=group_headings[index+1].start() if index+1<len(group_headings) else len(grammar_text)
    group=heading.group(2)
    items=[question(line,group) for line in grammar_text[heading.end():end].splitlines() if re.match(r'^\d+\. ',line)]
    assert len(items)==15 and [item['number'] for item in items]==list(range(1,16)),group
    grammar.extend(items)

def passages(text,prefix,expected_counts):
    headings=list(re.finditer(r'^### '+prefix+r' (\d+) · (.+?)（(\d+) 题）$',text,re.M))
    assert len(headings)==len(expected_counts)
    result=[]
    expected_number=1
    for index,heading in enumerate(headings):
        end=headings[index+1].start() if index+1<len(headings) else len(text)
        chunk=text[heading.end():end]
        lines=[clean(line.removeprefix('> ')) for line in chunk.splitlines() if line.startswith('> ')]
        assert lines,(prefix,index)
        items=[question(line) for line in chunk.splitlines() if re.match(r'^\d+\. ',line)]
        assert len(items)==int(heading.group(3))==expected_counts[index]
        assert [item['number'] for item in items]==list(range(expected_number,expected_number+len(items)))
        expected_number+=len(items)
        result.append({'id':f'{prefix}{index+1}','title':heading.group(2),'text':'\n'.join(lines),'questions':items})
    return result

listening=passages(block(source,'## 二、听力','## 三、阅读'),'听力',[3,2,3,2,2,2])
reading=passages(block(source,'## 三、阅读','## 四、写作'),'阅读',[2,3,2,2,3])
old_closing='Mit freundlichen Grüßen, Personalabteilung'
new_closing='Mit freundlichen Grüßen\nPersonalabteilung'
if old_closing in reading[4]['text']:
    reading[4]['text']=reading[4]['text'].replace(old_closing,new_closing)
else:assert new_closing in reading[4]['text']

writing_text=block(source,'## 四、写作','## 五、口语')
writing_headings=list(re.finditer(r'^### (W[12]) (.+)$',writing_text,re.M))
assert len(writing_headings)==2
writing=[]
for index,heading in enumerate(writing_headings):
    end=writing_headings[index+1].start() if index+1<len(writing_headings) else len(writing_text)
    lines=[line.strip() for line in writing_text[heading.end():end].splitlines() if line.strip()]
    prompt=next(line for line in lines if line.startswith('任务要点'))
    sample_index=next(i for i,line in enumerate(lines) if line.startswith('参考范文：'))
    check_index=next(i for i,line in enumerate(lines) if line.startswith('自查：'))
    sample='\n'.join(lines[sample_index:check_index])
    checks=lines[check_index].removeprefix('自查：').split('；')
    writing.append({'title':heading.group(2),'prompt':prompt,'sample':sample,
                    'checks':[re.sub(r'\s*□[。]?$', '',part.strip()) for part in checks]})
assert [len(part['checks']) for part in writing]==[4,4]

speaking_text=block(source,'## 五、口语','## 六、词汇关')
speaking_headings=list(re.finditer(r'^### 部分 ([123]) · (.+)$',speaking_text,re.M))
assert len(speaking_headings)==3
speaking=[]
for index,heading in enumerate(speaking_headings):
    end=speaking_headings[index+1].start() if index+1<len(speaking_headings) else len(speaking_text)
    task='\n'.join(line.strip() for line in speaking_text[heading.end():end].splitlines() if line.strip())
    speaking.append({'title':heading.group(2),'task':task})

data={'grammar':grammar,'listening':listening,'reading':reading,'writing':writing,'speaking':speaking,
      'vocabulary':{'coreCount':1070,'recognitionCount':670,'coreSample':120,
                    'recognitionSample':120,'corePass':102,'recognitionPass':108}}
target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print({key:len(value) for key,value in data.items() if isinstance(value,list)})
