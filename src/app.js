const express = require('express');
const db = require('./db');
const app = express();

app.use(express.json());

// Health Check Endpoint (مهمة لفحص Jenkins)
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

// GET: جلب جميع البلاغات
app.get('/api/incidents', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM incidents ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: إضافة بلاغ جديد
app.post('/api/incidents', async (req, res) => {
  const { title, description, severity, sector_id } = req.body;
  try {
    const { rows } = await db.query(
      'INSERT INTO incidents (title, description, severity, sector_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, severity, sector_id]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;