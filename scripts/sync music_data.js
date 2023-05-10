//  POSTGRES TOOLS
const pgdb = require('./../pgdb');
const format = require('pg-format');
//  API TOOLS
const axios = require('axios');
const steam = require('steam-js-api');


//==================== Steam API variables ====================
const LASTFM_API_KEY = 'de3a50d3d65ff718b46b4518d48f241a';
const LASTFM_SECRET = 'd3ddf92039d8195e7d2024e1df4066db';
const LASTFM_USER = 'hb-robo';

const LASTFM_URL_HEAD = `http://ws.audioscrobbler.com/2.0/`;
const LASTFM_URL_FOOTER = `&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json`;
const LASTFM_GETUSERINFO_URL = `${LASTFM_URL_HEAD}?method=user.getinfo${LASTFM_URL_FOOTER}`;
const LASTFM_GETALBUMCHART_URL = `${LASTFM_URL_HEAD}?method=user.getweeklyalbumchart${LASTFM_URL_FOOTER}`;
const LASTFM_GETARTISTS_URL = `${LASTFM_URL_HEAD}?method=library.getartists&limit=10000${LASTFM_URL_FOOTER}`;
// VERY IMPORTANT: recenttracks supports &from=".."&to="..", do not pull full history every time
const LASTFM_GETRECENTTRACKS_URL = `${LASTFM_URL_HEAD}?method=user.getrecenttracks&extended=1${LASTFM_URL_FOOTER}`;


/**
 * Inserts or updates data from the Last.fm GetUserInfo endpoint.
 * @returns {undefined}
 */
async function syncLastFMUserInfo() {
    const userInfo = await axios(LASTFM_GETUSERINFO_URL).then( result => {
        console.log(result.data.user);
        return result.data.user;
    }).catch(console.error);
    setTimeout(() => {}, 1000);
    
    let userInDB_raw = await pgdb.query(`SELECT 
                     CASE WHEN EXISTS (SELECT * FROM lastfm_user) THEN 1 
                     ELSE 0 END`).catch(console.error);
    let userInDB = userInDB_raw.rows[0].case;
    
    var userInsertQuery;
    if (userInDB) {
        userInsertQuery = format(
            `UPDATE lastfm_user SET 
                (image, age, subscriber, playcount, playlists, bootstrap) = (%L, %L, %L, %L, %L, %L)
                WHERE name = %L`,
            userInfo.image, userInfo.age, userInfo.subscriber,
            userInfo.playcount, userInfo.playlists, userInfo.bootstrap,
            LASTFM_USER);
    } 
    else {
        userInsertQuery = format(
            `INSERT INTO lastfm_user (
                id, name, realname, url, image, country, age, gender, 
                subscriber, playcount, playlists, bootstrap, registered)
            VALUES (
                %L, %L, %L, %L, %L, %L, %L, %L,
                %L, %L, %L, %L, %L)`,
            userInfo.id, userInfo.name, userInfo.realname, userinfo.url, userInfo.image,
            userInfo.country, userInfo.age, userInfo.gender, userInfo.subscriber,
            userInfo.playcount, userInfo.playlists, userInfo.bootstrap, userInfo.registered);
    }
    await pgdb.query(userInsertQuery).catch(console.error);
}
    
/**
 * Regenerate album chart data from last month.
 * @returns {undefined}
 */
async function syncLastFMAlbumChart() {
    const nowUnixTime = ~~(Date.now()/1000);
    const oneMonthAgoUnixTime = nowUnixTime - (30*24*60*60); // subtracting 30 days of time
    
    const newAlbumChartURL = `${LASTFM_GETALBUMCHART_URL}&from${oneMonthAgoUnixTime}&to=${nowUnixTime}`;
    const topAlbums = await axios(newAlbumChartURL)
        .then( result => {
            console.log(result.data.albums);
            return result.data.albums;
        }).catch(console.error);
    setTimeout(() => {}, 1000);
    
    if (!userInfo) {
        return;
    }
    
    const insertAlbumChartQuery = format(`
        BEGIN;
        TRUNCATE lastfm_albumchart;
        INSERT INTO lastfm_albumchart
            SELECT *
            FROM json_populate_recordset(NULL::lastfm_albumchart, %L)
        COMMIT;`,
        JSON.stringify(topAlbums)
    );
    
    await pgdb.query(insertAlbumChartQuery)
        .catch(error => {
            return pgdb.query('ROLLBACK')
               .then(() => {
                    throw error;
                });
        });
}

/**
 * Grab artist count data for my last.fm user.
 * @returns {undefined}
 */
async function syncLastFMArtists() {}

/**
 * Grab all new scrobbles since most recent scrobble in DB, and adds them to the "scrobbles" table.
 * @returns {undefined}
 */
async function syncLastFMRecentTracks() {
    const nowUnixTime = ~~(Date.now()/1000);

    const mostRecentScrobbleTime_raw = await pgdb.query(
        `SELECT coalesce(max(date), 0) 
        from lastfm_scrobbles;`
        ).catch(console.error);
    const mostRecentScrobbleTime = mostRecentScrobbleTime_raw.rows[0].max;

    const recentScrobblesURL = `${LASTFM_GETRECENTTRACKS_URL}&from=${nowUnixTime}&to=${mostRecentScrobbleTime}`;




}

/**
 * Asynchronously updates all database tables sourced from the Last.FM API.
 * @returns {undefined}
 */
async function syncLastFMData() {
    await Promise.allSettled([
        syncLastFMUserInfo(),
        syncLastFMAlbumChart(),
        syncLastFMArtists(),
        syncLastFMRecentTracks()
    ]);
}

/**
 * Asynchronously updates all data from endpoints referring to music listening and logging.
 * @returns {undefined}
 */
async function syncMusicData() {
    await Promise.allSettled([
        syncLastFMData()
    ]);
}

module.exports = {syncMusicData};
