import { useEffect, useState } from 'react'
import { extraArt, iconArt, uiArt } from '../assets/manifest'
import { BANNERS } from '../data/banners'
import { HEROES, heroById } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { colossusOf, rollCol, TRIES_PER_DAY } from '../game/colossus'
import { DAILY_REWARDS, dailyStatus, msToDayEnd, type Reward } from '../game/contracts'
import { isPityRarity } from '../data/rarities'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'

const n = (x: number) => x.toLocaleString('fr-FR')
const left = (iso: string) => {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now())
  return `Encore ${Math.floor(ms / 86400000)} j ${Math.floor((ms % 86400000) / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min`
}
const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min` }
const ago = (t: number) => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.floor(m / 60)} h` : `il y a ${Math.floor(m / 1440)} j` }
const label = (r: Reward) => [r.gems && `${r.gems} âmes`, r.energy && `${r.energy} éclairs`, r.tickets && `${r.tickets} sceau${r.tickets > 1 ? 'x' : ''}`, r.shards && `${r.shards} fragments`, r.scrolls?.medium && 'parchemin', r.scrolls?.large && 'grand parchemin'].filter(Boolean).join(' + ')
const icon = (r: Reward, day: number) => (day === 7 ? uiArt('chest') : r.tickets ? iconArt('seal') : r.energy ? iconArt('bolt') : r.scrolls ? iconArt('scroll-medium') : iconArt('soul'))

// Notes de mise à jour : ce qui a vraiment été ajouté au jeu.
const NEWS = [
  { title: 'Le Bazar des Failles ouvre', points: ['Achète aux marchands du jour, vends tes doublons ou mets-les aux enchères.', 'Alertes de prix et cote calculée sur tes vraies ventes.'] },
  { title: 'Toutes les cartes se mélangent', points: ['Chaque bannière donne les cartes des 7 univers.', 'Seules les MR restent propres à leur univers.'] },
  { title: 'Les quatre portes sont ouvertes', points: ['Les Colosses, La Spire, l’Arène et le Grand Rift sont jouables.', '79 succès, le Chemin du Rift et la boutique en âmes.'] },
]

export type HomeGo = { banner: (i: number) => void; contracts: () => void; collection: () => void; play: (mode?: 'colossus') => void; profile: () => void; community: () => void }

