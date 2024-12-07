document.addEventListener('DOMContentLoaded', () => {
    const productForm = document.getElementById('productForm');
    const productsList = document.getElementById('productsList');

    // Load existing products
    loadProducts();

    // Handle form submission
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const product = {
            name: document.getElementById('name').value,
            price: parseFloat(document.getElementById('price').value),
            category: document.getElementById('category').value,
            specs: document.getElementById('specs').value,
            image_url: document.getElementById('imageUrl').value
        };

        try {
            const response = await fetch('http://localhost:3000/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(product)
            });

            if (response.ok) {
                alert('Product added successfully!');
                productForm.reset();
                loadProducts();
            } else {
                alert('Error adding product');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error adding product');
        }
    });

    async function loadProducts() {
        try {
            const response = await fetch('http://localhost:3000/api/products');
            const products = await response.json();
            
            productsList.innerHTML = '';
            products.forEach(product => {
                const productElement = createProductElement(product);
                productsList.appendChild(productElement);
            });
        } catch (error) {
            console.error('Error:', error);
            productsList.innerHTML = '<p>Error loading products</p>';
        }
    }

    function createProductElement(product) {
        const div = document.createElement('div');
        div.className = 'product-item';
        
        div.innerHTML = `
            <img src="${product.image_url}" alt="${product.name}">
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>$${product.price}</p>
                <p>${product.category}</p>
            </div>
            <div class="product-actions">
                <button class="delete-btn" onclick="deleteProduct(${product.id})">Delete</button>
            </div>
        `;
        
        return div;
    }
});

// Delete product function
async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/products/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Product deleted successfully!');
            location.reload();
        } else {
            alert('Error deleting product');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting product');
    }
}
