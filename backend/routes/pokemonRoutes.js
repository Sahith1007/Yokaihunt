import express from 'express';
import { spawnPokemon, catchPokemon, getPokemonDetails } from '../controllers/pokemonController.js';

const router = express.Router();

// 1) Random spawn
router.get('/spawn', spawnPokemon);

// 2) Simulate catch
router.post('/catch', catchPokemon);

// 3) Get pokemon by id or name
router.get('/pokemon/:id', getPokemonDetails);

export default router;
