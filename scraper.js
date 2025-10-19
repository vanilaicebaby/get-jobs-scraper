// scraper.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const cheerio = require('cheerio'); // Nová knihovna pro parsování

// Univerzální funkce pro čekání
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeJobsCz() {
  const browser = await puppeteer.launch({ 
    // Nastavte na false, pokud chcete vidět, jak se načítá HTML
    headless: true, 
    defaultViewport: null 
  });
  
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  
  await page.goto('https://www.jobs.cz/prace/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // --- 1. KROK: Zpracování Cookies a čekání ---
  try {
    const acceptButton = await page.waitForSelector('button[data-cc="accept-all"]', { timeout: 7000 });
    
    if (acceptButton) {
      await acceptButton.click();
      console.log('Cookies přijaty.');
      await wait(1500); 
    }
  } catch (error) {
    console.log('Tlačítko cookies nenalezeno nebo timeout, pokračuji bez kliknutí.');
    await wait(1000); 
  }

  // --- 2. KROK: Stažení celého HTML obsahu ---
  const html = await page.content();
  await browser.close();
  
  // --- 3. KROK: Parsování obsahu pomocí Cheerio (na serveru) ---
  const $ = cheerio.load(html);
  const jobs = [];
  
  // Přesný selektor pro kontejner, kde jsou výsledky:
  const jobElements = $('[data-e="serp-list"] > div, article.SerpOffer'); 

  jobElements.each((index, element) => {
    const job = $(element); // Cheerio element pro jednu nabídku
    
    // Extrakce dat uvnitř elementu:
    const titleLinkEl = job.find('.SerpOffer__name a');
    const companyEl = job.find('.SerpOffer__company, a.CompanyLink'); 
    const locationEl = job.find('.SerpOffer__location'); 
    const salaryEl = job.find('.SerpOffer__salary, [data-e="serp-salary"]');

    // Helper pro bezpečné získání textu
    const getText = (el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        return text || 'Neuvedeno';
    };

    jobs.push({
      id: `job-${index}-${Math.random().toString(36).substr(2, 4)}`, 
      title: getText(titleLinkEl),
      url: titleLinkEl.attr('href') ? `https://www.jobs.cz${titleLinkEl.attr('href')}` : null,
      company: getText(companyEl),
      location: getText(locationEl),
      salary: getText(salaryEl)
    });
  });

  console.log(`Nalezeno ${jobs.length} pracovních nabídek`);

  fs.writeFileSync('jobs_jobs_cz.json', JSON.stringify(jobs, null, 2), 'utf-8');
  
  return jobs;
}

scrapeJobsCz()
  .then(jobs => console.log('Hotovo, data uložena do jobs_jobs_cz.json'))
  .catch(error => {
    console.error('Došlo k závažné chybě při scrapování:', error);
    process.exit(1); 
  });