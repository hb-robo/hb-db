// Import necessary modules
import express, { Request, Response } from 'express';
import path from 'path';

// Create a new router
const router = express.Router();

router.get('/thoughts', (req: Request, res: Response) => {
    res.render('index');
});
router.get('/thoughts/on_games', (req: Request, res: Response) => {
    res.render('index');
});
router.get('/thoughts/on_music', (req: Request, res: Response) => {
    res.render('index');
});
router.get('/thoughts/on_books', (req: Request, res: Response) => {
    res.render('index');
});
router.get('/thoughts/on_film', (req: Request, res: Response) => {
    res.render('index');
});
router.get('/thoughts/other', (req: Request, res: Response) => {
    res.render('index');
});

export default router;