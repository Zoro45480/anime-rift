import { HEROES } from '../data/heroes'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'

export const Collection = ({ onSummon }: { onSummon: () => void }) => {
  const { owned } = useStore()
  const have = HEROES.filter((h) => owned[h.id]).length
  return (
    <div className="collection">
      <header className="section__head"><span>{String(have).padStart(2, '0')}</span><div><h2>Collection</h2><p>{have} carte{have > 1 ? 's' : ''} sur {HEROES.length} obtenue{have > 1 ? 's' : ''}.</p></div></header>
      <div className="bar bar--wide"><i style={{ width: `${(have / HEROES.length) * 100}%` }} /></div>
      <div className="collection__grid">
        {HEROES.map((h) => <Card key={h.id} hero={h} count={owned[h.id]} locked={!owned[h.id]} />)}
      </div>
      {have === 0 && <button className="btn btn--gold collection__cta" onClick={onSummon}>Faire une première invocation</button>}
    </div>
  )
}
