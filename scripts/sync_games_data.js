const axios = require('axios');
const pgdb = require('./../pgdb');

// Steam API variables
const STEAM_API_KEY = 'B927A7E2DB6B29A3650B69AA54DB428C';
const STEAM_DOMAIN_NAME = 'hb-robo';
const STEAM_USER_ID = '76561198038902641';
const STEAM_GETOWNEDGAMES_URL = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
                                        `?key=${STEAM_API_KEY}` +
                                        `&steamid=${STEAM_USER_ID}`+
                                        `&format=json` +
                                        `&include_appinfo=1` +
                                        `&include_played_free_games=1`;


async function syncSteamData() {
    
    // Grab maximum rtime_last_played value so we can filter the return and don't add/update data unnecessarily.
    // rtime_last_played is Unix time, so we coalesce to 0 if query returns null
    let rtime_data = await pgdb.query(`
                                    SELECT coalesce(max(rtime_last_played),to_timestamp(0)) as rtime_last_played
                                    FROM steam_owned_games;
                                `);
    const MAX_RTIME = new Date(rtime_data.rows[0].rtime_last_played);
    const MAX_RTIME_UNIX = Math.floor(MAX_RTIME.getTime()/1000);

    axios.get(STEAM_GETOWNEDGAMES_URL)
        .then(response => {
            const games = response.data.response.games;
            // console.log(games);
            const filteredGames = games.filter(game => game.rtime_last_played > MAX_RTIME_UNIX);
            // console.log(filteredGames);
        })
        .catch(error => {
            console.log(error);
        });
}

syncSteamData();