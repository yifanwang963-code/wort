"""Transcribe A2-4 scenes and derive exact-form A2 wordbook markers."""
import json
import re
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
wordbook=json.loads((root/'public/wordbooks/goethe-a2.json').read_text(encoding='utf-8'))['words']
target=root/'src/data/scenariosA2.json'

def clean(text):return text.replace('**','').strip()

def section(text,start,end):return text.split(start,1)[1].split(end,1)[0].strip()

def order_answer(tokens,sentence):
    remaining=sentence
    available=list(tokens)
    answer=[]
    while remaining.strip(' ,;.!?'):
        matches=[token for token in available if remaining.startswith(token)]
        assert matches,(tokens,sentence,remaining)
        token=max(matches,key=len)
        answer.append(token)
        available.remove(token)
        remaining=remaining[len(token):].lstrip(' ,;.!?')
    assert not available,(tokens,sentence,available)
    return answer

def parse_exercise(line,unit_id):
    number,raw=re.match(r'(\d+)\. (.+)',line).groups()
    parts=[part.strip() for part in raw.split('｜')]
    kind,prompt=parts[0].split('：',1)
    exercise={'type':kind,'q':clean(prompt)}
    exercise['explain']=clean(next(part.split('解析：',1)[1] for part in parts if part.startswith('解析：')))
    question=next((part for part in parts if part.startswith('题干')),None)
    if question:exercise['display']=clean(re.sub(r'^题干(?:（[^）]+）)?\s*','',question))
    audio=next((re.search(r'`([^`]+)`',part).group(1) for part in parts if part.startswith('audio：')),None)
    if audio:exercise['audio']=audio
    answer=next(part for part in parts if part.startswith('answer ') or part.startswith('答 '))
    answer=clean(re.sub(r'^(?:answer|答)\s+','',answer))
    if kind in {'choice','listen_choice'}:
        options=next(part.removeprefix('选项').strip() for part in parts if part.startswith('选项'))
        exercise['options']=[clean(item) for item in options.split(' / ')]
        exercise['answer']=int(answer)
        assert len(exercise['options'])>1 and 0<=exercise['answer']<len(exercise['options'])
    elif kind in {'fill','listen_fill','listen_dictation'}:
        exercise['answer']=answer
    elif kind=='order':
        tokens=[clean(item) for item in re.search(r'\[([^\]]+)\]',next(part for part in parts if part.startswith('tokens '))).group(1).split(',')]
        if unit_id=='s-a2-02' and int(number)==10:
            assert 'mich an' in tokens
            tokens.remove('mich an')
            tokens.extend(['mich','an'])
        exercise['tokens']=tokens
        exercise['answer']=order_answer(tokens,answer)
    else:raise ValueError((unit_id,number,kind))
    return int(number),exercise

def prerequisites(raw):
    ids=[]
    for item in raw.split('、'):
        match=re.fullmatch(r'([gpt]-a2-\d+)(?:/(\d+))?',item)
        assert match,item
        ids.append(match.group(1))
        if match.group(2):ids.append(match.group(1).rsplit('-',1)[0]+'-'+match.group(2))
    return ids

def matched_words(dialogue):
    text='\n'.join(line['text'] for line in dialogue)
    seen=set();matched=[]
    for word in wordbook:
        token=word['german']
        if re.search(r'(?<![A-Za-zÄÖÜäöüß])'+re.escape(token)+r'(?![A-Za-zÄÖÜäöüß])',text):
            key=(token,word.get('article',''))
            if key not in seen:
                seen.add(key)
                matched.append(' '.join(part for part in [word.get('article',''),token] if part))
    return matched

headings=list(re.finditer(r'^## 情景 (\d+) · (.+?) (s-a2-\d+)（前置：(.+?)）$',source,re.M))
assert len(headings)==10
scenes=[]
for index,match in enumerate(headings):
    unit_id=match.group(3)
    assert unit_id==f's-a2-{index+1:02d}' and int(match.group(1))==index+1
    end=headings[index+1].start() if index+1<len(headings) else source.index('## 本包验收标准')
    chunk=source[match.end():end]
    intro=section(chunk,'**场景导入**：','**对话（点读）**')
    dialogue=[]
    for line in section(chunk,'**对话（点读）**','**高频句块**').splitlines():
        if line.startswith('- '):
            speaker,text=line[2:].split(': ',1)
            dialogue.append({'speaker':speaker,'text':text,'audio':text})
    assert dialogue,unit_id
    table_lines=[line for line in section(chunk,'**高频句块**','**练习（').splitlines() if line.startswith('|')]
    assert len(table_lines)>=3,unit_id
    table={'caption':'高频句块','headers':[clean(part) for part in table_lines[0].strip('|').split('|')],
           'rows':[[clean(part) for part in line.strip('|').split('|')] for line in table_lines[2:]],'hl':[]}
    exercises=[]
    for line in section(chunk,'**练习（','**口头任务**：').splitlines():
        if re.match(r'^\d+\. ',line):
            number,exercise=parse_exercise(line,unit_id)
            assert number==len(exercises)+1,(unit_id,number)
            exercises.append(exercise)
    assert len(exercises)==10,(unit_id,len(exercises))
    speaking=section(chunk,'**口头任务**：','---')
    words=matched_words(dialogue)
    scenes.append({'id':unit_id,'level':'A2','order':index+1,'title':match.group(2),
                   'recommended':match.group(4),'prerequisites':prerequisites(match.group(4)),
                   'sceneIntro':intro,'dialogue':dialogue,'table':table,'exercises':exercises,
                   'speaking':speaking,'sceneWords':words,
                   'audioChips':[{'group':'对话点读','items':[{'label':line['speaker'],'speak':line['text']} for line in dialogue]}]})

target.write_text(json.dumps(scenes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print([(unit['id'],len(unit['exercises']),len(unit['sceneWords'])) for unit in scenes])
