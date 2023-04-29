const axios = require('axios');
const format = require('pg-format');
const pgdb = require('./../pgdb');

// Steam API variables
const STEAM_API_KEY = 'B927A7E2DB6B29A3650B69AA54DB428C';
const STEAM_DOMAIN_NAME = 'hb-robo';
const STEAM_USER_ID = '76561198038902641';
const STEAM_GETOWNEDGAMES_URL = `` +
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
    `?key=${STEAM_API_KEY}` +
    `&steamid=${STEAM_USER_ID}`+
    `&format=json` + 
    `&include_appinfo=1` + // adds game title and artwork URL extension to return
    `&include_played_free_games=1`; // includes F2P games that I have opened at least once


//  Function to update the Steam data in hb-db with as few queries and API calls as possible.
//  Things that can be checked with one GetOwnedGames call:
//      1) If a game has been played since last sync
//      2) If there are new games in the library
//  Things that has to be checked with individual GetGameSchema calls: <=== by far most taxing element here
//      3) If existing games in the library have had version updates
//          -> if so, check for delta in achievement_count and unlocked_achievements

//  1) Get list of appids in database
//  2) Check those games for updates
//      a) if new version, check achievement_count and unlocked_achievement_count
//  3) Check list of owned games for new games or recently played games
//      a) if new, add to DB
//      a) if recently played, update rtime_last_played and achievement progress

async function syncSteamData() {
    // Grab list of game appids in Steam library to check for new games later.
    let appid_list_raw = await pgdb.query(`
        SELECT DISTINCT appid
        FROM steam_owned_games;
    `);
    const APPID_LIST = appid_list_raw.rows.map(row => row.appid);

    // Grab maximum rtime_last_played value so we don't add/update data unnecessarily.
    // rtime_last_played is Unix time, so we coalesce to 0 if query returns null.
    let max_rtime_raw = await pgdb.query(`
        SELECT COALESCE(MAX(rtime_last_played),to_timestamp(0)) AS rtime_last_played
        FROM steam_owned_games;
    `);
    const MAX_RTIME = new Date(max_rtime_raw.rows[0].rtime_last_played);
    const MAX_RTIME_UNIX = Math.floor(MAX_RTIME.getTime()/1000);

    // Return JSON object of all games that either:
    //    1) Have a new appid not yet in DB (new purchase), or
    //    2) Have a rtime_last_played more recent than the max in DB (new playtime)
    const new_game_data = axios.get(STEAM_GETOWNEDGAMES_URL)
        .then(response => {
            let games = response.data.response.games;
            let filteredGames = games.filter(
                game => !APPID_LIST.includes(game.appid) ||
                        game.rtime_last_played > MAX_RTIME_UNIX
            );
            console.log(filteredGames);
            return filteredGames;
        })
        .catch(error => {
            console.log(error);
        });
    
    new_game_data.forEach(row => {
        const STEAM_GAMESCHEMA_URL = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${row.appid}`;
        let game_schema = axios.get(STEAM_GAMESCHEMA_URL)
                            .catch(error => {console.log(error)});
        has_achievements = game_schema.data.response.game.availableStats.hasOwnProperty('achievements')
        if (has_achievements) {

        }

        let insert_query = format(
            `INSERT INTO 
            steam_owned_games(
                appid, name, playtime_forever, rtime_last_played, 
                box_art_url, has_stats)
            VALUES (%L, %L, %L, %L, %L, %L)`,
            row.appid,
            row.name,
            row.playtime_forever,
            row.rtime_last_played,
            `https://steamcdn-a.akamaihd.net/steam/apps/${row.appid}/library_600x900_2x.jpg`,
            row.hasOwnProperty('has_community_visible_stats')
        );

        await pgdb.query(insert_query);
    });
    


    
}

async function syncRAData() {

}

module.exports = {syncSteamData, syncRAData};