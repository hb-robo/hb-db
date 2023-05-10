
// Last.fm connection config
const LASTFM_API_KEY = 'de3a50d3d65ff718b46b4518d48f241a';
const LASTFM_SECRET = 'd3ddf92039d8195e7d2024e1df4066db';
const LASTFM_USER = 'hb-robo';

// Last.fm API calls
const LASTFM_URL_HEAD = `http://ws.audioscrobbler.com/2.0/`;
const LASTFM_URL_FOOTER = `&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json`;
const LASTFM_GETUSERINFO_URL = `${LASTFM_URL_HEAD}?method=user.getinfo${LASTFM_URL_FOOTER}`;
// album charts need date ranges in Unix time:
//     e.g. '&from=3109328109&to=4732843289"
const LASTFM_GETALBUMCHART_URL = `${LASTFM_URL_HEAD}?method=user.getweeklyalbumchart${LASTFM_URL_FOOTER}`;
const LASTFM_GETARTISTS_URL = `${LASTFM_URL_HEAD}?method=library.getartists&limit=10000${LASTFM_URL_FOOTER}`;
// VERY IMPORTANT: recenttracks supports &from=".."&to="..", do not pull full history every time
const LASTFM_GETRECENTTRACKS_URL = `${LASTFM_URL_HEAD}?method=user.getrecenttracks&extended=1${LASTFM_URL_FOOTER}`;

// Order of operations:
//    1) Grab User Info, update lastfm_user
//    2) Grab all scrobbles from getRecentTracks since most recent scrobble in DB
//    3) Regenerate weekly listen charts
// Not sure if getArtists will be useful, but would save on scrobble count calculation. 
// Will probably just make counts table for artists, albums, etc.
async function syncLastFMData() {
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
    switch (userInDB) {
        case true:
            userInsertQuery = format(
                `UPDATE lastfm_user SET 
                    (image, age, subscriber, playcount, playlists, bootstrap) = (%L, %L, %L, %L, %L, %L)
                    WHERE name = 'hb-robo'`,
                userInfo.image, userInfo.age, userInfo.subscriber,
                userInfo.playcount, userInfo.playlists, userInfo.bootstrap);
            break;
        case false:
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
            break;
    }
    await pgdb.query(userInsertQuery).catch(console.error);

    
   

}

async function syncMusicData() {
    await Promise.allSettled([
        syncLastFMData(),
    ]);
}

module.exports = {syncMusicData};
