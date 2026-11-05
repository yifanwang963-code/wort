"""Validate the corrected A1 CSVs and create the bundled 745-word book."""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

root=Path(__file__).resolve().parents[1]
gap_path=Path(sys.argv[1])
layered_path=Path(sys.argv[2])
book_path=root/'public/wordbooks/goethe-a1.json'
gap_output=root/'public/wordbooks/goethe-a1-gap.json'

def rows(path):
    with path.open(encoding='utf-8-sig',newline='') as stream:return list(csv.DictReader(stream))
def key(word):return (word['german'],word['article'])

gap=rows(gap_path);layered=rows(layered_path)
assert len(gap)==63 and len({key(w) for w in gap})==63
assert len(layered)==745 and len({key(w) for w in layered})==745
assert Counter(w['layer'] for w in layered)=={'核心主动':340,'被动认读':383,'扩展认读':22}
current=json.loads(book_path.read_text(encoding='utf-8'))['words']
gap_keys={key(w) for w in gap}
base_keys={key(w) for w in current if key(w) not in gap_keys}
assert len(base_keys)==682 and not base_keys.intersection(gap_keys)
assert base_keys|gap_keys=={key(w) for w in layered}
assert next(w['layer'] for w in layered if w['german']=='Tag')=='核心主动'
assert next(w['layer'] for w in layered if w['german']=='Kühlschrank')=='扩展认读'
gap_output.write_text(json.dumps({'name':'歌德 A1 补缺词表','level':'A1','count':63,
  'words':[{**w,'level':'A1'} for w in gap]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
book_path.write_text(json.dumps({'name':'歌德 A1 词库','level':'A1','count':745,
  'words':[{**w,'level':'A1'} for w in layered]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('A1 book: 682 original + 63 gap = 745, layers 340/383/22')
