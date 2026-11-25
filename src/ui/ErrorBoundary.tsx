import { Component, type ReactNode } from 'react'

// Si un écran plante, on l'explique au joueur au lieu de laisser une page blanche.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash" role="alert">
        <h1>Cet écran a rencontré un problème</h1>
        <p>Ta partie n'est pas perdue. Recharge la page ; si ça recommence, envoie ce message :</p>
        <pre>{this.state.error}</pre>
        <button className="btn" onClick={() => location.reload()}>Recharger</button>
      </div>
    )
  }
}
