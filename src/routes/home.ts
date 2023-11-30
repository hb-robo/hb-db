// Import necessary modules
import express, { Request, Response } from 'express';
import path from 'path';
import cytoscape from 'cytoscape';
import fs from 'fs';

// Create a new router
const router = express.Router();

router.get('/', (req: Request, res: Response) => {

    fs.readFile(
        path.join(__dirname, '../../public/json/homeGraph.json'), 'utf8', 
        (err, data) => {
            if (err) {
                console.error(err);
                return res.sendStatus(500);
            }
            const homeGraph = JSON.parse(data);
            res.render('index', { homeGraph });
        }
    );   

})

export default router;