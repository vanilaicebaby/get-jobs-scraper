const puppeteer = require('puppeteer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

async function scrapeJobs() {
  console.log('🚀 Spouštím Puppeteer...');

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // logování událostí pro debugging
  page.on('console', (msg) => console.log('🧠 Browser log:', msg.text()));
  page.on('pageerror', (err) => console.log('💥 Page error:', err.message));
  page.on('response', (res) => {
    if (res.url().includes('api')) {
      console.log('📡 API volání:', res.url());
    }
  });

  const url = 'https://www.jobs.cz/prace/';
  console.log(`🌐 Otevírám ${url}`);

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // rychlejší, vyhne se věčným network requestům
      timeout: 45000,
    });
  } catch (err) {
    console.error('❌ Chyba při načítání stránky:', err.message);
  }

  // počkej, než se objeví nabídky
  console.log('⏳ Čekám na načtení nabídek (.SerpOffer nebo [data-test="offer"]) ...');

  try {
    await page.waitForSelector('.SerpOffer, [data-test="offer"]', { timeout: 20000 });
    console.log('✅ Nabídky načteny.');
  } catch (err) {
    console.error('⚠️  Nabídky se neobjevily do 20s – možná se změnil selektor.');
    await page.screenshot({ path: 'jobscz_timeout.png', fullPage: true });
    console.log('📸 Screenshot uložen jako jobscz_timeout.png pro kontrolu.');
    await browser.close();
    return;
  }

  // proveď test: kolik nabíděk vidíš v DOM
  const offerCount = await page.$$eval('.SerpOffer, [data-test="offer"]', (els) => els.length);
  console.log(`🔍 Počet nabídek nalezených v DOM: ${offerCount}`);

  // extrahuj nabídky
  const offers = await page.$$eval('.SerpOffer, [data-test="offer"]', (nodes) => {
    return nodes.map((node) => {
      const titleEl = node.querySelector('a[data-test="offer-title"], a[href*="/prace/"]');
      const companyEl = node.querySelector('[data-test="offer-company"], .SerpOffer__company');
      const locationEl = node.querySelector('[data-test="offer-location"], .SerpOffer__location');
      const salaryEl = node.querySelector('[data-test="offer-salary"], .SerpOffer__salary');
      const tags = Array.from(node.querySelectorAll('.Tag')).map((t) => t.textContent.trim());
      return {
        id: 'uuid-will-be-added',
        title: titleEl ? titleEl.textContent.trim() : 'Neuvedeno',
        url: titleEl ? titleEl.href : null,
        company: companyEl ? companyEl.textContent.trim() : 'Neuvedeno',
        location: locationEl ? locationEl.textContent.trim() : 'Neuvedeno',
        salary: salaryEl ? salaryEl.textContent.trim() : 'Neuvedeno',
        tags,
      };
    });
  });

  console.log(`✅ Nalezeno ${offers.length} nabídek`);

  if (offers.length === 0) {
    console.warn('⚠️  Žádné nabídky nebyly nalezeny, stránka mohla změnit strukturu.');
    await page.screenshot({ path: 'jobscz_nooffers.png', fullPage: true });
    console.log('📸 Screenshot uložen jako jobscz_nooffers.png.');
  }

  // přidej UUID a ulož
  const results = offers.map((o) => ({ ...o, id: uuidv4() }));
  const file = 'jobs-output.json';
  fs.writeFileSync(file, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`💾 Výsledky uloženy do ${file}`);

  await browser.close();
  console.log('🏁 Hotovo.');
}

scrapeJobs().catch((err) => {
  console.error('❌ Neošetřená chyba:', err);
});
