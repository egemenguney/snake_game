const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();

// Port configuration
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create SQLite database connection
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to in-memory SQLite database');
        // Create scores table if it doesn't exist
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
            res.json(rows);
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

// Start server with specific host and port
app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
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