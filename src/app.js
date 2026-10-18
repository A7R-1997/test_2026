
const express = require('express');
const db = require('./db');

const app = express();

app.use(express.json());

// فحص صحة التطبيق واتصال قاعدة البيانات
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.status(200).json({
      status: 'UP',
      database: 'CONNECTED',
    });
  } catch (error) {
    console.error('Health check failed:', error.message);

    res.status(500).json({
      status: 'DOWN',
      error: error.message,
    });
  }
});

// جلب جميع البلاغات
app.get('/api/incidents', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM incidents ORDER BY created_at DESC'
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error('Get incidents failed:', error.message);

    res.status(500).json({
      error: 'Failed to retrieve incidents',
    });
  }
});

// إضافة بلاغ جديد
app.post('/api/incidents', async (req, res) => {
  const { title, description, severity, sector_id } = req.body;

  if (!title || !severity) {
    return res.status(400).json({
      error: 'title and severity are required',
    });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO incidents
        (title, description, severity, sector_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, description, severity, sector_id ?? null]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create incident failed:', error.message);

    res.status(500).json({
      error: 'Failed to create incident',
    });
  }
});

module.exports = app;
