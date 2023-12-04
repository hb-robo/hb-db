import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: '',
  host: '',
  database: '',
  password: '',
  port: ,
});

pool.connect()
      .then(() => console.log('Connected to hb-db'))
      .catch((err: Error) => console.error('Connection error', err.stack));

export default pool;