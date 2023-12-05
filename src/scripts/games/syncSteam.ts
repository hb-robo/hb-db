import format from 'pg-format';
import axios from 'axios';
import fs from 'fs';
import pgdb from '../../pgdb';
import { delay } from '../../utils';


//==================== Steam API constants ====================
const STEAM_GETOWNEDGAMES_URL = `` +
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
    `?key=${process.env.STEAM_API_KEY}` +
    `&steamid=${process.env.STEAM_USER_ID}`+
    `&format=json` + 
    `&include_appinfo=1` + // adds game title and artwork URL extension to return
    `&include_played_free_games=1`; // includes F2P games that I have opened at least once

const STEAM_GETGAMESCHEMA_URL = `` +
    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
    `?key=${process.env.STEAM_API_KEY}` +
    `&appid=`; // appended later

const STEAM_GETPLAYERACHIEVEMENTS_URL = `` +
    `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
    `?key=${process.env.STEAM_API_KEY}` +
    `&steamid=${process.env.STEAM_USER_ID}` +
    `&appid=`; // appended later

const STEAM_GETGLOBALACHIEVEMENTRATES_URL = `` +
    `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/` +
    `?gameid=` // appended later

const STEAM_GETAPPDETAILS_URL = `` +
    `http://store.steampowered.com/api/appdetails` +
    `?appids=` // appended later




//==================== Steam API response interfaces ====================
// Returned from /getOwnedGames
interface SteamGame {
    appid: number;
    name: string;
    playtime_forever: number; // rounded number of minutes played
    img_icon_url: string;
    playtime_windows_forever: number;
    playtime_mac_forever: number;
    playtime_linux_forever: number;
    rtime_last_played: number; // Unix time of last time game opened
    // optional
    playtime_2weeks?: number; // if played in last two weeks, number of minutes played
    content_descriptorids?: number[];
    has_community_visible_stats?: boolean;
    has_leaderboards?: boolean;
}
interface SteamOwnedGames {
    response?: {
        game_count: number;
        games: SteamGame[];
    };
}

// returned from /GetUserStatsForGame/v2/
// only stats that the player has altered once and achievements unlocked.
interface SteamGameUserStats_Stat {
    name: string; // "Scout.accum.iDamageDealt"
    value: number; // always >0
}
interface SteamGameUserStats_Achievement {
    name: string; // achievement apiname "TF_PLAY_GAME_EVERYCLASS"
    achieved: number; // always 1 (achieved)
}
interface SteamGameUserStats {
    steamID: string;
    gameName: string;
    stats?: SteamGameUserStats_Stat
}

// returned from /GetSchemaForGame/v2/
// gives general information about tracked items for play, does not concern itself with player at all
interface SteamGameStat {
    name: string; // stat apiname "Scout.accum.iDamageDealt"
    defaultvalue: number;
    displayName: string; // presumably sometimes this name is different
}
interface SteamGameAchievement {
    name: string; // achievement apiname "TF_HEAVY_KILL_CAPPING_ENEMIES"
    defaultvalue: number; // no clue what this does, maybe for achievements with counters?
    displayName: string; // player-facing name "Purge"
    hidden: number; // 0 or 1
    description: string;
    icon: string; // url to icon
    icongray: string; // url to "unachieved" icon
}
interface SteamGameSchema {
    game: {
        gameName?: string;
        gameVersion?: number; // string of integer, incremented with each update
        availableGameStats?: {
            stats?: SteamGameStat[];
            achievements?: SteamGameAchievement[]
        };
    }
}

// returned from /GetPlayerAchievements/v0001/
// includes all achievements, with unlocktimes
interface SteamGamePlayerAchievement {
    apiname: string; // "TF_PLAY_GAME_EVERYCLASS"
    achieved: number; // 0 or 1
    unlocktime: number; // Unix time
}
interface SteamGamePlayerAchievements {
    playerstats: {
        steamID?: string;
        gameName?: string; // "Team Fortress 2"
        achievements?: SteamGamePlayerAchievement[];
        error?: string;
        success: boolean; // false if no achievements for game, player doesnt have game, etc
    };
}

