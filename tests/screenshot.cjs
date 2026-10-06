const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']});
  try {
    const page = await browser.newPage({viewport: {width: 1460, height: 1020}, offline: true});
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.supraLab && supraLab.state.frames > 2, {timeout: 60000});
    const output = path.resolve(__dirname, '../docs/preview.png');
    fs.mkdirSync(path.dirname(output), {recursive: true});
    await page.screenshot({path: output, timeout: 60000});
    console.log('Saved docs/preview.png');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exit(1);});
