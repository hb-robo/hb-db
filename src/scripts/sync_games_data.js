//  POSTGRES TOOLS
const pgdb = require('../../pgdb');
const format = require('pg-format');
//  API TOOLS
const axios = require('axios');
const steam = require('steam-js-api');


//==================== Steam API variables ====================
const STEAM_API_KEY = 'B927A7E2DB6B29A3650B69AA54DB428C';
const STEAM_USER_ID = '76561198038902641';

const STEAM_GETOWNEDGAMES_URL = `` +
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
    `?key=${STEAM_API_KEY}` +
    `&steamid=${STEAM_USER_ID}`+
    `&format=json` + 
    `&include_appinfo=1` + // adds game title and artwork URL extension to return
    `&include_played_free_games=1`; // includes F2P games that I have opened at least once
const STEAM_GETGAMESCHEMA_URL = `` +
    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
    `?key=${STEAM_API_KEY}`
    `&appid=`; // appended later
const STEAM_GETPLAYERACHIEVEMENTS_URL = `` +
    `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
    `?key=${STEAM_API_KEY}`
    `&steamid=${STEAM_USER_ID}` +
    `&appid=`; // appended later
const STEAM_GETGLOBALACHIEVEMENTRATES_URL = `` +
    `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/` +
    `?gameid=` // appended later
const STEAM_GETAPPDETAILS_URL = `` +
    `http://store.steampowered.com/api/appdetails` +
    `?appids=` // appended later

/**
 * Hits the Steam API to update steam data in hb-db as few calls as posssible.
 * 1) Checks all owned games for version and achievement count changes.
 * 2) Checks all recently played games for achievement progress changes.
 * 3) Adds all data for games not in database. 
 **/
async function syncSteamData() {
    // Grab user's game library from Steam API.
    const apiLibrary = await axios(STEAM_GETOWNEDGAMES_URL).then( result => {
        console.log(result.data.games);
        return result.data.games;
    }).catch(console.error);
    setTimeout(() => {}, 1000);

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



//==================== RA API variables ====================


async function syncRAData() {}


async function syncGamesData() {
    await Promise.allSettled([
        syncSteamData(),
        syncRAData()
    ]);
}

module.exports = {syncGamesData};
