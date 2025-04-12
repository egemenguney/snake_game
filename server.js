const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Port configuration
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database configuration
let db;
if (process.env.DATABASE_URL) {
    // PostgreSQL for production (Heroku)
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    // Initialize database
    pool.query(`
        CREATE TABLE IF NOT EXISTS scores (
            id SERIAL PRIMARY KEY,
            nickname TEXT NOT NULL,
            score INTEGER NOT NULL,
            stage INTEGER NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(err => console.error('Error creating table:', err));
    
    db = {
        all: async (query, params) => {
            const result = await pool.query(
                query.replace(/\?/g, (_, i) => `$${i + 1}`),
                params
            );
            return result.rows;
        },
        run: async (query, params) => {
            const result = await pool.query(
                query.replace(/\?/g, (_, i) => `$${i + 1}`),
                params
            );
            return result;
        }
    };
} else {
    console.log('No DATABASE_URL found, running without database');
    // Mock DB for development
    db = {
        all: async () => [],
        run: async () => ({})
    };
}

// API Routes
app.get('/api/scores', async (req, res) => {
    try {
        const rows = await db.all(
            'SELECT * FROM scores ORDER BY score DESC LIMIT 10',
            []
        );
        res.json(rows || []);
    } catch (err) {
        console.error('Error fetching scores:', err);
        res.status(500).json({ error: 'Failed to fetch scores' });
    }
});

app.post('/api/scores', async (req, res) => {
    const { nickname, score, stage } = req.body;

    // Validate input
    if (!nickname || typeof nickname !== 'string') {
        return res.status(400).json({ error: 'Invalid nickname' });
    }
    
    if (!Number.isInteger(score) || score < 0) {
        return res.status(400).json({ error: 'Invalid score' });
    }
    
    if (!Number.isInteger(stage) || stage < 1) {
        return res.status(400).json({ error: 'Invalid stage' });
    }

    try {
        await db.run(
            'INSERT INTO scores (nickname, score, stage) VALUES (?, ?, ?)',
            [nickname.trim(), score, stage]
        );
        res.status(201).json({
            nickname,
            score,
            stage
        });
    } catch (err) {
        console.error('Error saving score:', err);
        res.status(500).json({ error: 'Failed to save score' });
    }
});

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}); 