// 
const pgdb = require('./pgdb');
const cron = require('node-cron');

function syncDB() {
    syncGamesData();
    syncMusicData();
    syncBooksData();
    syncFitnessData();
}

cron.schedule('0 2 * * *', syncDB);