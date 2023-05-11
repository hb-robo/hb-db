//==================== Postgres Imports ====================
const pgdb = require('./../pgdb');
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



//==================== Async Aggregation Functions ====================
/**
 * Asynchronously updates all data from the GitHub REST API.
 * @returns {undefined}
 */
async function syncGitHubData() {}

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
