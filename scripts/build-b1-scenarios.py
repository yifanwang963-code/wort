"""Transcribe B1-4 scenes and derive exact-form B1 wordbook markers."""
import json
import re
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
wordbook=json.loads((root/'public/wordbooks/goethe-b1.json').read_text(encoding='utf-8'))['words']
target=root/'src/data/scenariosB1.json'

def clean(text):return text.replace('**','').strip()

def section(text,start,end):return text.split(start,1)[1].split(end,1)[0].strip()

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
    answer=next((part for part in parts if part.startswith('answer ') or part.startswith('答 ')),None)
    if answer:answer=clean(re.sub(r'^(?:answer|答)\s+','',answer))
    else:assert kind=='classify',(unit_id,number)
    if kind in {'choice','listen_choice'}:
        options=next(part.removeprefix('选项').strip() for part in parts if part.startswith('选项'))
        if unit_id=='s-b1-04' and int(number)==3:
            if options.startswith('要邮寄两样材料：报警记录和发票 /'):
                options=options.replace('要邮寄两样材料：报警记录和发票','要发邮件提交两样材料：报警记录和发票',1)
            else:assert options.startswith('要发邮件提交两样材料：报警记录和发票 /')
        if unit_id=='s-b1-09' and int(number)==1:
            if options=='320.000 / 60.000 / 260.000 / 60.000 / 320.000 / 260.000':
                options='320.000、60.000 / 260.000、60.000 / 320.000、260.000'
            else:assert options=='320.000、60.000 / 260.000、60.000 / 320.000、260.000'
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
    elif kind=='classify':
        baskets=[]
        for part in parts:
            found=re.match(r'筐 ([A-D]) (.+?) \[([^\]]+)\]',part)
            if found:baskets.append((found.group(1),found.group(2),[value.strip() for value in found.group(3).split(',')]))
        assert len(baskets)>=2,(unit_id,number)
        requested=next(part for part in parts if part.startswith(('待分句','待分物','待分词','待分项')))
        items=[]
        for pair in requested.split(' ',1)[1].split('、'):
            text,letter=pair.rsplit('→',1)
            text=text.strip();letter=letter.strip()
            number_match=re.match(r'^(\d+)\.',text)
            assert number_match,(unit_id,number,text)
            matches=[index for index,(label,_,numbers) in enumerate(baskets) if label==letter and number_match.group(1) in numbers]
            assert len(matches)==1,(unit_id,number,text,letter)
            items.append({'text':text,'group':matches[0]})
        assert len(items)==sum(len(numbers) for _,_,numbers in baskets)
        exercise['groups']=[name for _,name,_ in baskets]
        exercise['items']=items
    else:raise ValueError((unit_id,number,kind))
    return int(number),exercise

def prerequisites(raw):
    ids=re.findall(r'[gpts]-(?:a2|b1)-\d+',raw)
    return list(dict.fromkeys(ids))

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

headings=list(re.finditer(r'^## 课 (\d+) · (.+?) (s-b1-\d+)$',source,re.M))
assert len(headings)==10
scenes=[]
for index,match in enumerate(headings):
    unit_id=match.group(3)
    assert unit_id==f's-b1-{index+1:02d}' and int(match.group(1))==index+1
    end=headings[index+1].start() if index+1<len(headings) else source.index('## 本包验收')
    chunk=source[match.end():end]
    intro=section(chunk,'**场景**：','**对话**')
    dialogue=[]
    for line in section(chunk,'**对话**','**重点表达**').splitlines():
        if line.startswith('> '):
            speaker,text=line[2:].split(': ',1)
            dialogue.append({'speaker':speaker,'text':text,'audio':text})
    assert dialogue,unit_id
    expression_lines=[line[2:] for line in section(chunk,'**重点表达**','**练习（').splitlines() if line.startswith('- ')]
    table={'caption':'重点表达','headers':['用途','德语'],
           'rows':[[clean(part) for part in line.split('：',1)] for line in expression_lines],'hl':[]}
    assert table['rows'] and all(len(row)==2 for row in table['rows']),unit_id
    exercises=[]
    for line in section(chunk,'**练习（','**口头任务**：').splitlines():
        if re.match(r'^\d+\. ',line):
            number,exercise=parse_exercise(line,unit_id)
            assert number==len(exercises)+1,(unit_id,number)
            exercises.append(exercise)
    assert len(exercises)==10,(unit_id,len(exercises))
    speaking_lines=[line.strip() for line in section(chunk,'**口头任务**：','---').splitlines() if line.strip()]
    assert len(speaking_lines)==3 and speaking_lines[1].startswith('参考：') and speaking_lines[2].startswith('自查：'),unit_id
    words=matched_words(dialogue)
    scenes.append({'id':unit_id,'level':'B1','order':index+1,'title':match.group(2),
                   'recommended':'','prerequisites':prerequisites(intro),
                   'sceneIntro':intro,'dialogue':dialogue,'table':table,'exercises':exercises,
                   'speaking':speaking_lines[0],'speakingSample':speaking_lines[1],
                   'speakingSelfcheck':speaking_lines[2],'sceneWords':words})

target.write_text(json.dumps(scenes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print([(unit['id'],len(unit['exercises']),len(unit['sceneWords'])) for unit in scenes])
