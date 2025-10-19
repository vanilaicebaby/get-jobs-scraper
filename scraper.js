const puppeteer = require('puppeteer');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const fs = require('fs');

// Konfigurace AWS
const dynamoDBClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'eu-central-1' 
});

// Univerzální funkce pro čekání
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Funkce pro obohacení dat 
function enrichJobData(job) {
  const enhancements = {
    benefits: ['Flexibilní pracovní doba', 'Home office'],
    description: 'Zajímavá pracovní příležitost v dynamickém prostředí.',
    employmentType: 'Plný úvazek',
    industry: 'Různé',
    remote: false,
    requiredSkills: ['Praxe v oboru'],
    seniorityLevel: 'Junior/Střední',
    tags: ['Práce'],
    postedDate: new Date().toISOString()
  };

  return {
    ...enhancements,
    ...job
  };
}

async function saveJobToDynamoDB(job) {
  // Příprava dat pro DynamoDB
  const dynamoItem = {
    TableName: 'Jobs',
    Item: {
      id: { S: job.id },
      title: { S: job.title || 'Neuvedeno' },
      url: { S: job.url || '' },
      company: { S: job.company || 'Neuvedeno' },
      location: { S: job.location || 'Neuvedeno' },
      salary: { S: job.salary || 'Neuvedeno' },
      
      // Obohacení dalšími údaji
      benefits: { SS: enrichJobData(job).benefits || [] },
      description: { S: enrichJobData(job).description || '' },
      employmentType: { S: enrichJobData(job).employmentType || 'Neuvedeno' },
      industry: { S: enrichJobData(job).industry || 'Neuvedeno' },
      remote: { BOOL: enrichJobData(job).remote || false },
      requiredSkills: { SS: enrichJobData(job).requiredSkills || [] },
      seniorityLevel: { S: enrichJobData(job).seniorityLevel || 'Neuvedeno' },
      tags: { SS: enrichJobData(job).tags || [] },
      postedDate: { S: enrichJobData(job).postedDate || new Date().toISOString() }
    }
  };

  try {
    const command = new PutItemCommand(dynamoItem);
    await dynamoDBClient.send(command);
    console.log(`Uloženo do DynamoDB: ${job.title}`);
  } catch (error) {
    console.error(`Chyba při ukládání do DynamoDB: ${job.title}`, error);
  }
}

async function scrapeJobsCz() {
  const browser = await puppeteer.launch({ 
    headless: true,
    defaultViewport: null 
  });
  
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  
  await page.goto('https://www.jobs.cz/prace/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Zpracování Cookies 
  try {
    const acceptButton = await page.waitForSelector('button[data-cc="accept-all"]', { timeout: 7000 });
    
    if (acceptButton) {
      await acceptButton.click();
      console.log('Cookies přijaty.');
    }
  } catch (error) {
    console.log('Tlačítko cookies nenalezeno nebo timeout.');
  }
  
  console.log('Čekám 5 sekund pro načtení asynchronních dat...');
  await wait(5000); 

  // Extrakce dat
  const jobs = await page.evaluate(() => {
    const getJobDetail = (jobEl, primarySelector, fallbackSelectors = []) => {
        const selectors = [primarySelector, ...fallbackSelectors];
        
        for (const selector of selectors) {
            const foundEl = jobEl.querySelector(selector);
            if (foundEl) {
                const text = foundEl.textContent.trim().replace(/\s+/g, ' ');
                if (text && text.toLowerCase() !== 'neuvedeno') {
                    return text;
                }
            }
        }
        
        return 'Neuvedeno';
    };

    const jobElements = document.querySelectorAll('article, .SerpOffer__element, .SerpOffer, [data-e="serp-list"] > div'); 
    const jobsData = [];

    jobElements.forEach((jobEl, index) => {
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
                company: getJobDetail(jobEl, '.SerpOffer__company', ['[data-e="serp-company"]', 'a[href*="/firma/"]']),
                location: getJobDetail(jobEl, '.SerpOffer__location', ['[data-e="serp-location"]', '[title*="Lokalita"]']),
                salary: getJobDetail(jobEl, '.SerpOffer__salary', ['[data-e="serp-salary"]', '[title*="Mzda"]']),
            });
        }
    });

    return jobsData;
  });
  
  console.log(`Nalezeno ${jobs.length} pracovních nabídek`);

  // Ukládání do souboru
  fs.writeFileSync('jobs_jobs_cz.json', JSON.stringify(jobs, null, 2), 'utf-8');
  
  // Ukládání do DynamoDB
  for (const job of jobs) {
    await saveJobToDynamoDB(job);
  }
  
  await browser.close();
  return jobs;
}

scrapeJobsCz()
  .then(jobs => console.log('Hotovo, data uložena do jobs_jobs_cz.json a DynamoDB'))
  .catch(error => {
    console.error('Došlo k závažné chybě při scrapování:', error);
    process.exit(1); 
  });