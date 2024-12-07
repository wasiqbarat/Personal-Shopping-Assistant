const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// Connect to database
const db = new sqlite3.Database('shopping.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        return;
    }
    console.log('Connected to shopping database.');
});

// Test data to insert
const testProducts = [
    {
        name: 'MacBook Pro M2',
        price: 1299.99,
        category: 'Laptops',
        specs: 'Apple M2 chip, 8GB RAM, 256GB SSD, 13-inch Retina display',
        image_url: 'macbook-pro.jpg'
    },
    {
        name: 'Dell XPS 15',
        price: 1599.99,
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM, 512GB SSD, NVIDIA RTX 3050',
        image_url: 'dell-xps.jpg'
    },
    {
        name: 'iPhone 15 Pro',
        price: 999.99,
        category: 'Smartphones',
        specs: 'A17 Pro chip, 256GB storage, Triple camera system',
        image_url: 'iphone-15.jpg'
    }
];

// Function to insert test data
async function insertTestData() {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT INTO products (name, price, category, specs, image_url) VALUES (?, ?, ?, ?, ?)`);
        
        testProducts.forEach(product => {
            stmt.run([product.name, product.price, product.category, product.specs, product.image_url], (err) => {
                if (err) console.error('Error inserting product:', err.message);
            });
        });
        
        stmt.finalize(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Function to search products (same as in server.js)
function searchProducts(query) {
    return new Promise((resolve, reject) => {
        const searchTerms = query.toLowerCase().split(' ');
        const searchConditions = searchTerms.map(() => 
            `(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(specs) LIKE ?)`
        ).join(' OR ');
        
        const params = searchTerms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]);
        
        const sql = `
            SELECT * FROM products 
            WHERE ${searchConditions}
        `;
        
        console.log('Executing SQL:', sql);
        console.log('With parameters:', params);
        
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            console.log('Found products:', rows);
            resolve(rows);
        });
    });
}

// Function to test Ollama integration
async function testOllama(prompt) {
    try {
        // Search for relevant products
        const searchTerms = prompt.toLowerCase().split(' ');
        const relevantProducts = await searchProducts(searchTerms.join(' '));

        // Create context string
        let databaseContext = '';
        if (relevantProducts.length > 0) {
            databaseContext = 'Based on our product database:\n' +
                relevantProducts.map(product => 
                    `- ${product.name} (${product.category}): $${product.price}\n  Specifications: ${product.specs}`
                ).join('\n');
        }

        // Create prompt
        const enhancedPrompt = `
        You are a shopping assistant. Below is information from our product database, followed by a customer request.
        
        --- Product Data ---
        ${databaseContext}
        
        --- Customer Request ---
        ${prompt}
        
        Based on the product information provided, recommend the most relevant product to the customer. Your response should include:
        - Product name
        - Price
        - Key features
        - Why it matches the request

        Important note:
        - If there is a no product in the product data, then your response should be only:
        "We are sorry, we do not have any products that match your request."
        `;

        console.log('\nSending prompt to Ollama:', enhancedPrompt);

        // Query Ollama
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3.2:latest',
            prompt: enhancedPrompt,
            stream: false
        });

        return response.data.response;
    } catch (error) {
        console.error('Error:', error.message);
        return 'Error testing Ollama integration';
    }
}

// Run tests
async function runTests() {
    try {
        console.log('Starting Ollama integration tests...\n');

        // Insert test data
        console.log('Inserting test products...');
        await insertTestData();
        console.log('Test products inserted successfully.\n');

        // Test cases
        const testCases = [
            'I need a powerful laptop for video editing',
            'What smartphones do you have?',
            'Show me Apple products under $2000',
            'I need a gaming laptop with good graphics'
        ];

        // Run each test case
        for (const testCase of testCases) {
            console.log(`\n=== Testing prompt: "${testCase}" ===\n`);
            const response = await testOllama(testCase);
            console.log('Ollama Response:', response);
            console.log('\n' + '='.repeat(50));
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Clean up
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('\nDatabase connection closed.');
            }
        });
    }
}

// Run the tests
runTests();
