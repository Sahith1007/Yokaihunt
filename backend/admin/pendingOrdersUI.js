import express from 'express';
import NFTItem from '../models/NFTItem.js';

const router = express.Router();

router.get('/admin/pending', async (_req, res) => {
  const list = await NFTItem.find({ 'pendingOrder.status': 'PENDING' }).lean();
  const html = `<!doctype html><html><head><title>Pending Orders</title><style>body{font-family:system-ui;padding:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}</style></head><body>
  <h1>Pending Orders</h1>
  <table><thead><tr><th>uid</th><th>owner</th><th>amount</th><th>orderId</th><th>created</th></tr></thead>
  <tbody>
  ${list.map(x=>`<tr><td>${x.uid}</td><td>${x.ownerWallet}</td><td>${x.pendingOrder?.amountMicroAlgos}</td><td>${x.pendingOrder?.orderId}</td><td>${new Date(x.pendingOrder?.createdAt||x.createdAt).toLocaleString()}</td></tr>`).join('')}
  </tbody></table>
  </body></html>`;
  res.setHeader('content-type','text/html');
  res.send(html);
});

export default router;
