//==================== Postgres Imports ====================
const pgdb = require('../../pgdb');
const format = require('pg-format');
//==================== API Imports ====================
const axios = require('axios');

const GITHUB_USER = 'hb-robo';
const GITHUB_GETUSER_URL = `https://api.github.com/users/${GITHUB_USER}`;
const GITHUB_GETREPOS_URL = `https://api.github.com/users/${GITHUB_USER}`;
const GITHUB_GETCONTRIBUTIONS_URL = ``;
// need to use GraphQL API, see this article: 
// https://medium.com/@yuichkun/how-to-retrieve-contribution-graph-data-from-the-github-api-dc3a151b4af

const LEETCODE_USER = '';
const LEETCODE_API_URL = `https://leetcode-stats-api.herokuapp.com/${LEETCODE_USER}`


//==================== GitHub API Sync Functions ====================
/**
 * Grabs basic information about my GitHub Profile from the REST API.
 * @returns {undefined}
 */
async function syncGitHubUserInfo() {
    const userInfo = await axios(GITHUB_GETUSER_URL).then( result => {
        console.log(result.data);
        return result.data;
    }).catch(console.error);
    setTimeout(() => {}, 1000);
    
    let userInDB_raw = await pgdb.query(`SELECT 
                     CASE WHEN EXISTS (SELECT * FROM github_user) THEN 1 
                     ELSE 0 END`).catch(console.error);
    let userInDB = userInDB_raw.rows[0].case;
    
    var userInsertQuery;
    if (userInDB) {
        userInsertQuery = format(
            `UPDATE github_user SET 
                (company, blog, location, hireable, bio, public_repos, followers, following) = (%L, %L, %L, %L, %L, %L, %L, %L)
                WHERE name = %L`,
            userInfo.company, userInfo.blog, userInfo.location, userInfo.hireable,
            userInfo.bio, userInfo.public_repos, userInfo.followers, userInfo.following,
            GITHUB_USER);
    } 
    else {
        userInsertQuery = format(
            `INSERT INTO github_user
                (id, login, company, blog, location, hireable, bio, public_repos, followers, following, created_at)
            VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)`,
            userInfo.id, userInfo.login, userInfo.company, userInfo.blog, userInfo.location, userInfo.hireable,
            userInfo.bio, userInfo.public_repos, userInfo.followers, userInfo.following, userInfo.created_at);
    }
    await pgdb.query(userInsertQuery)
        .catch(error => {
            return pgdb.query('ROLLBACK')
            .then(() => {
                throw error;
            });
        });
}


/**
 * Grabs information for each of my GitHub Repos from the REST API.
 * @returns {undefined}
 */
async function syncGitHubRepoData() {}


/**
 * Grabs basic information about my GitHub Profile from the GraphQL API.
 * @returns {undefined}
 */
async function syncGitHubContributions() {}


//==================== Leetcode API Sync Functions ====================


//==================== StackOverflow API Sync Functions ====================


//==================== Async Aggregation Functions ====================
/**
 * Asynchronously updates all data from the GitHub REST API.
 * @returns {undefined}
 */
async function syncGitHubData() {
    await Promise.allSettled([
        syncGitHubUserInfo(),
        syncGitHubRepoData(),
        syncGitHubContributions()
    ]);
}

/**
 * Asynchronously updates all data from the Leetcode GraphQL endpoint via JeremyTsaii's leetcode-stats-api wrapper.
 * @returns {undefined}
 */
async function syncLeetcodeData() {}


/**
 * Asynchronously updates all data from the StackOverflow REST API.
 * @returns {undefined}
 */
async function syncStackOverflowData() {}


/**
 * Asynchronously updates all data from endpoints about programming or code discussions.
 * @returns {undefined}
 */
async function syncCodeData() {
    await Promise.allSettled([
        syncGitHubData(),
        syncLeetcodeData(),
        syncStackOverflowData()
    ]);
}


//==================== Module Exports ====================
module.exports = { syncCodeData };
