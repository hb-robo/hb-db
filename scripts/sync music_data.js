
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
async function syncLastFMData() {}

async function syncMusicData() {
    await Promise.allSettled([
        syncLastFMData(),
    ]);
}

module.exports = {syncMusicData};
