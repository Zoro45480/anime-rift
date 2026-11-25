// Fabrique la texture de paillettes des cartes holographiques : un semis d'étoiles et de points,
// dessiné une seule fois au démarrage et rangé dans la variable CSS --glitter.

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const COLORS = ['#ffffff', '#ffffff', '#bff6ff', '#ffd9f4', '#fff3bf', '#d9ccff']

const buildGlitter = (): string => {
  const r = rng(2026)
  const size = 240
  let shapes = ''
  for (let i = 0; i < 170; i++) {
    const x = (r() * size).toFixed(1)
    const y = (r() * size).toFixed(1)
    const color = COLORS[Math.floor(r() * COLORS.length)]
    const opacity = (0.35 + r() * 0.65).toFixed(2)
    if (r() < 0.22) {
      // étoile à quatre branches
      const s = 1.6 + r() * 3.2
      const t = s * 0.2
      shapes += `<path transform="translate(${x} ${y})" d="M0 ${-s}L${t} ${-t}L${s} 0L${t} ${t}L0 ${s}L${-t} ${t}L${-s} 0L${-t} ${-t}Z" fill="${color}" opacity="${opacity}"/>`
    } else {
      shapes += `<circle cx="${x}" cy="${y}" r="${(0.35 + r() * 0.9).toFixed(2)}" fill="${color}" opacity="${opacity}"/>`
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${shapes}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export const installGlitter = () => document.documentElement.style.setProperty('--glitter', buildGlitter())
