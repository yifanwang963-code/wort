"""Transcribe package 3 into replacement, appended and new grammar content."""
import ast
import json
import re
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
target=root/'src/data/grammarExpansionA1.json'
shared=ast.parse((root/'scripts/build-package2.py').read_text(encoding='utf-8'))
functions=[node for node in shared.body if isinstance(node,ast.FunctionDef)]
exec(compile(ast.Module(body=functions,type_ignores=[]),'<shared grammar parser>','exec'),globals())

def section(start,end):
    return source.split(start,1)[1].split(end,1)[0]
def lines_between(text,start,end):
    return text.split(start,1)[1].split(end,1)[0].splitlines()
def bullets(text): return [x[2:].replace('**','').strip() for x in (text.splitlines() if isinstance(text,str) else text) if x.startswith('- ')]
def numbered_exercises(text):
    result=[]
    for line in text.splitlines():
        if re.match(r'^\d+\. ',line):
            if line.startswith('3. order：组句｜tokens [aus, dem, Er, steigt, Bus]｜answer Er steigt aus dem Bus aus.'):
                line=line.replace('tokens [aus, dem, Er, steigt, Bus]', 'tokens [aus, dem, Er, steigt, Bus, aus]')
            compound = line.startswith('8. order：组词（复合名词）｜tokens [Bahnhof, Uhr, die]｜answer die Bahnhofsuhr')
            if compound:
                line=line.replace('answer die Bahnhofsuhr', 'answer die Bahnhof Uhr')
            if '本题按 order 实现' in line:
                line=line.replace('classify：','order：',1)
            if '口语 ins Kino 同样判对' in line:
                line=line.replace('Ich gehe in das Kino.（口语 ins Kino 同样判对，小滑规则注明缩合）', 'Ich gehe in das Kino.')
                line=line.replace('解析：ins = in das。', '解析：ins 是 in das 的口语缩合形，已在 P6 与 g-a1-17 教过。')
            number,e=exercise(line)
            if compound:
                e['displayAnswer']='die Bahnhofsuhr'
                e['compound']=True
            assert number==len(result)+1,(line,number)
            result.append(e)
    return result
def reading_questions(text):
    return [reading_question(line) for line in text.splitlines() if line.startswith('理解题')]
def examples_bullets(text):
    out=[]
    for line in (text.splitlines() if isinstance(text,str) else text):
        if not line.startswith('- '): continue
        raw=line[2:]; n=raw.rfind('（'); assert n>=0,line
        out.append({'de':raw[:n].strip(),'zh':raw[n+1:].removesuffix('）').strip()})
    return out
def inline_examples(raw):
    out=[]
    for part in re.split(r'(?<=）)/\s*',raw):
        n=part.rfind('（'); assert n>=0,part
        out.append({'de':part[:n].strip(),'zh':part[n+1:].removesuffix('）').strip()})
    return out
def parse_writing(text):
    line=next(x for x in text.splitlines() if x.startswith('**写作**'))
    sample=next(x for x in text.splitlines() if x.startswith('范文'))
    return {'task':field(line),'sample':sample}
def plain_table(lines,i,caption):
    rows=[]
    j=i+1
    while j<len(lines) and not lines[j].startswith('|'):j+=1
    while j<len(lines) and lines[j].startswith('|'):
        cells=[x.strip() for x in lines[j].strip().strip('|').split('|')]
        if not all(re.fullmatch('-+',x) for x in cells):rows.append(cells)
        j+=1
    return {'caption':caption,'headers':rows[0],'rows':rows[1:],'hl':[]}
def parse_full(text,unit_id,title,order):
    lines=text.splitlines()
    def first(prefix): return next((i for i,x in enumerate(lines) if x.startswith(prefix)),None)
    ti=first('**主表**'); assert ti is not None,unit_id
    extras=[table(lines,i) for i,x in enumerate(lines) if x.startswith('**附加表') and 'caption：' in x and any(y.startswith('|') for y in lines[i+1:i+4])]
    reading_line=next(x for x in lines if x.startswith('**短文'))
    u={'id':unit_id,'level':'A1','order':order,'title':title,
       'titleDe':field(next(x for x in lines if x.startswith('**titleDe**'))),
       'table':table(lines,ti),'extraTables':extras,
       'rules':[],'examples':[],'pitfalls':[],'exercises':[],
       'reading':{'text':field(reading_line),'questions':reading_questions(text)},
       'writing':parse_writing(text)}
    rule_line=next(x for x in lines if x.startswith('**规则要点**'))
    if field(rule_line):u['rules']=[field(rule_line)]
    else:u['rules']=bullets(lines_between(text,'**规则要点**','**例句**'))
    example_line=next(x for x in lines if x.startswith('**例句**'))
    if field(example_line):u['examples']=inline_examples(field(example_line))
    else:u['examples']=examples_bullets(lines_between(text,'**例句**','**易错点**'))
    pitfall_line=next(x for x in lines if x.startswith('**易错点**'))
    if field(pitfall_line):u['pitfalls']=[x.removeprefix('⚠ ').strip() for x in field(pitfall_line).split('；⚠ ')]
    else:u['pitfalls']=[x.removeprefix('⚠ ') for x in bullets(lines_between(text,'**易错点**','**练习'))]
    exercise_text=text.split('**练习',1)[1].split('**短文',1)[0]
    u['exercises']=numbered_exercises(exercise_text)
    extra_texts=[]
    for line in lines:
        if line.startswith('**附加表') and not any(y.startswith('|') for y in lines[lines.index(line)+1:lines.index(line)+4]):
            extra_texts.append(line.replace('**',''))
    if extra_texts:u['extensionContent']=extra_texts
    assert u['table'] and u['examples'] and u['pitfalls'] and u['exercises'] and u['reading']['questions'] and u['writing']['sample'],unit_id
    return u

