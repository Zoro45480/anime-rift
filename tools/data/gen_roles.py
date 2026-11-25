# Applique à heroes.ts les rôles, et recalcule dégâts / défense / PV selon la rareté et le rôle. Écrit aussi moves.ts.
import re, sys
root = '/home/user/anime-rift/src/data/'
ROLE = {'D': 'DPS', 'T': 'Tank', 'S': 'Soigneur', 'DT': 'DPS / Tank', 'DS': 'DPS / Soigneur', 'TS': 'Tank / Soigneur'}
BUDGET = {'common': 600, 'rare': 840, 'epic': 1140, 'ultra': 1500, 'legend': 1920, 'rift': 2400}
PROFILE = {'D': (1.25, 0.70, 2.0), 'T': (0.70, 1.25, 3.2), 'S': (0.80, 0.90, 2.6), 'DT': (1.20, 1.15, 3.0), 'DS': (1.20, 0.90, 2.5), 'TS': (0.85, 1.20, 3.2)}
moves = {}
for line in open(sys.argv[1], encoding='utf8'):
    i, r, a, s, u, p = line.rstrip('\n').split('|')
    moves[i] = (r, a, s, u, p)
src = open(root + 'heroes.ts', encoding='utf8').read()
seen = set()
def fix(m):
    line = m.group(0)
    i = re.search(r"id: '([^']*)'", line).group(1)
    no = int(re.search(r"no: (\d+)", line).group(1))
    rar = re.search(r"rarity: '([^']*)'", line).group(1)
    r = moves[i][0]
    assert len(r) == 1 or rar in ('rift', 'legend'), i
    seen.add(i)
    b = BUDGET[rar] * (0.96 + 0.08 * ((no * 37) % 11) / 10)  # petite variation propre à chaque personnage
    ka, kd, kh = PROFILE[r]
    rnd = lambda x, q: int(round(x / q) * q)
    line = re.sub(r"role: '[^']*'", f"role: '{ROLE[r]}'", line)
    line = re.sub(r"atk: \d+, def: \d+(, hp: \d+)?", f"atk: {rnd(b * ka, 10)}, def: {rnd(b * kd, 10)}, hp: {rnd(b * kh, 50)}", line)
    return line
src = re.sub(r"^  \{ id: '.*$", fix, src, flags=re.M)
assert seen == set(moves), (len(seen), set(moves) - seen)
src = src.replace("affinity: AffinityId; atk: number; def: number }", "affinity: AffinityId; atk: number; def: number; hp: number }")
src = src.replace("export type Hero = { id: string; no: number; model?: string; name: string; kana: string; title: string; world: string; role: string;",
  "// Rôles : DPS (frappe fort), Tank (encaisse), Soigneur (soigne). Seules les cartes LR et MR peuvent cumuler deux rôles.\n// Dégâts, défense et PV de base (niveau 1) : fixés par la rareté puis répartis selon le rôle (tools : scratch gen_roles).\nexport type Role = 'DPS' | 'Tank' | 'Soigneur' | 'DPS / Tank' | 'DPS / Soigneur' | 'Tank / Soigneur'\nexport type Hero = { id: string; no: number; model?: string; name: string; kana: string; title: string; world: string; role: Role;")
open(root + 'heroes.ts', 'w', encoding='utf8').write(src)
out = ["// Les techniques de chaque personnage : [attaque de base, technique, ultime, passif].", "export const MOVES: Record<string, [string, string, string, string]> = {"]
for i, (r, a, s, u, p) in moves.items():
    q = lambda t: "'" + t.replace("'", "’") + "'"
    out.append(f"  {i}: [{q(a)}, {q(s)}, {q(u)}, {q(p)}],")
out.append('}\n')
open(root + 'moves.ts', 'w', encoding='utf8').write('\n'.join(out))
