// scraper.js
const puppeteer = require('puppeteer');
const fs = require('fs');

// Univerzální funkce pro čekání
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeJobsCz() {
  const browser = await puppeteer.launch({ 
    headless: true, // Změň na false pro vizuální kontrolu, jestli se data objeví
    defaultViewport: null 
  });
  
  const page = await browser.newPage();
  
  // Přidáme standardní User-Agent, abychom snížili riziko detekce
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  
  await page.goto('https://www.jobs.cz/prace/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // --- 1. KROK: Zpracování Cookies ---
  try {
    const acceptButton = await page.waitForSelector('button[data-cc="accept-all"]', { timeout: 7000 });
    
    if (acceptButton) {
      await acceptButton.click();
      console.log('Cookies přijaty.');
    }
  } catch (error) {
    console.log('Tlačítko cookies nenalezeno nebo timeout.');
  }
  
  // VYNUCENÉ DLOUHÉ ČEKÁNÍ: Necháme DOM stabilizovat, aby se načetla zpožděná data (firma, mzda)
  console.log('Čekám 5 sekund pro načtení asynchronních dat...');
  await wait(5000); 

  // --- 2. KROK: Extrakce v kontextu prohlížeče (page.evaluate) ---
  const jobs = await page.evaluate(() => {

    // Helper pro získání textu: Zkouší primární třídu a pak všechny známé fallbacky
    const getJobDetail = (jobEl, primarySelector, fallbackSelectors = []) => {
        const selectors = [primarySelector, ...fallbackSelectors];
        
        for (const selector of selectors) {
            const foundEl = jobEl.querySelector(selector);
            if (foundEl) {
                // Vrátíme vyčištěný text, pokud je nalezen a není prázdný
                const text = foundEl.textContent.trim().replace(/\s+/g, ' ');
                if (text && text.toLowerCase() !== 'neuvedeno') {
                    return text;
                }
            }
        }
        
        return 'Neuvedeno';
    };

    // Všechny možné obalové elementy, které jsme identifikovali
    const jobElements = document.querySelectorAll('article, .SerpOffer__element, .SerpOffer, [data-e="serp-list"] > div'); 
    const jobsData = [];

    jobElements.forEach((jobEl, index) => {
        // Hledáme titulek a URL (stabilní část)
        const titleLinkEl = jobEl.querySelector('h2 a, h3 a, .SerpOffer__name a');

        if (titleLinkEl) {
            let fullUrl = titleLinkEl.getAttribute('href');
            if (fullUrl && !fullUrl.startsWith('http')) {
                fullUrl = `https://www.jobs.cz${fullUrl}`;
            }

            jobsData.push({
                id: `job-${index}-${Math.random().toString(36).substr(2, 4)}`,
                title: titleLinkEl.textContent.trim().replace(/\s+/g, ' '),
                url: fullUrl || null,
                
                // POUŽITÍ KOMBINOVANÝCH SELEKTORŮ:
                // 1. Firma
                company: getJobDetail(jobEl, '.SerpOffer__company', ['[data-e="serp-company"]', 'a[href*="/firma/"]']),
                // 2. Lokalita
                location: getJobDetail(jobEl, '.SerpOffer__location', ['[data-e="serp-location"]', '[title*="Lokalita"]']),
                // 3. Mzda
                salary: getJobDetail(jobEl, '.SerpOffer__salary', ['[data-e="serp-salary"]', '[title*="Mzda"]']),
            });
        }
    });

    return jobsData;
  });
  
  console.log(`Nalezeno ${jobs.length} pracovních nabídek`);

  fs.writeFileSync('jobs_jobs_cz.json', JSON.stringify(jobs, null, 2), 'utf-8');
  
  await browser.close();
  return jobs;
}

scrapeJobsCz()
  .then(jobs => console.log('Hotovo, data uložena do jobs_jobs_cz.json'))
  .catch(error => {
    console.error('Došlo k závažné chybě při scrapování:', error);
    process.exit(1); 
  });