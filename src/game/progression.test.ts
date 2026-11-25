import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { MOVES } from '../data/moves'
import { GROUPS } from '../data/collectifs'
import { RARITY_ORDER } from '../data/rarities'
import { MAX_GROUPS, ENERGY_MAX, ENERGY_REGEN_MS, energyNow, AWAKEN_STAT, LEVEL_CAP, accountLevel, accountNeed, rebirthTitle, REBIRTH_LEVEL, power, baseRank, baseStats, cardState, collectifs, kitOf, levelFromXp, MAX_LEVEL, statsAt, xpToNext } from './progression'

describe('progression des cartes', () => {
  it('monte de niveau au bon nombre de points', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelFromXp(99).level).toBe(1)
    expect(levelFromXp(100)).toEqual({ level: 2, into: 0, need: xpToNext(2) })
    expect(levelFromXp(100 + 140 + 5)).toEqual({ level: 3, into: 5, need: 180 })
    expect(levelFromXp(1e9).level).toBe(MAX_LEVEL)
  })

  it('le niveau et les collectifs augmentent les statistiques', () => {
    const h = HEROES[0]
    expect(statsAt(h, 1, 0)).toEqual(baseStats(h))
    expect(statsAt(h, 11, 0).atk).toBe(Math.round(h.atk * 1.2))
    expect(statsAt(h, 1, 10).def).toBe(Math.round(h.def * 1.1))
  })

  it('le collectif d’univers compte les cartes possédées et plafonne à 12 %', () => {
    const h = HEROES[0]
    const world = HEROES.filter((x) => x.world === h.world)
    expect(collectifs(h, {})[0]).toMatchObject({ have: 0, bonus: 0 })
    expect(collectifs(h, Object.fromEntries(world.slice(0, 5).map((x) => [x.id, 1])))[0].bonus).toBe(2)
    const all = Object.fromEntries(HEROES.map((x) => [x.id, 1]))
    expect(collectifs(h, all)[0].bonus).toBe(12)
    expect(cardState(h, {}, all).bonus).toBe(12)
    expect(cardState(h, {}, { ...all, [h.id]: 0 }).bonus).toBe(0) // pas de bonus pour une carte non possédée
  })

  it('les groupes d’univers s’activent à deux membres, renforcent leur statistique, six au plus', () => {
    for (const g of GROUPS) {
      expect(g.members.length).toBeGreaterThanOrEqual(2)
      for (const id of g.members) expect(HEROES.find((x) => x.id === id)?.world).toBe(g.world)
    }
    for (const h of HEROES) expect(collectifs(h, {}).length).toBeGreaterThanOrEqual(2) // chaque carte a au moins un groupe
    const naruto = HEROES.find((x) => x.id === 'naruto')!
    const alone = cardState(naruto, {}, { naruto: 1 })
    const duo = cardState(naruto, {}, { naruto: 1, sasuke: 1 }) // Équipe 7 (+15 % ATK) et Quatrième Grande Guerre (+10 % ATK)
    expect(alone.extra.atk).toBe(0)
    expect(duo.extra.atk).toBe(25)
    expect(duo.stats.atk).toBe(Math.round(naruto.atk * 1.25))
    expect(duo.stats.def).toBe(naruto.def)
    expect(cardState(naruto, {}, { sasuke: 1, sakura: 1 }).extra.atk).toBe(0) // il faut posséder la carte elle-même
    const all = Object.fromEntries(HEROES.map((x) => [x.id, 1]))
    for (const h of HEROES) expect(collectifs(h, all).filter((c) => c.stat !== 'all' && c.counted).length).toBeLessThanOrEqual(MAX_GROUPS)
  })

  it('classe chaque carte de 1 à 210 et donne un kit à chaque rôle', () => {
    for (const h of HEROES) {
      expect(baseRank(h)).toBeGreaterThanOrEqual(1)
      expect(baseRank(h)).toBeLessThanOrEqual(HEROES.length)
      expect(kitOf(h)).toHaveLength(4)
      expect(MOVES[h.id].every((name) => name.length > 0)).toBe(true)
    }
    const best = HEROES.filter((h) => baseRank(h) === 1)
    expect(best.every((h) => h.rarity === 'rift')).toBe(true)
  })

  it('plus une carte est rare, plus elle est puissante : aucune carte ne dépasse une carte plus rare', () => {
    const range = (id: string) => HEROES.filter((h) => h.rarity === id).map((h) => power(baseStats(h)))
    for (let i = 0; i < RARITY_ORDER.length - 1; i++) {
      expect(Math.min(...range(RARITY_ORDER[i]))).toBeGreaterThan(Math.max(...range(RARITY_ORDER[i + 1])))
    }
  })

  it('seules les cartes LR et MR ont un double rôle, et chaque bannière a ses tanks, ses DPS et ses soigneurs', () => {
    for (const h of HEROES) if (h.role.includes('/')) expect(['legend', 'rift']).toContain(h.rarity)
    for (const world of new Set(HEROES.map((h) => h.world))) {
      const roles = HEROES.filter((h) => h.world === world).map((h) => h.role).join(' ')
      for (const r of ['DPS', 'Tank', 'Soigneur']) expect(roles).toContain(r)
    }
  })

  it('les dégâts affichés d’une technique suivent les statistiques de la carte', () => {
    const h = HEROES.find((x) => x.role === 'DPS')!
    expect(kitOf(h)[2].text).toContain(Math.round(h.atk * 3.5).toLocaleString('fr-FR'))
    expect(kitOf(h, statsAt(h, 11, 0))[2].text).toContain(Math.round(Math.round(h.atk * 1.2) * 3.5).toLocaleString('fr-FR'))
  })

  it('le compte monte jusqu’au niveau 100, deux fois plus lentement après chaque Renaissance', () => {
    expect(accountLevel(0, 0)).toEqual({ level: 1, into: 0, need: 120 })
    expect(accountLevel(120, 0).level).toBe(2)
    expect(accountLevel(120, 1).level).toBe(1)
    let total = 0
    for (let l = 1; l < REBIRTH_LEVEL; l++) total += accountNeed(l, 0)
    expect(accountLevel(total - 1, 0).level).toBe(99)
    expect(accountLevel(total, 0)).toEqual({ level: 100, into: 0, need: 0 })
    expect(accountLevel(total, 1).level).toBeLessThan(100)
  })

  it('chaque Renaissance ajoute 6 % aux cartes possédées et donne des titres', () => {
    const h = HEROES[0]
    const own = { [h.id]: 1 }
    expect(cardState(h, {}, own, 2).bonus - cardState(h, {}, own, 0).bonus).toBe(12)
    expect(cardState(h, {}, own, 1).stats.atk).toBeGreaterThan(cardState(h, {}, own, 0).stats.atk)
    expect(cardState(h, {}, {}, 3).bonus).toBe(0)
    expect([0, 1, 4, 10].map(rebirthTitle)).toEqual(['', 'Revenant', 'Marcheur des failles', 'Maître du cycle'])
  })

  it('une carte reste bloquée au niveau 50 tant qu’elle n’est pas libérée, puis monte jusqu’à 100 avec +15 %', () => {
    const h = HEROES[0]
    const own = { [h.id]: 1 }
    const xp = { [h.id]: 1e9 }
    const locked = cardState(h, xp, own)
    const freed = cardState(h, xp, own, 0, [h.id])
    expect(locked.level).toBe(LEVEL_CAP)
    expect(freed.level).toBe(MAX_LEVEL)
    expect(freed.bonus - locked.bonus).toBe(AWAKEN_STAT)
    expect(freed.stats.hp).toBeGreaterThan(locked.stats.hp)
  })

  it('l’énergie remonte d’un éclair toutes les 6 minutes sans dépasser le maximum', () => {
    expect(energyNow(3, 0, ENERGY_REGEN_MS - 1)).toBe(3)
    expect(energyNow(3, 0, ENERGY_REGEN_MS * 2)).toBe(5)
    expect(energyNow(3, 0, ENERGY_REGEN_MS * 100)).toBe(ENERGY_MAX)
    expect(energyNow(ENERGY_MAX, 0, 1e12)).toBe(ENERGY_MAX)
  })
})
