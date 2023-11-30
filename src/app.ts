// import modules
import express from 'express';
import sqlite3 from 'sqlite3';

// import routes
import homeRouter from './routes/home';
import booksRouter from './routes/thoughts/books';
import gamesRouter from './routes/thoughts/games';
import musicRouter from './routes/thoughts/music';

// initializing app
const app = express();
const PORT = process.env.PORT || 3000;

// set up middleware

// set up routes
app.use(homeRouter);
app.use('/thoughts', booksRouter);
app.use('/thoughts', gamesRouter); 
app.use('/thoughts', musicRouter); 

// Server Setup
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
}).on('error', (error) => {
    console.log(`Error occurred, server can't start`, error);
});

// SQLITE3 NONSENSE
const sqlite = sqlite3.verbose();
const db = new sqlite.Database('./data/pokemon.db', sqlite3.OPEN_READWRITE,(err)=>{
    if (err) return console.error(err.message);
});
let sql : string = 'CREATE TABLE ';