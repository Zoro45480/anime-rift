"""Ajoute au jeu les personnages de tools/data/new_heroes.txt : cartes, attaques, collectifs, identifiants AniList.
Usage : python3 tools/data/add_heroes.py [anilist.json]   (le fichier AniList, facultatif, sert à retrouver les identifiants)
Puis  : python3 tools/data/gen_roles.py tools/data/moves.txt   pour calculer rôles et statistiques.
"""
import json, os, re, sys, unicodedata
HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', '..', 'src', 'data')
RAR = {'N': 'common', 'R': 'rare', 'SR': 'epic', 'SSR': 'ultra', 'LR': 'legend', 'MR': 'rift'}
EXTRA = {  # membres déjà présents à ajouter aux nouveaux collectifs
    'Les cinq Kage': 'gaara tsunade', 'Fratrie du Sable': 'gaara', 'Équipage de Barbe Blanche': 'whitebeard ace teach jinbe',
    'Pirates de Big Mom': 'bigmom', 'Pirates aux cent bêtes': 'kaido', 'Thriller Bark': 'moria brook', 'Armée révolutionnaire': 'sabo kuma robin',
    'Famille Vinsmoke': 'sanji', 'Armée de Freezer': 'freezer', 'Traîtres de la Soul Society': 'aizen', 'Alliés démons': 'nezuko', 'Dix Ombres': 'megumi',
    'Wano': 'oden zoro', 'Ennemis de Grand Line': 'crocodile',
}
rows = [l.rstrip('\n').split('|') for l in open(os.path.join(HERE, 'new_heroes.txt'), encoding='utf8') if l.strip()]
heroes = open(os.path.join(SRC, 'heroes.ts'), encoding='utf8').read()
existing = set(re.findall(r"id: '([^']*)'", heroes))
rows = [r for r in rows if r[0] not in existing]
if not rows:
    sys.exit('Rien à ajouter.')
no = max(int(x) for x in re.findall(r"no: (\d+)", heroes))
lines = ['  // --- Renforts : personnages ajoutés dans chaque univers']
for r in rows:
    i, name, kana, title, world, rar, aff = r[:7]
    no += 1
    q = lambda t: t.replace("'", '’')
    lines.append(f"  {{ id: '{i}', no: {no}, name: '{q(name)}', kana: '{kana}', title: '{q(title)}', world: '{world}', role: 'DPS', rarity: '{RAR[rar]}', affinity: '{aff}', atk: 0, def: 0 }},")
end = heroes.rindex('\n]')
heroes = heroes[:end] + '\n' + '\n'.join(lines) + heroes[end:]
open(os.path.join(SRC, 'heroes.ts'), 'w', encoding='utf8').write(heroes)

with open(os.path.join(HERE, 'moves.txt'), 'a', encoding='utf8') as f:
    for r in rows:
        assert len(r[7]) == 1 or r[5] in ('LR', 'MR'), r[0]
        f.write('\n' + '|'.join([r[0], r[7], r[8], r[9], r[10], r[11]]))

col = open(os.path.join(SRC, 'collectifs.ts'), encoding='utf8').read()
new = {}
for r in rows:
    spec = r[12].split(':')
    name = spec[0]
    m = re.search(r"(g\('[^']*', '%s', '[a-z]+', \d+, ')([^']*)('\))" % re.escape(name), col)
    if m:
        col = col[:m.start()] + m.group(1) + m.group(2) + ' ' + r[0] + m.group(3) + col[m.end():]
    else:
        assert len(spec) == 3, f'collectif inconnu : {name}'
        g = new.setdefault(name, {'world': r[4], 'stat': spec[1], 'pct': spec[2], 'members': EXTRA.get(name, '').split()})
        g['members'].append(r[0])
for name, g in new.items():
    members = list(dict.fromkeys(g['members']))
    assert len(members) >= 2, name
    line = f"  g('{g['world']}', '{name}', '{g['stat']}', {g['pct']}, '{' '.join(members)}'),\n"
    end = col.rindex(']')
    col = col[:end] + line + col[end:]
open(os.path.join(SRC, 'collectifs.ts'), 'w', encoding='utf8').write(col)

if len(sys.argv) > 1:  # identifiants AniList, par le nom
    data = json.load(open(sys.argv[1]))
    fold = lambda t: re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()).replace('ou', 'o').replace('uu', 'u').replace('oo', 'o')
    ani = open(os.path.join(SRC, 'anilist.ts'), encoding='utf8').read()
    found, missing = [], []
    for r in rows:
        want = set(fold(r[13]).split())
        best = (0, None)
        for c in data[r[4]]:
            names = [c['name']['full'] or ''] + (c['name']['alternative'] or [])
            score = max(len(want & set(fold(x).split())) / max(1, len(want | set(fold(x).split()))) for x in names)
            if score > best[0]: best = (score, c)
        if best[0] >= 0.99: found.append(f"{r[0]}: {best[1]['id']},")
        else: missing.append(f"{r[0]} ({r[13]} ~ {best[1]['name']['full'] if best[1] else '-'} {best[0]:.2f})")
    end = ani.rindex('}')
    ani = ani[:end] + '\n'.join('  ' + ' '.join(found[k:k + 8]) for k in range(0, len(found), 8)) + '\n' + ani[end:]
    open(os.path.join(SRC, 'anilist.ts'), 'w', encoding='utf8').write(ani)
    print(len(found), 'fiches AniList trouvées ; sans fiche :', '; '.join(missing))
print(len(rows), 'personnages ajoutés')
