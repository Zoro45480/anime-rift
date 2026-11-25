"""Ajoute au jeu les personnages de tools/data/more_heroes.txt (format : idAniList ou -:カナ | nom | titre | rareté |
affinité | rôle | attaque | technique | ultime | passif | collectif[:stat:%]).
Usage : python3 tools/data/add_more.py anilist.json   puis   python3 tools/data/gen_roles.py tools/data/moves.txt
"""
import json, os, re, sys, unicodedata
HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', '..', 'src', 'data')
RAR = {'N': 'common', 'R': 'rare', 'SR': 'epic', 'SSR': 'ultra', 'LR': 'legend', 'MR': 'rift'}
EXTRA = {'Clan Ôtsutsuki': 'kaguya', 'Taka': 'sasuke karin', 'Pirates du Roux': 'shanks', 'Famille Donquixote': 'doflamingo', 'Pirates du Soleil': 'jinbe',
         'Fourreaux rouges': 'oden', 'Namek': 'piccolo dende', 'Xcution': 'ginjo', 'Clan Shiba': 'isshin', 'Épouses d’Uzui': 'tengen', 'Famille araignée': 'rui',
         'Les Intouchables': 'gojo geto toji', 'Camp de Getô': 'geto', 'Zodiaque': 'cheadle netero ging', 'Gardes Nostrade': 'kurapika', 'Village de Kumo': 'bee raikage',
         'Invocations': 'jiraya', 'Démons à queues': 'naruto gaara bee', 'Quartet du Son': 'orochimaru', 'Fracción de Harribel': 'harribel', 'Village de Konoha': 'iruka kakashi'}
data = json.load(open(sys.argv[1]))
native = {c['id']: (c['name']['native'] or '') for cs in data.values() for c in cs}
heroes = open(os.path.join(SRC, 'heroes.ts'), encoding='utf8').read()
ids = set(re.findall(r"id: '([^']*)'", heroes))
names = set(re.findall(r"name: '([^']*)'", heroes))
no = max(int(x) for x in re.findall(r"no: (\d+)", heroes))
col = open(os.path.join(SRC, 'collectifs.ts'), encoding='utf8').read()
ani = open(os.path.join(SRC, 'anilist.ts'), encoding='utf8').read()
used_ani = set(re.findall(r": (\d+),", ani))
slug = lambda t: re.sub(r'[^a-z0-9]+', '_', unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()).strip('_')
q = lambda t: t.replace("'", '’')
lines, moves, anis, new, world, added = [], [], [], {}, None, 0
for raw in open(os.path.join(HERE, 'more_heroes.txt'), encoding='utf8'):
    raw = raw.rstrip('\n')
    if not raw or raw.startswith('#'): continue
    if raw.startswith('@'):
        world = raw[1:]; lines.append(f'  // --- {world} (renforts)'); continue
    aid, name, title, rar, aff, role, a, s, u, p, group = raw.split('|')
    if q(name) in names or aid in used_ani: continue
    assert len(role) == 1 or rar in ('LR', 'MR'), name
    i = slug(name)
    if i in ids: i += '_' + slug(world)[:2]
    assert i not in ids, i
    ids.add(i); names.add(q(name)); no += 1; added += 1
    kana = aid[2:] if aid.startswith('-:') else re.sub(r'[\s・=＝]', '', native.get(int(aid), ''))[:6] or name[:3].upper()
    lines.append(f"  {{ id: '{i}', no: {no}, name: '{q(name)}', kana: '{q(kana)}', title: '{q(title)}', world: '{world}', role: 'DPS', rarity: '{RAR[rar]}', affinity: '{aff}', atk: 0, def: 0, hp: 0 }},")
    moves.append('|'.join([i, role, a, s, u, p]))
    if not aid.startswith('-:'): anis.append(f'{i}: {aid},')
    spec = group.split(':')
    m = re.search(r"(g\('[^']*', '%s', '[a-z]+', \d+, ')([^']*)('\))" % re.escape(spec[0]), col)
    if m: col = col[:m.start()] + m.group(1) + m.group(2) + ' ' + i + m.group(3) + col[m.end():]
    elif spec[0] in new: new[spec[0]]['members'].append(i)
    else:
        assert len(spec) == 3, f'collectif inconnu : {spec[0]} ({name})'
        new[spec[0]] = {'world': world, 'stat': spec[1], 'pct': spec[2], 'members': EXTRA.get(spec[0], '').split() + [i]}
for name, g in new.items():
    assert len(g['members']) >= 2, name
    end = col.rindex(']')
    col = col[:end] + f"  g('{g['world']}', '{name}', '{g['stat']}', {g['pct']}, '{' '.join(dict.fromkeys(g['members']))}'),\n" + col[end:]
end = heroes.rindex('\n]')
open(os.path.join(SRC, 'heroes.ts'), 'w', encoding='utf8').write(heroes[:end] + '\n' + '\n'.join(lines) + heroes[end:])
open(os.path.join(SRC, 'collectifs.ts'), 'w', encoding='utf8').write(col)
end = ani.rindex('}')
open(os.path.join(SRC, 'anilist.ts'), 'w', encoding='utf8').write(ani[:end] + '\n'.join('  ' + ' '.join(anis[k:k + 8]) for k in range(0, len(anis), 8)) + '\n' + ani[end:])
mp = os.path.join(HERE, 'moves.txt')
old = [l for l in open(mp, encoding='utf8').read().split('\n') if l.strip()]
open(mp, 'w', encoding='utf8').write('\n'.join(old + moves))
print(added, 'personnages ajoutés ;', len(new), 'nouveaux collectifs')