// returned from /GetGlobalAchievementPercentagesForApp/v0002/
interface SteamGameGlobalAchievementPercentage {
    name: string; // achievement apiname "TF_MAPS_FOUNDRY_WIN_ROUNDS"
    percent: number; // "27.5" not "0.275"
}
interface SteamGameGlobalAchievementPercentages {
    achievementpercentages: {
        achievements: SteamGameGlobalAchievementPercentage[];
    }
}

// returned from /appdetails
// HORRIBLY designed API endpoint, outermost property name is app_id, this interface represents interior
interface SteamAppDetails {
    success: boolean;
    data: {
        type: string;
        name: string;
        steam_appid: string;
        required_age: number;
        is_free: boolean;
        dlc: number[]; // list of appids
        detailed_description: string;
        about_the_game: string;
        short_description: string;
        supported_languages: string; // comma separated list
        header_image: string; // URL
        capsule_image: string; // URL
        capsule_imagev5: string; // URL
        website: string; // URL
        pc_requirements: {
            minimum: string; // HTML string
            recommended?: string; // HTML string
        };
        mac_requirements: {
            minimum: string; // HTML string
            recommended?: string; // HTML string
        };
        linux_requirements: {
            minimum: string; // HTML string
            recommended?: string; // HTML string
        };
        developers: string[];
        publishers: string[];
        packages: number[]; // presumably ids of bundles its included in
        package_groups: {

        };
        platforms: {
            windows: boolean;
            mac: boolean;
            linux: boolean;
        };
        metacritic?: {
            score: number;
            url: string;
        };
        categories: SteamAppCategory[];
        genres: SteamAppGenre[];
        screenshots: SteamAppScreenshot[];
        movies: SteamAppMovies[];
        recommendations: {
            total: number;
        };
        achievements: {
            total: number;
            highlighted: SteamAppHighlightedAchievement[];
        };
        release_date: {
            coming_soon: boolean;
            date: string;
        };
        support_info: {
            url: string;
            email: string;
        };
        background: string; // URL
        background_raw: string // URL
        content_descriptors: {
            ids: number[];
            notes: string;
        }
    }
}


// Idealized merged components for local storage
interface LocalSteamGameAchievement {
    name: string; // from /GetSchemaForGame
    defaultvalue: number; // from /GetSchemaForGame
    displayName: string; // from /GetSchemaForGame
    hidden: number; // from /GetSchemaForGame
    description: string; // from /GetSchemaForGame
    icon: string; // from /GetSchemaForGame
    icongray: string; // from /GetSchemaForGame
    percent: number; // from /GetGlobalAchievementPercentagesForApp
    achieved: number; // from /GetPlayerAchievements
    unlocktime: number; // from /GetPlayerAchievements
}
interface LocalSteamGameSchema {
    appid: string; // from /GetOwnedGames
    playtime_forever: number; // from /GetOwnedGames
    name?: string; // from /GetOwnedGames
    playtime_2weeks?: number; // from /GetOwnedGames
    img_icon_url?: string; // from /GetOwnedGames
    content_descriptorids?: number[]; // from /GetOwnedGames
    has_community_visible_stats?: boolean; // from /GetOwnedGames
    achievements?: LocalSteamGameAchievement[];
}


/**
 * Grab user's game library from Steam API.
 * This is used to establish list of Game IDs to loop through for updates.
 * @returns array of SteamGame objects
 */
