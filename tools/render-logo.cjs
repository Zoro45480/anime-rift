// Génère le logo 3D dans src/assets/logo/.  Lancer :  npm run dev  puis  node tools/render-logo.cjs
// Avec un argument (un dossier), écrit aussi une planche de contrôle logo-preview.png dans ce dossier.
const { chromium } = require('playwright')
const SHOTS = [['full', 1400, 620], ['emblem', 360, 360]]
;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const [v, w, h] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
    page.on('pageerror', (e) => console.log('ERR', v, e.message))
    page.on('console', (m) => m.type() === 'error' && console.log('console', v, m.text()))
    await page.goto(`http://localhost:5173/logo.html?v=${v}`)
    await page.waitForFunction('window.__ready === true', null, { timeout: 120000 })
    await page.screenshot({ path: `src/assets/logo/${v}.png`, omitBackground: true })
    await page.close()
    console.log('ok', v)
  }
  if (process.argv[2]) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 620 } })
    await page.setContent('<body style="margin:0;background:#0a0b1a;display:flex;align-items:center"><img src="http://localhost:5173/src/assets/logo/full.png" width="1100"><img src="http://localhost:5173/src/assets/logo/emblem.png" width="260"></body>')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${process.argv[2]}/logo-preview.png` })
  }
  await browser.close()
})()
