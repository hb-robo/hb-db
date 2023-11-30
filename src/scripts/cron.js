// CRON TOOLS AND IMPORTS
const cron = require('node-cron');
import { syncGamesData } from './scripts/sync_games_data';
import { syncMusicData } from './scripts/sync_music_data';
import { syncGitHubData } from './scripts/sync_github_data';
import { syncFitnessData } from './scripts/sync_fitness_data';


async function syncDB() {
    await Promise.allSettled([
        syncGamesData(),
        syncMusicData(),
        syncGitHubData(),
        syncFitnessData()
    ]);
}

cron.schedule('0 2 * * *', syncDB);