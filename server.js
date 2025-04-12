const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Import database based on environment
let db;
if (process.env.DATABASE_URL) {
    // Postgres setup for production
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    // Create scores table
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
        all: (query, params, callback) => {
            pool.query(query.replace('?', '$1'), params)
                .then(res => callback(null, res.rows))
                .catch(err => callback(err));
        },
        run: (query, params, callback) => {
            pool.query(query.replace(/\?/g, (_, i) => `$${i+1}`), params)
                .then(res => callback.call({lastID: res.rows[0]?.id}))
                .catch(err => callback(err));
        }
    };
} else {
    // SQLite for development
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(':memory:', (err) => {
        if (err) {
            console.error('Error opening database:', err);
        } else {
            console.log('Connected to in-memory SQLite database');
            db.run(`
                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nickname TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    stage INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
    });
}

// Port configuration - important for Heroku
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/scores', (req, res) => {
    db.all(
        'SELECT * FROM scores ORDER BY score DESC LIMIT 10',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching scores:', err);
                res.status(500).json({ error: 'Failed to fetch scores' });
                return;
            }
            res.json(rows || []);
        }
    );
});

app.post('/api/scores', (req, res) => {
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

    db.run(
        'INSERT INTO scores (nickname, score, stage) VALUES (?, ?, ?)',
        [nickname.trim(), score, stage],
        function(err) {
            if (err) {
                console.error('Error saving score:', err);
                res.status(500).json({ error: 'Failed to save score' });
                return;
            }
            res.status(201).json({
                id: this.lastID,
                nickname,
                score,
                stage
            });
        }
    );
});

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server - CRITICAL FOR HEROKU
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGTERM', () => {
    db.close(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    db.close(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
}); 