export const Home = ({ go }: { go: HomeGo }) => {
  const store = useStore()
  const [, tick] = useState(0)
  const [more, setMore] = useState(false)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t) }, [])
  const now = new Date()
  const st = dailyStatus(store.quests.daily, now)
  const mine = HEROES.filter((h) => store.owned[h.id]).length
  const name = store.profile.name.trim() || 'Joueur'
  const { boss, banner: cb } = colossusOf(now)
  const col = rollCol(store.col, now)
  const big = HEROES.filter((h) => isPityRarity(h.rarity)).flatMap((h) => (store.log[h.id] ?? []).filter((e) => e.k === 'pull').map((e) => ({ hero: h, t: e.t }))).sort((a, b) => b.t - a.t).slice(0, 14)

  return (
    <div className="home">
      <div className="home__strip">
        <button className="home__lead" onClick={() => go.banner(0)}><small>● À l'affiche</small><b>Découvrir &amp; invoquer</b><i>↗</i></button>
        {BANNERS.map((b, i) => {
          const star = heroById(b.star)
          return (
            <button key={b.id} className="home__ban" style={{ ['--hue' as string]: b.hue }} onClick={() => go.banner(i)}>
              {store.bannerArt[b.id] && <img className="home__ban-bg" src={store.bannerArt[b.id]} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
              <span className="home__ban-text"><i>MR</i><b>{b.world}</b><small>{left(b.endsAt)}</small></span>
              <span className="home__ban-card"><Card hero={star} inert /></span>
            </button>
          )
        })}
      </div>

      <header className="home__hello">
        <div><p className="eyebrow">Anime Rift · ton rendez-vous quotidien</p><h1>L'aventure continue.</h1><p>Content de te revoir, <b>{name}</b></p></div>
        <button className="home__count" onClick={go.collection}><b>{n(mine)}</b><span>carte{mine > 1 ? 's' : ''} à tes côtés ↗</span></button>
      </header>

      <div className="home__grid">
        <section className="home__daily">
          <header><p className="home__num">01 / Récompense quotidienne</p><span className="home__pill">7 jours · le 7e ouvre un coffre</span></header>
          <h2>Le calendrier du Rift</h2>
          <p className="home__lede">Reviens chaque jour : chaque case donne sa récompense. Si tu manques un jour, la série repart au jour 1.</p>
          <ol className="home__days">
            {DAILY_REWARDS.map((r, i) => {
              const day = i + 1
              const state = day < st.day || (day === st.day && st.claimed) ? 'done' : day === st.day ? 'today' : 'next'
              return (
                <li key={day} className={`home__day home__day--${state} ${day === 7 ? 'home__day--big' : ''}`}>
                  <span className="home__day-n">{day}</span>
                  <img src={icon(r, day)} alt="" />
                  {state === 'done' && <i className="home__day-ok">✓</i>}
                  <b>{label(r)}</b><small>Jour {day}</small>
                </li>
              )
            })}
          </ol>
          <footer>
            <p><b>{st.claimed ? st.day : Math.max(0, st.day - 1)}</b> jour{st.day > 1 ? 's' : ''} d'affilée · <span>{st.claimed ? `Prochaine case dans ${clock(msToDayEnd(now))}` : `Aujourd'hui : ${label(DAILY_REWARDS[st.day - 1])}`}</span></p>
            <button className="home__cta" disabled={st.claimed} onClick={store.claimDaily}>{st.claimed ? 'Récupéré aujourd’hui ✓' : `Récupérer le jour ${st.day}`}<i>↗</i></button>
          </footer>
        </section>

        <div className="home__side">
          <section className="home__news">
            <header><p className="home__num">02 / Quoi de neuf ?</p><span className="home__pill">Notes</span></header>
            <h2>Le journal du Rift</h2>
            <p className="home__date">26 novembre 2026</p>
            {(more ? NEWS : NEWS.slice(0, 1)).map((x) => (
              <div key={x.title}><h3>{x.title}</h3><ul>{x.points.map((p) => <li key={p}>{p}</li>)}</ul></div>
            ))}
            <button className="home__more" onClick={() => setMore(!more)}>{more ? 'Réduire' : 'Lire les notes complètes'}<i>{more ? '−' : '+'}</i></button>
          </section>
          <section className="home__boss" style={{ ['--hue' as string]: cb.hue }}>
            <header><p className="home__num">03 / Colosse de la semaine</p><img src={extraArt(`emblem-${cb.id}`)} alt="" /></header>
            <h2>{boss.name}</h2>
            <p>{boss.title} · {cb.world}. {col.cleared.length} difficulté{col.cleared.length > 1 ? 's' : ''} battue{col.cleared.length > 1 ? 's' : ''} sur 4 · {TRIES_PER_DAY} essais par jour.</p>
            <button className="home__boss-go" onClick={() => go.play('colossus')}>Affronter le Colosse<i>↗</i></button>
          </section>
        </div>
      </div>

      <nav className="home__links" aria-label="Raccourcis">
        <button onClick={go.contracts}><small>01</small><span><b>Tes rendez-vous</b><em>Contrats, Chemin du Rift et récompenses</em></span><i>↗</i></button>
        <button onClick={go.collection}><small>02</small><span><b>Ta collection</b><em>{n(mine)} / {n(HEROES.length)} cartes à découvrir</em></span><i>↗</i></button>
        <button onClick={() => go.play()}><small>03</small><span><b>À toi de jouer</b><em>Saga, Colosses, Spire et Arène</em></span><i>↗</i></button>
      </nav>

      <section className="home__pulls">
        <header><p className="home__num"><i className="home__live" />Tes gros tirages · SSR, LR et MR</p><h2>Gros tirages</h2></header>
        {big.length === 0 ? <p className="pf-empty">Pas encore de carte SSR, LR ou MR. Elles apparaîtront ici dès ton premier gros tirage.</p> : (
          <ul>{big.map((x, i) => <li key={`${x.hero.id}-${i}`}><Card hero={x.hero} /><b>{x.hero.name}</b><small><i style={{ color: RARITIES[x.hero.rarity].color }}>{RARITIES[x.hero.rarity].short}</i> · {ago(x.t)}</small></li>)}</ul>
        )}
      </section>

      <footer className="home__foot">
        <span className="kiri home__foot-kiri" style={{ backgroundImage: `url(${extraArt('guide')})` }} aria-hidden="true" />
        <b>ANIME RIFT</b>
        <button onClick={go.collection}>Toutes les cartes</button>
        <button onClick={go.profile}>Mon profil</button>
        <button onClick={go.community}>Communauté</button>
        <span>Jeu de fans, sans serveur : ta partie reste sur cet appareil.</span>
        <span className="home__coin"><Coin name="soul" size={16} />{n(store.gems)}</span>
      </footer>
    </div>
  )
}
