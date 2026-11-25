// Génère les cadres 3D dans src/assets/frames/.  Lancer :  npm run dev  puis  node tools/render-frames.cjs
// Avec un argument (ex. un dossier), écrit aussi une planche de contrôle preview.png dans ce dossier.
const { chromium } = require('playwright')
const RARITIES = ['rare', 'epic', 'legend', 'rift']
;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const r of RARITIES) {
    const page = await browser.newPage({ viewport: { width: 720, height: 920 } })
    page.on('pageerror', (e) => console.log('ERR', r, e.message))
    await page.goto(`http://localhost:5173/frames.html?r=${r}`)
    await page.waitForFunction('window.__ready === true', null, { timeout: 120000 })
    await page.screenshot({ path: `src/assets/frames/${r}.png`, omitBackground: true })
    await page.close()
    console.log('ok', r)
  }
  if (process.argv[2]) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 480 } })
    const imgs = RARITIES.map((n) => `<img src="http://localhost:5173/src/assets/frames/${n}.png" width="350">`).join('')
    await page.setContent(`<body style="margin:0;background:#1b2a33;display:flex">${imgs}</body>`)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${process.argv[2]}/preview.png` })
  }
  await browser.close()
})()
