// Import necessary modules
import express, { Request, Response } from 'express';

// Create a new router
const router = express.Router();

router.get('/', (req: Request, res: Response) => {
    res.send('Hello World!')
})

export default router;