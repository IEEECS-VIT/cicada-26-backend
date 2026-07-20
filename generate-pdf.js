const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const htmlPath = path.resolve(__dirname, 'schema.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  await page.pdf({ 
    path: 'schema.pdf', 
    format: 'A4', 
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } 
  });
  
  await browser.close();
  console.log("PDF generation complete!");
})();
