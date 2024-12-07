document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const productsContainer = document.getElementById('productsContainer');

    // Temporary user ID (in a real app, this would come from authentication)
    const userId = 1;

    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        // Format AI response for better readability
        if (!isUser) {
            const formattedMessage = message.split('\n').map(line => {
                if (line.trim().startsWith('-')) {
                    return `<li>${line.substring(1)}</li>`;
                }
                return `<p>${line}</p>`;
            }).join('');
            messageDiv.innerHTML = formattedMessage;
        } else {
            messageDiv.textContent = message;
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function displayProducts(products) {
        productsContainer.innerHTML = '';
        
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            
            productCard.innerHTML = `
                <img src="${product.image_url}" alt="${product.name}">
                <h3>${product.name}</h3>
                <div class="price">$${product.price}</div>
                <div class="specs">${product.specs}</div>
            `;
            
            productsContainer.appendChild(productCard);
        });
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Clear input
        userInput.value = '';

        // Add user message to chat
        addMessage(message, true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    userId: userId
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // Add AI response to chat
                addMessage(data.response);
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

    // Initial greeting
    addMessage('Hello! I\'m your personal shopping assistant. How can I help you today?');
});
