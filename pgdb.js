const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'containers-us-west-139.railway.app',
  database: 'railway',
  password: 'huykohQoskThIKwlZ97I',
  port: 6371,
});

client.connect()
      .then(() => console.log('Connected to hb-db'))
      .catch((err) => console.error('Connection error', err.stack));

module.exports = client;