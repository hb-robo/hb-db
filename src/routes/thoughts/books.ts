// Import necessary modules
import express, { Request, Response } from 'express';

// Create a new router
const router = express.Router();

// Define a GET route
router.get('/books', (req: Request, res: Response) => {
    // Handle GET request
    res.send('GET request to the /thoughts/books page');
});

// Export the router
export default router;