async function getSteamOwnedGames(): Promise<SteamOwnedGames> {
    process.stdout.write('\t|-- Grabbing Steam library... ');
    var startTime = performance.now();
    try {
        const steamLibrary : SteamOwnedGames = await axios(STEAM_GETOWNEDGAMES_URL);
        console.log(steamLibrary.response);

        let endTime = performance.now();
        process.stdout.write(`done (${(endTime - startTime)/1000} sec)\n`);
        return steamLibrary;
    }
    catch(error: any) {
        let endTime = performance.now();
        process.stdout.write(`failed (${(endTime - startTime)/1000} sec)\n`);
        console.error(error);
        throw error;
    }
    finally {
        await delay(1000);
    }
}


async function getLocalSteamLibrary(): Promise<> {
    
}




/**
 * A long function filled with meaningless and old code from when I was trying to compress this into relational data.
 * I may return to this idea for some part of the website but it isn't going to be used at first.
 * @param local the currently stored JSON object return from Steam API
 * @param api the newly acquired JSON object return from Steam API
 */
async function buildSteamTables(local: SteamOwnedGames, api: SteamOwnedGames): Promise<void> {
    // Grab list of games and versions in DB to compare to.
    let dbLibrary_raw = await pgdb.query(`
        SELECT appid, gameVersion
        FROM steam_owned_games;
    `);
    var dbLibrary = dbLibrary_raw.rows;
    const DB_APPID_LIST = dbLibrary.map(game => game.appid);

    // Grab maximum rtime_last_played value, i.e. last time Steam was played in DB.
    let max_rtime_raw = await pgdb.query(`
        SELECT COALESCE(MAX(rtime_last_played),to_timestamp(0)) AS rtime_last_played
        FROM steam_owned_games;
    `); // rtime_last_played is in Unix time, so we coalesce to 0 if query returns null.
    const MAX_RTIME = new Date(max_rtime_raw.rows[0].rtime_last_played);
    const MAX_RTIME_UNIX = Math.floor(MAX_RTIME.getTime()/1000);

    // Start building insert query for steam_games table.
    let gameInsertQueryHeader = 
        `INSERT INTO steam_games (
            appid, game_title, developers, publishers, 
            game_version, rtime_last_played, playtime, box_art_url,
            has_achievements, unlocked_achievement_count, achievement_count)
        VALUES `;
    var gameRowsToInsert = [];
    var gamesInsertArgs = [];
    
    // Start building insert query for steam_achievements table.
    let achievementInsertQueryHeader = 
        `INSERT INTO steam_achievements (
            appid, api_name, display_name, icon_url, description,
            achieved, unlock_time, global_unlock_rate)
        VALUES `;
    var achievementRowsToInsert = [];
    var achievementsInsertArgs = [];
    

    // Handle each game based on what data needs to be updated or added.
    for (let i = 0; i < apiLibrary.length; i++) {
        let game = apiLibrary[i];
        /** 
         * Possible needed API calls per game:
         *      GetSchemaForGame -> always true, need to check for new game version and achievement presence
         *      GetGlobalAchievementPercentagesForApp -> only true if game has achievements
         *      GetPlayerAchievements -> only if game is new or has been played since last sync, and has achievements
         *      AppDetails -> only if game is new
         **/ 
        let isNew = !DB_APPID_LIST.includes(game.appid);
        let wasPlayedRecently = DB_APPID_LIST.includes(game.appid) && game.rtime_last_played > MAX_RTIME_UNIX;

        // grabbing game schema
        let gameSchema = await axios.get(`${STEAM_GETGAMESCHEMA_URL}${game.appid}`).catch(console.error);
        setTimeout(() => {}, 1000);

        let hasAchievements = (Object.keys(gameSchema.game).length === 0);

        // grabbing global achievement data
        let globalAchievementData;
        if(hasAchievements) {
            globalAchievementData = await axios.get(`${STEAM_GETGLOBALACHIEVEMENTRATES_URL}${game.appid}`).catch(console.error);
            setTimeout(() => {}, 1000);
        }

        // grabbing player achievement data
        let playerAchievementData;
        if((isNew || wasPlayedRecently) && hasAchievements) {
            playerAchievementData = await axios.get(`${STEAM_GETPLAYERACHIEVEMENTS_URL}${game.appid}`).catch(console.error);
            setTimeout(() => {}, 1000);
        }

        // Handle 
        if(isNew) {
            let appDetails;
            appDetails = await axios.get(`${STEAM_GETAPPDETAILS_URL}${game.appid}`).catch(console.error);
            setTimeout(() => {}, 1000);

            /** appid, game_title, developers, publishers, 
            game_version, rtime_last_played, playtime, box_art_url,
            has_achievements, unlocked_achievement_count, achievement_count) */
            let comma = (gameRowsToInsert.length > 0) ? ',' : '';

            let insertData;
            let rowInsertArgs;
            if(hasAchievements) {
                insertData = `('${game.appid}', '${game.name}',
                                '${appDetails[game.appid].data.developers}',
                                '${appDetails[game.appid].data.publishers}',
                                '${gameSchema.game.gameVersion}', %L, %L, 
                                '${`https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_600x900_2x.jpg`}',
                                %L, %L, %L)`
                let numCheevsUnlocked = playerAchievementData.playerstats.achievements.filter(cheev => cheev.achieved = 1).length;
                let totalNumCheevs = playerAchievementData.playerstats.achievements.length;

                rowInsertArgs = [game.rtime_last_played, game.played_forever, true, numCheevsUnlocked, totalNumCheevs];
                
                
            } else {
                insertData = `('${game.appid}', '${game.name}',
                                '${appDetails[game.appid].data.developers}',
                                '${appDetails[game.appid].data.publishers}',
                                %L, %L, %L, 
                                '${`https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_600x900_2x.jpg`}',
                                %L, %L, %L)`
                rowInsertArgs = [null, game.rtime_last_played, game.played_forever, false, null, null];
            }
            gameRowsToInsert.push(insertData);
            gamesInsertArgs = gamesInsertArgs.concat(rowInsertArgs);
        }
        else {
            let dbData = (!isNew) ? dbLibrary.find(row => row.appid === game.appid) : null;
            let hasNewVersion = dbData && gameSchema.game.gameVersion != game.gameVersion;

            // update steam_games
            // update steam_achievements
        }
    }

    // Insert new game data if there is any
    if (gameRowsToInsert.length > 0) {
        let gameInsertQueryString = `${gameInsertQueryHeader}${gameRowsToInsert.join()}`;
        let gameInsertQuery = format(gameInsertQueryString, ...gamesInsertArgs);
        await pgdb.query(gameInsertQuery).catch(console.error);
    }

    // Insert new achievement data if there is any
    if (achievementRowsToInsert.length > 0) {
        let achievementInsertQueryString = `${achievementInsertQueryHeader}${achievementRowsToInsert.join()}`;
        let achievementInsertQuery = format(achievementInsertQueryString, ...achievementsInsertArgs);
        await pdgb.query(achievementInsertQuery).catch(console.error);
    }
}


/**
 * Hits the Steam API to update steam data in hb-db as few calls as posssible.
 * 1) Checks all owned games for version and achievement count changes.
 * 2) Checks all recently played games for achievement progress changes.
 * 3) Adds all data for games not in database. 
 **/
async function syncSteamData(): Promise<void> {
    process.stdout.write('|-- Syncing Steam data... ');
    var startTime = performance.now();
    try {
        const apiSteamOwnedGames: SteamOwnedGames = await getSteamOwnedGames();
        const localSteamOwnedGames: SteamOwnedGames = fs.readFileSync('../../../public/json/steamOwnedGames.json')



        let endTime = performance.now();
        process.stdout.write(`|-- Finished syncing Steam data (${(endTime - startTime)/1000} sec)\n`);
    }
    catch(error: any) {
        let endTime = performance.now();
        process.stdout.write(`|-- Failed to sync Steam data (${(endTime - startTime)/1000} sec)\n`);
        console.error(error);
    }
}


export default syncSteamData;