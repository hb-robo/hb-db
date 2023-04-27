// Requiring module
const express = require('express');
 
const app = express();
const PORT = process.env.PORT || 3000;

// Server Setup
app.listen(PORT,(error) => {
    if(!error) {
        console.log(`Server started on port ${PORT}`);
    }
    else {
        console.log(`Error occurred, server can't start`, error);
    }
});