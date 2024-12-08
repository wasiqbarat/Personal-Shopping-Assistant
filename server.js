const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3002;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));

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

    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            specs TEXT
        )
    `);
});


function extractPriceRange(query) {
    const underMatch = query.match(/under\s*\$?(\d+)/i);
    const overMatch = query.match(/over\s*\$?(\d+)/i);
    const betweenMatch = query.match(/between\s*\$?(\d+)\s*and\s*\$?(\d+)/i);
    
    if (betweenMatch) {
        return { min: parseInt(betweenMatch[1]), max: parseInt(betweenMatch[2]) };
    } else if (underMatch) {
        return { max: parseInt(underMatch[1]) };
    } else if (overMatch) {
        return { min: parseInt(overMatch[1]) };
    }
    return null;
}

// Enhanced search function
async function searchProducts(query) {
    return new Promise((resolve, reject) => {
        const searchTerms = query.toLowerCase().split(' ')
            .filter(term => !['a', 'an', 'the', 'with', 'for', 'in', 'on', 'at', 'to'].includes(term));
        
        // Extract price range 
        const priceRange = extractPriceRange(query);
        
        // Build search conditions
        const searchConditions = [];
        const params = [];
        
        // Add text search conditions
        searchTerms.forEach(term => {
            searchConditions.push(`(
                LOWER(name) LIKE ? OR 
                LOWER(category) LIKE ? OR 
                LOWER(specs) LIKE ?
            )`);
            params.push(`%${term}%`, `%${term}%`, `%${term}%`);
        });
        
        // Add price range conditions
        if (priceRange) {
            if (priceRange.min) {
                searchConditions.push('price >= ?');
                params.push(priceRange.min);
            }
            if (priceRange.max) {
                searchConditions.push('price <= ?');
                params.push(priceRange.max);
            }
        } 
        
        const sql = `
            SELECT DISTINCT * FROM products 
            WHERE ${searchConditions.join(' OR ')}
            ORDER BY 
                CASE 
                    WHEN LOWER(name) LIKE ? THEN 1
                    WHEN LOWER(category) LIKE ? THEN 2
                    ELSE 3
                END,
                price ASC
        `;
        
        // Add sorting parameters
        params.push(`%${searchTerms[0]}%`, `%${searchTerms[0]}%`);
        
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Search error:', err);
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}


async function queryOllama(prompt) {
    try {
        const relevantProducts = await searchProducts(prompt);
        
        // Create context string with categories summary
        let databaseContext = '';
        if (relevantProducts.length > 0) {
            // Group products by category
            const categorySummary = relevantProducts.reduce((acc, product) => {
                acc[product.category] = acc[product.category] || [];
                acc[product.category].push(product);
                return acc;
            }, {});
            
            // Create context with category organization
            databaseContext = 'Available products in our database:\n\n';
            
            Object.entries(categorySummary).forEach(([category, products]) => {
                databaseContext += `${category}:\n`;
                products.forEach(product => {
                    databaseContext += `- ${product.name}\n`;
                    databaseContext += `  Price: $${product.price}\n`;
                    databaseContext += `  Specifications: ${product.specs}\n\n`;
                });
            });
            
            // Add price range information if available
            const priceRange = extractPriceRange(prompt);
            if (priceRange) {
                databaseContext += '\nPrice Range Requested:';
                if (priceRange.min) databaseContext += ` Over $${priceRange.min}`;
                if (priceRange.max) databaseContext += ` Under $${priceRange.max}`;
                databaseContext += '\n';
            }
        }

        
        const enhancedPrompt = `
        You are a knowledgeable shopping assistant. Below is information from our product database, followed by a customer request.
        
        --- Product Database Information ---
        ${databaseContext || 'No products found matching the search criteria.'}
        
        --- Customer Request ---
        "${prompt}"
        
        Please provide a not very long product recommendation based on the following rules:
        1. Only recommend products that are actually in our Customer Request that I provided.
        2. If multiple products match, recommend the best one and briefly mention alternatives
        3. If no products match exactly, suggest the closest alternative
        4. If nothing relevant is available, politely say so
        
        Format your response with:
        - Product name and price
        - Key specifications
        - Why this product best matches the request
        - Alternative options (if any)
        
        Keep your response professional but conversational.
        `;

        // Query Ollama
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3.2:latest',
            prompt: enhancedPrompt,
            stream: false
        });

        /* 
        // ================ OpenAI ChatGPT Implementation ================
        // First, install the OpenAI package:
        // npm install openai

        // 1. Import OpenAI at the top of your file
        // const OpenAI = require('openai');

        // 2. Initialize OpenAI client with your API key
        // const openai = new OpenAI({
        //     apiKey: 'your-api-key-here', // Store this in environment variables
        // });

        // 3. Query OpenAI ChatGPT
        // const response = await openai.chat.completions.create({
        //     model: "gpt-3.5-turbo", // or "gpt-4" for more advanced capabilities
        //     messages: [
        //         {
        //             role: "system",
        //             content: "You are a knowledgeable shopping assistant."
        //         },
        //         {
        //             role: "user",
        //             content: enhancedPrompt
        //         }
        //     ],
        //     temperature: 0.7,
        //     max_tokens: 500
        // });

        // 4. Extract the response
        // return response.choices[0].message.content;
        */

        return response.data.response;
    } catch (error) {
        console.error('Error querying Ollama:', error);
        return 'Sorry, I encountered an error while processing your request.';
    }
}


app.post('/api/chat', async (req, res) => {
    const { message, userId } = req.body;
    
    try {
        // Get recommendation from LLaMA with database context
        const aiResponse = await queryOllama(message);

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
        const budget = extractPriceRange(message);
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
    console.log('GET /api/products called');
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('Products fetched:', rows);
        res.json(rows);
    });
});

app.post('/api/products', (req, res) => {
    console.log('POST /api/products called with body:', req.body);
    const { name, price, category, specs } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }
    
    db.run(
        'INSERT INTO products (name, price, category, specs) VALUES (?, ?, ?, ?)',
        [name, price, category, specs],
        function(err) {
            if (err) {
                console.error('Error adding product:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('Product added with ID:', this.lastID);
            res.json({
                id: this.lastID,
                message: 'Product added successfully'
            });
        }
    );
});

app.delete('/api/products/:id', (req, res) => {
    console.log('DELETE /api/products/:id called with id:', req.params.id);
    const id = req.params.id;
    
    if (!id) {
        return res.status(400).json({ error: 'Product ID is required' });
    }
    
    db.run('DELETE FROM products WHERE id = ?', id, function(err) {
        if (err) {
            console.error('Error deleting product:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('Product deleted, rows affected:', this.changes);
        res.json({ 
            message: 'Product deleted successfully',
            changes: this.changes
        });
    });
});

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
