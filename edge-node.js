const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_KEY = process.env.NODE_KEY || 'default-key';

app.use(express.json());
const memoryVault = new Map();

app.post('/store', (req, res) => {
  const { shardId, shardValue, nodeKey } = req.body;
  if (nodeKey !== NODE_KEY) return res.status(403).json({ error: 'Unauthorized' });
  memoryVault.set(shardId, shardValue);
  console.log(`✓ Stored shard: ${shardId} = ${shardValue}`);
  res.json({ success: true, message: 'Shard stored' });
});

app.post('/retrieve', (req, res) => {
  const { shardId, nodeKey } = req.body;
  if (nodeKey !== NODE_KEY) return res.status(403).json({ error: 'Unauthorized' });
  const shard = memoryVault.get(shardId);
  if (!shard) return res.status(404).json({ error: 'Shard not found' });
  console.log(`✓ Retrieved shard: ${shardId}`);
  res.json({ success: true, shard });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: PORT, shards: memoryVault.size });
});

app.listen(PORT, () => console.log(`🔒 Edge Node running on port ${PORT}`));