replacement_text=section('## 一、与格升格','## 二、完成时扩容')
dative=parse_full(replacement_text,'g-a1-13','Der Dativ（与格）',24)
assert len(dative['extraTables'])==2 and len(dative['exercises'])==18

participle_text=section('## 二、完成时扩容','## 三、逐单元扩容')
participle_lines=participle_text.splitlines()
participle_table=table(participle_lines,next(i for i,x in enumerate(participle_lines) if x.startswith('**新增主表**')))
participle_note=next(x for x in participle_lines if x.startswith('（可分动词'))
participle_rules=bullets(lines_between(participle_text,'**新增规则要点**','**新增 audioChips**'))
chip_line=next(x for x in participle_lines if x.startswith('**新增 audioChips**'))
chip_pairs=[x.strip() for x in field(chip_line).split('：',1)[1].split('（speak')[0].split('、')]
participle_exercises=numbered_exercises(participle_text.split('**新增练习',1)[1])
assert len(participle_exercises)==12 and len(chip_pairs)==8

old_text=section('## 三、逐单元扩容','## 四、新增单元')
old_sections=re.split(r'(?=^### g-a1-\d+ )',old_text,flags=re.M)[1:]
additions={}
for body in old_sections:
    h=re.match(r'### (g-a1-\d+) (.+)',body); assert h,body[:100]
    unit_id=h.group(1)
    before=body.split('**新增练习',1)[0].split('\n',1)[1]
    additions[unit_id]={'content':[], 'tables':[], 'exercises':numbered_exercises(body.split('**新增练习',1)[1].split('### ',1)[0])}
    for i,line in enumerate(before.splitlines()):
        if line.startswith('|'):continue
        if line.startswith('**') and any(x.startswith('|') for x in before.splitlines()[i+1:i+4]):
            if 'caption：' in line:additions[unit_id]['tables'].append(table(before.splitlines(),i))
            else:additions[unit_id]['tables'].append(plain_table(before.splitlines(),i,line.split('**',2)[1]))
            continue
        if line.startswith('**'):
            for m in re.finditer(r'\*\*([^*]+)\*\*：(.*?)(?=\*\*[^*]+\*\*：|$)',line):
                additions[unit_id]['content'].append({'label':m.group(1),'text':m.group(2).strip()})
    assert additions[unit_id]['exercises'],unit_id
assert len(additions)==16,len(additions)
additions['g-a1-06']={'content':[],'tables':[],'exercises':[]}
additions['g-a1-06']['tables'].append(participle_table)
additions['g-a1-06']['content'].append({'label':'可分动词分词计数','text':participle_note})
additions['g-a1-06']['content'].extend({'label':'新增规则要点','text':x} for x in participle_rules)
additions['g-a1-06']['audioChips']=[{'group':'分词对','items':[{'label':x,'speak':x.replace(' ',', ')} for x in chip_pairs]}]
additions['g-a1-06']['exercises']=participle_exercises
additions['g-a1-11']['additionalReading']=next(x for x in old_sections if x.startswith('### g-a1-11')).split('**新增短文段**',1)[1].split('**新增练习',1)[0].strip().lstrip('：')

new_text=section('## 四、新增单元','## 五、对比专练')
new_sections=re.split(r'(?=^### g-a1-\d+ )',new_text,flags=re.M)[1:]
new_units=[]
for body in new_sections:
    h=re.match(r'### (g-a1-\d+) (.+?)（order (\d+)）',body);assert h,body[:100]
    u=parse_full(body,h.group(1),h.group(2),int(h.group(3)))
    assert len(u['exercises'])==15,u['id']
    new_units.append(u)
assert [u['id'] for u in new_units]==['g-a1-26','g-a1-24','g-a1-23','g-a1-25']

comparison_text=section('## 五、对比专练','## 六、本包验收标准')
comparison_sections=re.split(r'(?=^### c[1-6] )',comparison_text,flags=re.M)[1:]
comparisons=[]
for body in comparison_sections:
    h=re.match(r'### (c[1-6]) (.+)',body);assert h
    intro=body.split('练习（',1)[0].split('\n',1)[1].strip()
    qs=numbered_exercises(body.split('练习（',1)[1])
    assert len(qs)==8,h.group(1)
    comparisons.append({'id':h.group(1),'title':h.group(2),'intro':intro,'exercises':qs})
assert len(comparisons)==6

result={'replacement':dative,'additions':additions,'newUnits':new_units,'comparisons':comparisons}
target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Package 3:',len(additions),'expanded,',len(new_units),'new,',len(comparisons),'comparisons')
