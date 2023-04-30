//  POSTGRES TOOLS
const pgdb = require('./../pgdb');
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
    `&appid=`; // will be appended later
const STEAM_GETPLAYERACHIEVEMENTS_URL = `` +
    `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
    `?key=${STEAM_API_KEY}`
    `&steamid=${STEAM_USER_ID}` +
    `&appid=`; // will be appended later

/**
 * Hits the Steam API to update steam data in hb-db as few calls as posssible.
 * 1) Checks all owned games for version and achievement count changes.
 * 2) Checks all recently played games for achievement progress changes.
 * 3) Adds all data for games not in database. 
 **/
async function syncSteamData() {
    // Grab list of games and versions in Steam library.
    let game_list_raw = await pgdb.query(`
        SELECT appid, gameVersion
        FROM steam_owned_games;
    `);
    const OWNED_GAMES = game_list_raw.rows;

    // Check for new game versions among current library and changes in achievement_count.
    OWNED_GAMES.forEach(game => async function() {
        let game_schema = await axios.get(`${STEAM_GETGAMESCHEMA_URL}${game.appid}`).catch(console.error);
        if (game_schema.game.gameVersion != game.gameVersion) {
            updateQuery = format(
                `UPDATE steam_owned_games
                SET gameVersion = %L,
                    achievement_count = %L
                WHERE appid = %L;`,
                game_schema.game.gameVersion,
                game_schema.game.achievements.length,
                game.appid
            )
            await pgdb.query(updateQuery).catch(console.error);
        }
    });

    // Grab maximum rtime_last_played value so we don't add/update data unnecessarily.
    let max_rtime_raw = await pgdb.query(`
        SELECT COALESCE(MAX(rtime_last_played),to_timestamp(0)) AS rtime_last_played
        FROM steam_owned_games;
    `); // rtime_last_played is in Unix time, so we coalesce to 0 if query returns null.
    const MAX_RTIME = new Date(max_rtime_raw.rows[0].rtime_last_played);
    const MAX_RTIME_UNIX = Math.floor(MAX_RTIME.getTime()/1000);


    // Return JSON object of all games that either:
    //    1) Have a new appid not yet in DB (new purchase), or
    //    2) Have a rtime_last_played more recent than the max in DB (new playtime)
    const data_to_sync = await axios(STEAM_GETOWNEDGAMES_URL).then( result => {
        let games = result.data.games;
        
        let recentGames = games.filter(game => game.rtime_last_played > MAX_RTIME_UNIX && APPID_LIST.includes(game.appid));
        let newGames = games.filter(game => !APPID_LIST.includes(game.appid));

        console.log(newGames);
        return {recentGames, newGames};
    }).catch(console.error);

    // Update recently played games to check for progress made.
    data_to_sync.recentGames.forEach(game => async function() {
        let achievement_data = await axios(`${STEAM_GETPLAYERACHIEVEMENTS_URL}${game.appid}`).catch(console.error);
        let updateQuery;
        if (achievement_data.playerstats.hasOwnProperty('error')) { // game does not have achievement support
            updateQuery = format(`
                UPDATE steam_owned_games
                SET rtime_last_played = %L,
                WHERE appid = %L`,
                game.rtime_last_played,
                appid
            );
        } else {
            unlocked_achievement_count = achievement_data.playerstats.achievements.filter(cheev => cheev.achieved === 1).length;
            updateQuery = format(`
                UPDATE steam_owned_games
                SET rtime_last_played = %L,
                    achievements_unlocked = %L
                WHERE appid = %L`,
                game.rtime_last_played,
                unlocked_achievement_count,
                appid
            );
        }
        await pgdb.query(updateQuery).catch(console.error);
    });

    // Add all data for newly discovered games.
    data_to_sync.newGames.forEach(game => async function() {
        // grab game version
        let game_schema = await axios.get(`${STEAM_GETGAMESCHEMA_URL}${game.appid}`).catch(console.error);
        let game_version = game_schema.game.gameVersion
        // grab achievement progress
        let achievement_data = await axios(`${STEAM_GETPLAYERACHIEVEMENTS_URL}${game.appid}`).catch(console.error);
        let has_achievements = achievement_data.playerstats.hasOwnProperty()
        let achievement_list = achievement_data.playerstats.achievements
        let achievement_count = achievement_list.length
        let unlocked_achievement_count = achievement_list.filter(cheev => cheev.achieved === 1).length
      
        let insert_query;
        if (has_achievements) {
            insert_query = format(
                `INSERT INTO 
                steam_owned_games(
                    appid, name, game_version, 
                    rtime_last_played, playtime, box_art_url,
                    has_achievements, achievement_count, unlocked_achievement_count)
                VALUES (%L, %L, %L, %L, %L, %L)`,
                row.appid, row.name, game_version,
                row.rtime_last_played, row.playtime_forever,
                `https://steamcdn-a.akamaihd.net/steam/apps/${row.appid}/library_600x900_2x.jpg`,
                row.hasOwnProperty('has_community_visible_stats'),
                achievement_count, unlocked_achievement_count
            );
        } else {
            insert_query = format(
                `INSERT INTO 
                steam_owned_games(
                    appid, name, game_version, 
                    rtime_last_played, playtime, box_art_url,
                    has_achievements)
                VALUES (%L, %L, %L, %L, %L, %L)`,
                row.appid, row.name, game_version,
                row.rtime_last_played, row.playtime_forever,
                `https://steamcdn-a.akamaihd.net/steam/apps/${row.appid}/library_600x900_2x.jpg`,
                row.hasOwnProperty('has_community_visible_stats')
            );
        }
        await pgdb.query(insert_query);
    });

}



//==================== RA API variables ====================


async function syncRAData() {

}

async function syncGamesData() {
    await Promise.allSettled([
        syncSteamData(),
        syncRAData()
    ]);
}

module.exports = {syncGamesData};