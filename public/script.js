document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const productsContainer = document.getElementById('productsContainer');

    // Configure marked options
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    // API base URL
    const API_BASE_URL = 'http://localhost:3002';

    // Load products on page load
    loadProducts();

    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        if (isUser) {
            messageDiv.textContent = message;
        } else {
            // Render markdown for bot messages
            messageDiv.innerHTML = marked.parse(message);
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function createProductCard(product) {
        return `
            <div class="product-card" data-product-id="${product.id}">
                <h3>${product.name}</h3>
                <p class="price">$${product.price.toFixed(2)}</p>
                <p>${product.category}</p>
                <p><small>${product.specs}</small></p>
            </div>
        `;
    }

    async function loadProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/products`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const products = await response.json();
            
            if (Array.isArray(products) && products.length > 0) {
                productsContainer.innerHTML = products
                    .map(product => createProductCard(product))
                    .join('');
            } else {
                productsContainer.innerHTML = '<p>No products available.</p>';
            }
        } catch (error) {
            console.error('Error loading products:', error);
            productsContainer.innerHTML = '<p>Error loading products. Please try again later.</p>';
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Clear input
        userInput.value = '';

        // Add user message to chat
        addMessage(message, true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Add AI response to chat with markdown rendering
                addMessage(data.response);
                
                // If the response includes product recommendations, highlight them
                if (data.products && data.products.length > 0) {
                    const productElements = document.querySelectorAll('.product-card');
                    productElements.forEach(el => el.classList.remove('highlighted'));
                    
                    data.products.forEach(productId => {
                        const productElement = document.querySelector(`[data-product-id="${productId}"]`);
                        if (productElement) {
                            productElement.classList.add('highlighted');
                            productElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    });
                }
            } else {
                addMessage('Sorry, I encountered an error while processing your request.');
            }
        } catch (error) {
            console.error('Error:', error);
            addMessage('Sorry, there was an error communicating with the server.');
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Add initial greeting with markdown
    addMessage("**Hello!** 👋 I'm your AI shopping assistant. I can help you:\n\n- Find products\n- Compare specifications\n- Get recommendations\n- Answer questions about our items\n\nWhat are you looking for today?");
});
