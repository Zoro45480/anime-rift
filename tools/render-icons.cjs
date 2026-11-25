// Génère les icônes 3D dans src/assets/icons/.  Lancer :  npm run dev  puis  node tools/render-icons.cjs
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const i of ['gem', 'ticket', 'bolt']) {
    const page = await browser.newPage({ viewport: { width: 256, height: 256 } })
    page.on('pageerror', (e) => console.log('ERR', i, e.message))
    await page.goto(`http://localhost:5173/icons.html?i=${i}`)
    await page.waitForFunction('window.__ready === true', null, { timeout: 120000 })
    await page.screenshot({ path: `src/assets/icons/${i}.png`, omitBackground: true })
    await page.close()
    console.log('ok', i)
  }
  await browser.close()
})()
