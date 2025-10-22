import express from 'express';
import { addToInventory, listInventory, deleteFromInventory, countInventory } from '../controllers/inventoryController.js';

const router = express.Router();

router.post('/inventory/add', addToInventory);
router.get('/inventory/:playerId', listInventory);
router.delete('/inventory/:playerId/:pokemonId', deleteFromInventory);
router.get('/inventory/count/:playerId', countInventory);

export default router;
