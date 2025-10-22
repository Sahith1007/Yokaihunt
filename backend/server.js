import express from 'express';
import cors from 'cors';
import pokemonRoutes from './routes/pokemonRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', playerRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', pokemonRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
