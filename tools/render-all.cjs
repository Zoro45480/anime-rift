// Génère les illustrations (corps entier + buste) de chaque personnage dans src/assets/art/.
// Lancer :  npm run dev  (dans un terminal)  puis  node tools/render-all.cjs
const { chromium } = require('playwright')
const HEROES = [
  ['Vita', 0], ['Vivi', 1], ['Victoria_Rubin', 3], ['Sendagaya_Shino', 2], ['Sendagaya_Shibu', 4],
  ['Sakurada_Fumiriya', 1], ['Darkness_Shibu', 2], ['HairSample_Male', 3],
]
const only = process.argv[2]
;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const [m, pose] of HEROES) {
    if (only && only !== m) continue
    for (const [shot, w, h] of [['full', 720, 1200], ['bust', 360, 360]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } })
      page.on('pageerror', (e) => console.log('ERR', m, e.message))
      await page.goto(`http://localhost:5173/render.html?m=${m}&pose=${pose}&shot=${shot}`)
      await page.waitForFunction('window.__ready === true', null, { timeout: 120000 })
      await page.screenshot({ path: `src/assets/art/${m}-${shot}.png`, omitBackground: true })
      await page.close()
      console.log('ok', m, shot)
    }
  }
  await browser.close()
})()
