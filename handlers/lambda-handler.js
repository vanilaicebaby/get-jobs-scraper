const { scrapeJobsCz } = require('../scraper');

exports.handler = async (event, context) => {
    try {
        await scrapeJobsCz();
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Scraping úspěšně dokončeno' })
        };
    } catch (error) {
        console.error('Chyba v Lambda funkci:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Chyba při scrapování', error: error.toString() })
        };
    }
};