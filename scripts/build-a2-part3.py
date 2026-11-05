"""Transcribe A2-3 lessons and comparison drills into the existing grammar shape."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target = root / 'src/data/grammarA2Part3.json'
comparison_target = root / 'src/data/grammarComparisonsA2.json'
expected_ids = ['g-a2-14','g-a2-15','g-a2-16','g-a2-17','t-a2-01','g-a2-18',
                't-a2-05','g-a2-19','g-a2-20','g-a2-21','g-a2-22','t-a2-04']
expected_counts = [16,16,16,16,16,16,16,16,16,16,18,16]

def clean(text):
    return text.replace('**','').strip()

def block(section, start, end):
    return section.split(start, 1)[1].split(end, 1)[0].strip()

def parse_table(lines, start):
    caption = clean(lines[start].rstrip('：'))
    cursor = start + 1
    while cursor < len(lines) and not lines[cursor].startswith('|'):
        cursor += 1
    assert cursor < len(lines), caption
    header = [clean(cell) for cell in lines[cursor].strip().strip('|').split('|')]
    width = len(header)
    rows = []
    highlights = []
    cursor += 2  # Markdown separator
    while cursor < len(lines) and lines[cursor].startswith('|'):
        raw = [cell.strip() for cell in lines[cursor].strip().strip('|').split('|')]
        if len(raw) > width:
            raw = raw[:width-1] + [' | '.join(raw[width-1:])]
        assert len(raw) == width, (caption, lines[cursor])
        for col, cell in enumerate(raw):
            if '**' in cell:
                highlights.append([len(rows), col])
        rows.append([clean(cell) for cell in raw])
        cursor += 1
    return {'caption':caption,'headers':header,'rows':rows,'hl':highlights}

def parse_examples(text,unit_id):
    examples = []
    for line in text.splitlines():
        if not line.startswith('- '):
            continue
        raw = line[2:].strip()
        if unit_id=='t-a2-01':
            raw=raw.replace('Vielen Dank im Voraus. Mit freundlichen Grüßen, Lan Wang',
                            'Vielen Dank im Voraus.\nMit freundlichen Grüßen\nLan Wang')
        examples.append({'de':clean(raw),'zh':''})
    return examples

def split_labels(raw):
    if re.search(r'[.!?], ',raw):
        return [clean(item) for item in re.split(r'(?<=[.!?]), ',raw)]
    labels=[]
    current=''
    depth=0
    for character in raw:
        if character=='（':depth+=1
        if character=='）':depth-=1
        if character==',' and depth==0:
            labels.append(clean(current));current=''
        else:current+=character
    if current.strip():labels.append(clean(current))
    return labels

def parse_classify(parts,unit_id):
    baskets=[]
    for part in parts:
        match=re.match(r'筐 ([A-C]) ([^\[]+)\[([^\]]+)\]',part)
        if match:
            baskets.append((match.group(1), clean(match.group(2)),
            split_labels(match.group(3))))
    if unit_id=='t-a2-01':
        baskets[0]=(baskets[0][0],baskets[0][1],['Betreff: Anfrage wegen eines Kurses','Sehr geehrte Frau Sommer,'])
        baskets[1]=(baskets[1][0],baskets[1][1],['Ich schreibe Ihnen, weil …','Könnten Sie mir bitte sagen, …?'])
    assert len(baskets)>=2,parts
    groups=[name for _,name,_ in baskets]
    lookup={label:(name,index) for index,(letter,name,labels) in enumerate(baskets) for label in labels}
    specified=next((part for part in parts if part.startswith('待分词')),None)
    items=[]
    if specified and '→' in specified:
        for pair in specified.removeprefix('待分词').split('、'):
            label,letter=pair.split('→',1)
            label=clean(label);letter=clean(letter)
            candidates=[(key,group) for key,(name,group) in lookup.items() if key==label or key.startswith(label+'（')]
            assert len(candidates)==1,(label,candidates)
            assert baskets[candidates[0][1]][0]==letter,(label,letter)
            items.append({'text':candidates[0][0],'group':candidates[0][1]})
    else:
        items=[{'text':label,'group':index} for index,(_,_,labels) in enumerate(baskets) for label in labels]
    assert len(items)==sum(len(labels) for _,_,labels in baskets)
    return groups,items

def order_answer(tokens,sentence):
    remaining=sentence
    answer=[]
    available=list(tokens)
    while remaining.strip(' ,;.!?'):
        matches=[token for token in available if remaining.startswith(token)]
        assert matches,(tokens,sentence,remaining)
        token=max(matches,key=len)
        answer.append(token);available.remove(token)
        remaining=remaining[len(token):].lstrip(' ,;.!?')
    assert not available,(tokens,sentence,available)
    return answer

def parse_exercise(line,unit_id):
    number,raw=re.match(r'(\d+)\. (.+)',line).groups()
    parts=[part.strip() for part in raw.split('｜')]
    kind,prompt=parts[0].split('：',1)
    exercise={'type':kind,'q':clean(prompt)}
    explain=next((part.split('解析：',1)[1] for part in parts if part.startswith('解析：')),None)
    if explain:
        exercise['explain']=clean(explain)
    audio=next((re.search(r'`([^`]+)`',part).group(1) for part in parts if part.startswith('audio：')),None)
    if audio:
        exercise['audio']=audio
    question=next((part for part in parts if part.startswith('题干')),None)
    if question:
        exercise['display']=clean(re.sub(r'^题干(?:（[^）]+）)?\s*','',question))
    answer=next((part for part in parts if part.startswith('answer ') or part.startswith('答 ')),None)
    if answer:
        answer=clean(re.sub(r'^(?:answer|答)\s+','',answer))
    else:
        assert kind=='classify',line
    if kind in {'choice','listen_choice'}:
        opt_index=next(index for index,part in enumerate(parts) if part.startswith('选项'))
        options_raw=parts[opt_index].removeprefix('选项').strip()
        options=[clean(item) for item in options_raw.split(' / ')]
        if unit_id=='c-a2-2' and int(number) in {6,8}:
            options=[clean(options_raw),clean(parts[opt_index+1])]
        assert len(options)>1,(unit_id,number,options_raw)
        exercise['options']=options
        exercise['answer']=int(answer)
        assert 0<=exercise['answer']<len(options),(unit_id,number)
    elif kind in {'fill','listen_fill','listen_dictation'}:
        exercise['answer']=answer
        if unit_id=='g-a2-16' and int(number)==7:
            assert answer=='Würden / Könnten'
            exercise['answer']='Würden'
            exercise['acceptedAnswers']=['Würden','Könnten']
        if unit_id=='c-a2-2' and int(number)==5:
            assert answer=='Hast / gesehen'
            exercise['blankAnswers']=['Hast','gesehen']
        if '选项 ' in raw:
            options_raw=next(part.removeprefix('选项 ').strip() for part in parts if part.startswith('选项 '))
            exercise['hintOptions']=[clean(item) for item in options_raw.split(' / ')]
    elif kind=='order':
        token_field=next(part for part in parts if part.startswith('tokens '))
        tokens=[clean(item) for item in re.search(r'\[([^\]]+)\]',token_field).group(1).split(',')]
        expected=order_answer(tokens,answer)
        exercise['tokens']=tokens;exercise['answer']=expected
    elif kind=='classify':
        exercise['groups'],exercise['items']=parse_classify(parts,unit_id)
    else:
        raise ValueError((unit_id,number,kind))
    return int(number),exercise

def parse_unit(chunk,index,match):
    unit_id=match.group(3)
    lines=chunk.splitlines()
    tables=[parse_table(lines,i) for i,line in enumerate(lines) if line.startswith('彩色总表')]
    assert tables,unit_id
    rules=block(chunk,'规则要点：','例句（')
    reading_point=next((clean(line) for line in rules.splitlines() if line.startswith('读法要点：')),None)
    examples_text=block(chunk,'例句（','易错点：')
    examples=parse_examples(examples_text,unit_id)
    pitfalls=block(chunk,'易错点：','**练习（')
    exercise_text=block(chunk,'**练习（','**阅读**')
    exercises=[]
    for line in exercise_text.splitlines():
        if re.match(r'^\d+\. ',line):
            number,exercise=parse_exercise(line,unit_id)
            assert number==len(exercises)+1,(unit_id,number)
            exercises.append(exercise)
    assert len(exercises)==expected_counts[index],(unit_id,len(exercises))
    reading=block(chunk,'**阅读**','**写作**')
    reading_lines=reading.splitlines()
    reading_parts=[]
    for line in reading_lines:
        if not line.startswith('> '):
            continue
        text=line.removeprefix('> ').strip()
        reading_parts.append({'label':'','text':text})
    paragraph='\n'.join(part['text'] for part in reading_parts)
    reading_tasks=next(line for line in reading_lines if line.startswith('任务：'))
    writing=chunk.split('**写作**',1)[1]
    writing_lines=[line.strip() for line in writing.splitlines() if line.strip() and line.strip()!='---']
    writing_task=writing_lines[0].removeprefix('：').strip()
    sample=next(line for line in writing_lines if line.startswith('范文'))
    if unit_id=='t-a2-01':
        sample=sample.replace(' / ','\n')
        sample=sample.replace('Sehr geehrte Damen und Herren, ich',
                              'Sehr geehrte Damen und Herren,\nich')
        sample=sample.replace('Vielen Dank im Voraus. Mit freundlichen Grüßen',
                              'Vielen Dank im Voraus.\nMit freundlichen Grüßen')
    selfcheck=next(line for line in writing_lines if line.startswith('自查：'))
    title=match.group(2)
    return {'id':unit_id,'level':'A2','order':index+18,'title':title,'titleDe':'',
            'table':tables[0],'extraTables':tables[1:],
            'rules':[clean(line[2:]) for line in rules.splitlines() if line.startswith('- ')],
            **({'extensionContent':[reading_point]} if reading_point else {}),
            'examples':examples,
            'pitfalls':[clean(line[2:]) for line in pitfalls.splitlines() if line.startswith('- ')],
            'exercises':exercises,
            'reading':{'text':paragraph,'parts':reading_parts,'questions':[],'tasks':reading_tasks},
            'writing':{'task':writing_task,'sample':sample,'selfcheck':selfcheck}}

headings=list(re.finditer(r'^## 单元 (\d+) · (.+?)\s?([pgt]-a2-\d+)（order (\d+)）$',source,re.M))
assert len(headings)==12
units=[]
for index,match in enumerate(headings):
    end=headings[index+1].start() if index+1<len(headings) else source.index('## 对比专练')
    chunk=source[match.end():end]
    assert match.group(3)==expected_ids[index] and int(match.group(4))==index+18
    units.append(parse_unit(chunk,index,match))

target.write_text(json.dumps(units,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print([(unit['id'],len(unit['exercises'])) for unit in units])

comparison_source=source.split('## 对比专练',1)[1].split('## 本包验收标准',1)[0]
comparison_headings=list(re.finditer(r'^### (c-a2-[1-5]) · (.+)$',comparison_source,re.M))
assert len(comparison_headings)==5
comparisons=[]
for index,match in enumerate(comparison_headings):
    end=comparison_headings[index+1].start() if index+1<len(comparison_headings) else len(comparison_source)
    chunk=comparison_source[match.end():end]
    exercises=[]
    for line in chunk.splitlines():
        if re.match(r'^\d+\. ',line):
            number,exercise=parse_exercise(line,match.group(1))
            assert number==len(exercises)+1,(match.group(1),number)
            exercises.append(exercise)
    assert len(exercises)==8,(match.group(1),len(exercises))
    comparisons.append({'id':match.group(1),'title':match.group(2),'intro':'','exercises':exercises})
comparison_target.write_text(json.dumps(comparisons,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print([(item['id'],len(item['exercises'])) for item in comparisons])
