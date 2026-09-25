/**
 * SYA OS — Moteur Caisse & POS
 */

let products = [];
let cart = [];
const printer = new SYAPrinterEngine();

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();

    document.getElementById('searchProd').addEventListener('input', renderProducts);
    document.getElementById('btnPay').addEventListener('click', checkout);
});

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        products = await res.json();
        renderProducts();
    } catch (err) {
        console.error("Erreur de chargement des produits", err);
    }
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    const search = document.getElementById('searchProd').value.toLowerCase();

    const filtered = products.filter(p => p.name.toLowerCase().includes(search));

    grid.innerHTML = filtered.map(p => `
        <div class="product-card" onclick="addToCart('${p.id}')">
            <strong>${p.name}</strong>
            <span>${p.retail_price.toLocaleString()} FCFA</span>
        </div>
    `).join('');
}

function addToCart(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({
            id: prod.id,
            name: prod.name,
            price: prod.retail_price,
            qty: 1
        });
    }

    renderCart();
}

function renderCart() {
    const tbody = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');

    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 20px 0;">Panier vide</td></tr>';
        totalEl.innerText = '0';
        return;
    }

    let total = 0;
    tbody.innerHTML = cart.map(item => {
        const itemTotal = item.qty * item.price;
        total += itemTotal;
        return `
            <tr>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.qty}</td>
                <td style="text-align: right;">${itemTotal.toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    totalEl.innerText = total.toLocaleString();
}

async function checkout() {
    if (cart.length === 0) {
        alert('Le panier est vide !');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const paymentMethod = document.getElementById('paymentMethod').value;

    const payload = {
        items: cart,
        total: total,
        payment_method: paymentMethod
    };

    try {
        const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            // Lancement de l'impression universelle
            printer.print(data.sale);

            // Réinitialisation du panier
            cart = [];
            renderCart();
        } else {
            alert('Erreur lors de l\'enregistrement de la vente.');
        }
    } catch (err) {
        console.error(err);
        alert('Erreur réseau lors de la validation.');
    }
}