const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('shopping.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the shopping database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        preferences TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        message TEXT,
        response TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        category TEXT,
        specs TEXT,
        image_url TEXT
    )`);
});

// Ollama API integration
async function queryOllama(prompt) {
    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3.2:latest',
            prompt: prompt,
            stream: false
        });
        return response.data.response;
    } catch (error) {
        console.error('Error querying Ollama:', error);
        return 'Sorry, I encountered an error while processing your request.';
    }
}

// API Endpoints
app.post('/api/chat', async (req, res) => {
    const { message, userId } = req.body;
    
    try {
        // Format the prompt for product recommendations
        const prompt = `As a shopping assistant, please provide a product recommendation for the following request: "${message}". 
                       Format your response as a product recommendation with these details:
                       - Product name
                       - Price
                       - Key features
                       - Why it matches the request
                       Keep the response concise and focused on one best product match.`;

        // Get recommendation from LLaMA
        const aiResponse = await queryOllama(prompt);

        // Store in chat history
        db.run(`INSERT INTO chat_history (user_id, message, response) VALUES (?, ?, ?)`,
            [userId, message, aiResponse],
            (err) => {
                if (err) {
                    console.error(err);
                }
            }
        );

        // Extract budget and preferences for analytics
        const budget = extractBudget(message);
        if (budget) {
            db.run(`UPDATE users SET preferences = json_set(
                COALESCE(preferences, '{}'),
                '$.last_budget',
                ?
            ) WHERE id = ?`, [budget, userId]);
        }

        res.json({ 
            response: aiResponse,
            success: true 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            success: false 
        });
    }
});

// Product Management Endpoints
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/products', (req, res) => {
    const { name, price, category, specs, image_url } = req.body;
    
    db.run(
        'INSERT INTO products (name, price, category, specs, image_url) VALUES (?, ?, ?, ?, ?)',
        [name, price, category, specs, image_url],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({
                id: this.lastID,
                message: 'Product added successfully'
            });
        }
    );
});

app.delete('/api/products/:id', (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM products WHERE id = ?', id, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Product deleted successfully' });
    });
});

function extractBudget(message) {
    const budgetMatch = message.match(/\$(\d+)/);
    return budgetMatch ? parseInt(budgetMatch[1]) : null;
}


const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop the server');
});


process.on('SIGINT', () => {
    console.log('\shutting down...');
    server.close(() => {
        console.log('HTTP server closed');
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed');
            }
            process.exit(0);
        });
    });
});
