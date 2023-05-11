//==================== Postgres Inports ====================
const pgdb = require('./../pgdb');
const format = require('pg-format');
//==================== API Imports ====================
const axios = require('axios');



//==================== Steam API variables ====================
const LASTFM_API_KEY = 'de3a50d3d65ff718b46b4518d48f241a';
const LASTFM_SECRET = 'd3ddf92039d8195e7d2024e1df4066db';
const LASTFM_USER = 'hb-robo';

const LASTFM_URL_HEAD = `http://ws.audioscrobbler.com/2.0/`;
const LASTFM_URL_FOOTER = `&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json`;
const LASTFM_GETUSERINFO_URL = `${LASTFM_URL_HEAD}?method=user.getinfo${LASTFM_URL_FOOTER}`;
const LASTFM_GETTOPALBUMS_URL = `${LASTFM_URL_HEAD}?method=user.gettopalbums&period=1month${LASTFM_URL_FOOTER}`;
const LASTFM_GETRECENTTRACKS_URL = `${LASTFM_URL_HEAD}?method=user.getrecenttracks&extended=1${LASTFM_URL_FOOTER}`;


//==================== API Endpoint Sync Functions ====================
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
async function syncLastFMRecentTopAlbums() {
    const topAlbums = await axios(LASTFM_GETTOPALBUMS_URL)
        .then( result => {
            console.log(result.data.topalbums.album);
            return result.data.topalbums.album;
        }).catch(console.error);
    setTimeout(() => {}, 1000);
    
    if (!topAlbums) {
        return;
    }
    
    /**
     * field structure for music.lastfm_albumchart:
        * rank[int],
        * album_mbid[varchar], album_name[varchar], album_image_url[varchar],
        * artist_mbid[varchar], artist_name[varchar],
        * playcount[int]
     */
    var insertTopAlbumsQuery = `
        BEGIN;
        TRUNCATE lastfm_albumchart;
        INSERT INTO lastfm_albumchart
        VALUES `;
    for (let i = 0; i < topAlbums.length; i++) {
        let album = topAlbums[i];
        insertRow = format(
            `(%L, %L, %L, %L, %L, %L)`,
            album["@attr"].rank, album.playcount,
            album.mbid, album.name, album.image[3]["#text"],
            album.artist.mbid, album.artist.name
        );
        insertTopAlbumsQuery += insertRow;
        if (i !== (topAlbums.length + 1)) {
            insertTopAlbumsQuery += ', '
        } else {
            insertTopAlbumsQuery += '; COMMIT;';
        }
    }
    
    await pgdb.query(insertTopAlbumsQuery)
        .catch(error => {
            return pgdb.query('ROLLBACK')
               .then(() => {
                    throw error;
                });
        });
}


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

    const recentScrobblesURL = `${LASTFM_GETRECENTTRACKS_URL}&from=${mostRecentScrobbleTime+1}&to=${nowUnixTime}`;
    const recentScrobbles = await axios(recentScrobblesURL)
        .then( result => {
            console.log(result.data.recenttracks.track);
            return result.data.recenttracks.track;
        }).catch(console.error);
    setTimeout(() => {}, 1000);
    
    /**
     * field structure for music.lastfm_scrobbles:
        * song_mbid[varchar], song_name[varchar],
        * artist_mbid[varchar], artist_name[varchar], artist_image_url[varchar],
        * album_mbid[varchar], album_name[varchar], album_image_url[varchar],
        * time[int], loved[boolean]
     */
    var insertRecentScrobblesQuery = 'INSERT INTO lastfm_scrobbles VALUES ';
    for (let i = 0; i < recentScrobbles.length; i++) {
        let scrobble = recentScrobbles[i];
        insertRow = format(
            `(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)`,
            scrobble.mbid, scrobble.name,
            scrobble.artist.mbid, scrobble.artist.name, scrobble.artist.image[3]["#text"],
            scrobble.album.mbid, scrobble.album["#text"], scrobble.image[3]["#text"],
            scrobble.date.uts, scrobble.loved
        );
        insertRecentScrobblesQuery += insertRow;
        if (i !== (recentScrobbles.length + 1)) {
            insertRecentScrobblesQuery += ', '
        }
    }

    await pgdb.query(insertRecentScrobblesQuery)
        .catch(error => {
            return pgdb.query('ROLLBACK')
            .then(() => {
                    throw error;
                });
        });
}


//==================== Async Aggregation Functions ====================
/**
 * Asynchronously updates all database tables sourced from the Last.FM API.
 * @returns {undefined}
 */
async function syncLastFMData() {
    await Promise.allSettled([
        syncLastFMUserInfo(),
        syncLastFMRecentTopAlbums(),
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


//==================== Module Exports ====================
module.exports = { syncMusicData };