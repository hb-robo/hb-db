// Import necessary modules
import express, { Request, Response } from 'express';
import path from 'path';
import cytoscape from 'cytoscape';
import fs from 'fs';

// Create a new router
const router = express.Router();

router.get('/', (req: Request, res: Response) => {
    res.render('home');
})
router.get('/about', (req: Request, res: Response) => {
    res.render('input/education');
})

// protecting these routes from 404s
router.get('/input', (req: Request, res: Response) => {
    res.redirect('/home');
})
router.get('/output', (req: Request, res: Response) => {
    res.redirect('/home');
})


router.get('/input/education', (req: Request, res: Response) => {
    res.render('input/education');
})
router.get('/input/games', (req: Request, res: Response) => {
    res.render('input/games');
})
router.get('/input/books', (req: Request, res: Response) => {
    res.render('input/books');
})
router.get('/input/music', (req: Request, res: Response) => {
    res.render('input/music');
})
router.get('/input/films', (req: Request, res: Response) => {
    res.render('input/films');
})


router.get('/output/projects', (req: Request, res: Response) => {
    res.render('output/projects');
})
router.get('/output/contributions', (req: Request, res: Response) => {
    res.render('output/contributions');
})
router.get('/output/thoughts', (req: Request, res: Response) => {
    res.render('output/thoughts');
})
router.get('/output/works', (req: Request, res: Response) => {
    res.render('output/works');
})


export default router;