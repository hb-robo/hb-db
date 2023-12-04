import syncSteamData from './games/syncSteam';
import syncRetroAchievementsData from './games/syncRetroAchievements';

async function syncGamesData(): Promise<void> {
    process.stdout.write('Syncing games data... \n');
    var startTime = performance.now();
    try {
        await Promise.allSettled([
            syncSteamData(),
            syncRetroAchievementsData()
        ]);

        let endTime = performance.now();
        process.stdout.write(`Finished syncing games data (${(endTime - startTime)/1000} sec)\n\n`);
    }
    catch(error: any) {
        let endTime = performance.now();
        process.stdout.write(`Failed to sync games data (${(endTime - startTime)/1000} sec)\n`);
        console.error(error);
        process.stdout.write(`\n`);
    }
}

export default syncGamesData;