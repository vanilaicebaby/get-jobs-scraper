const axios = require('axios');
const fs = require('fs');

(async () => {
  const res = await axios.get('https://www.jobs.cz/prace/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  fs.writeFileSync('jobscz.html', res.data);
  console.log('Soubor jobscz.html uložen.');
})();
