"""Build the reviewed B1 book from the supplied layered CSV and JSON."""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
csv_path, json_path, raw_path = map(Path, sys.argv[1:4])
with csv_path.open(encoding='utf-8-sig', newline='') as stream:
    csv_words = list(csv.DictReader(stream))
json_words = json.loads(json_path.read_text(encoding='utf-8-sig'))
assert csv_words == json_words, 'CSV and JSON differ'

def key(word):
    return word['german'].strip(), word['article'].strip()

old = json.loads(raw_path.read_text(encoding='utf-8'))['words']
low = [
    word
    for level in ('a1', 'a2')
    for word in json.loads((root / f'public/wordbooks/goethe-{level}.json').read_text(encoding='utf-8'))['words']
]
old_keys = {key(word) for word in old}
new_keys = {key(word) for word in json_words}
assert len(json_words) == len(new_keys) == 1740
assert len(old) == len(old_keys) == 1745
assert not new_keys & {key(word) for word in low}
assert old_keys - new_keys == {
    ('danach', ''), ('fühlen', ''), ('hungrig', ''), ('her', ''),
    ('herein', ''), ('Schülerin', 'der'),
}
assert new_keys - old_keys == {('Schülerin', 'die')}
assert Counter(word['layer'] for word in json_words) == {
    '核心主动': 1070, '被动认读': 569, '扩展认读': 101,
}
parts = {'名词', '动词', '形容词', '副词', '介词', '代词', '连词', '数词', '冠词', '短语'}
assert all(word['partOfSpeech'] in parts and word['unit'] == 'B1' for word in json_words)
fragments = {
    '-weise', 'aller-', 'Bio-', 'Doppel-', 'Groß-', 'Haupt-', 'miss-',
    'Not-', 'Schwieger-', 'Speise-/Speise', 'Spezial-', 'un-', 'unter-', 'über-',
}
assert len(fragments) == 14
assert all(
    word['partOfSpeech'] == '短语' and word['layer'] == '扩展认读'
    for word in json_words if word['german'] in fragments
)
assert len([word for word in json_words if word['partOfSpeech'] == '名词' and not word['plural']]) == 93

book = {
    'name': '歌德 B1 词库', 'level': 'B1', 'count': len(json_words),
    'words': [{**word, 'level': 'B1'} for word in json_words],
}
(root / 'public/wordbooks/goethe-b1.json').write_text(
    json.dumps(book, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)
print('B1: 1,740 words; layers 1,070/569/101; 14 specified fragments verified')
