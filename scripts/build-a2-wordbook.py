"""Build the A2 net-new book from the supplied layered CSV.

The supplied 557 rows include einsteigen, already present in A1. The user
approved deduplicating it, leaving 556 A2 entries.
"""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
a1 = json.loads((root / 'public/wordbooks/goethe-a1.json').read_text(encoding='utf-8'))['words']
with source.open(encoding='utf-8-sig', newline='') as stream:
    supplied = list(csv.DictReader(stream))

def key(word):
    return word['german'].strip().casefold(), word['article'].strip().casefold()

assert len(supplied) == 557
assert len({key(word) for word in supplied}) == 557
a1_keys = {key(word) for word in a1}
duplicates = [word for word in supplied if key(word) in a1_keys]
assert [(word['german'], word['article']) for word in duplicates] == [('einsteigen', '')]
words = [word for word in supplied if key(word) not in a1_keys]
assert len(words) == 556
assert Counter(word['layer'] for word in words) == {'核心主动': 355, '被动认读': 80, '扩展认读': 121}
assert all(word['unit'] == 'A2' for word in words)
book = {'name': '歌德 A2 词库', 'level': 'A2', 'count': 556,
        'words': [{**word, 'level': 'A2'} for word in words]}
(root / 'public/wordbooks/goethe-a2.json').write_text(
    json.dumps(book, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('A2: 557 supplied, 1 existing A1 word skipped, 556 net new; layers 355/80/121')
