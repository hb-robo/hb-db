// CRON TOOLS AND IMPORTS
import cron from 'node-cron';
import syncGamesData from './syncGames';
import syncMusicData from './syncMusic';
import syncCodingData from './syncCoding';

async function syncDB(): Promise<void> {
    process.stdout.write('Syncing hb-db... \n');
    console.log('-------------------------------------')
    var startTime = performance.now();

    try {
        await Promise.allSettled([
            syncGamesData(),
            syncMusicData(),
            syncCodingData(),
        ]);
        let endTime = performance.now();
        console.log('-------------------------------------')
        process.stdout.write(`Finished syncing hb-db (${(endTime - startTime)/1000} sec)\n\n`);
    }
    catch(error: any) {
        let endTime = performance.now();
        process.stdout.write(`Failed to sync hb-db (${(endTime - startTime)/1000} sec)\n`);
        console.error(error);
    }
}

cron.schedule('0 2 * * *', syncDB);