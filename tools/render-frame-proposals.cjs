// Planche de propositions de cadres (LR et MR) : rend chaque style, puis compose une image de comparaison.
// Lancer :  npm run dev  puis  node tools/render-frame-proposals.cjs <dossier de sortie>
const { chromium } = require('playwright')
const fs = require('fs')
const STYLES = [['a', 'A — Ronces'], ['b', 'B — Griffes'], ['c', 'C — Brasier'], ['d', 'D — Barbelés']]
const out = process.argv[2]
;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const [s] of STYLES) {
    for (const r of ['legend', 'rift']) {
      const page = await browser.newPage({ viewport: { width: 720, height: 920 } })
      page.on('pageerror', (e) => console.log('ERR', s, r, e.message))
      await page.goto(`http://localhost:5173/frames.html?r=${r}&style=${s}`)
      await page.waitForFunction('window.__ready === true', null, { timeout: 120000 })
      await page.screenshot({ path: `${out}/frame-${s}-${r}.png`, omitBackground: true })
      await page.close()
      console.log('ok', s, r)
    }
  }
  const b64 = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')
  const card = (s, r, art, tint, tag) => `
    <div class="card" style="--tint:${tint}">
      <div class="body"><img class="art" src="${b64(art)}"><b>${tag}</b></div>
      <img class="frame ${r}" src="${b64(`${out}/frame-${s}-${r}.png`)}">
    </div>`
  const html = `<body><style>
    body{margin:0;background:#0a0b1a;color:#f2f4ff;font:600 26px system-ui,sans-serif;padding:30px 30px 10px;width:1140px}
    h1{font-size:34px;margin:0 0 6px} p{margin:0 0 26px;color:#9aa0c2;font-size:20px;font-weight:400}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:0 70px;padding:22px 90px 70px;margin-bottom:22px;background:#10122a}
    .row h2{grid-column:1/-1;margin:0 0 84px -62px;font-size:32px}
    .card{position:relative;aspect-ratio:5/7}
    .body{position:absolute;inset:5.5%;border-radius:14px;overflow:hidden;background:radial-gradient(120% 80% at 50% 20%,var(--tint),#0d0b14)}
    .art{position:absolute;left:50%;top:4%;width:150%;transform:translateX(-50%)}
    .body b{position:absolute;left:7%;top:4%;font:italic 800 64px 'Arial Narrow',sans-serif;text-shadow:0 0 14px #000}
    .frame{position:absolute;left:-22%;top:-15.71%;width:144%;height:131.43%;filter:drop-shadow(0 4px 6px rgba(0,0,0,.6))}
    .frame.rift{filter:drop-shadow(0 0 9px rgba(255,46,79,.75)) drop-shadow(0 4px 6px rgba(0,0,0,.6))}
  </style>
  <h1>Propositions de cadres</h1><p>À gauche la carte LR, à droite la carte MR, pour chaque style.</p>
  ${STYLES.map(([s, label]) => `<div class="row"><h2>${label}</h2>${card(s, 'legend', 'src/assets/art/Darkness_Shibu-full.png', '#8a55d8', 'LR')}${card(s, 'rift', 'src/assets/art/Vita-full.png', '#2bb7c9', 'MR')}</div>`).join('')}
  </body>`
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.setContent(html)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/propositions-cadres.png`, fullPage: true })
  await browser.close()
  console.log('planche écrite')
})()
