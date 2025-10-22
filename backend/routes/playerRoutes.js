import express from 'express';
import { registerPlayer } from '../controllers/playerController.js';

const router = express.Router();

router.post('/player/register', registerPlayer);

export default router;
