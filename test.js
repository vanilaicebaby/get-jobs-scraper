const puppeteer = require('puppeteer');
const fs = require('fs');

async function fetchJobsCzHtml() {
  try {
    const browser = await puppeteer.launch({ 
      headless: false,  // Zobrazí prohlížeč
      defaultViewport: null 
    });
    
    const page = await browser.newPage();

    // Nastavení user agenta
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.goto('https://www.jobs.cz/prace/', { 
      waitUntil: 'networkidle2',  // Počká, až síť ustane
      timeout: 60000  // 60 vteřin timeout
    });

    // Volitelně: Interakce s cookies
    try {
      const cookieButtons = [
        '#consent-cookies-accept-all',
        'button[data-testid="consent-accept-all"]',
        '.cookies-consent-button'
      ];

      for (const selector of cookieButtons) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          console.log(`Kliknuto na cookies tlačítko: ${selector}`);
          await page.waitForTimeout(2000);
          break;
        } catch {}
      }
    } catch {}

    // Stažení HTML včetně renderovaného obsahu
    const htmlContent = await page.content();
    fs.writeFileSync('jobscz_rendered.html', htmlContent, 'utf-8');
    
    console.log(`HTML staženo a uloženo (${htmlContent.length} znaků)`);

    await browser.close();
  } catch (error) {
    console.error('Chyba:', error);
  }
}

fetchJobsCzHtml();