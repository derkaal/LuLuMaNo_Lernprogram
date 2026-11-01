#!/usr/bin/env node
// Wandelt HTML-Dateien in druckfertige A4-PDFs um: node tools/html2pdf.js datei.html [weitere.html ...]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const f of process.argv.slice(2)) {
    const abs = path.resolve(f);
    await page.goto('file://' + abs, { waitUntil: 'load' });
    const ziel = abs.replace(/\.html$/, '.pdf');
    await page.pdf({ path: ziel, format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log(ziel);
  }
  await browser.close();
})();
