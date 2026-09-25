/**
 * SYA OS — Moteur Caisse, POS & Modules Métiers
 */

let products = [];
let cart = [];
const printer = new SYAPrinterEngine();

// Récupération du module courant depuis l'URL (ex: ?module=pharmacy)
const urlParams = new URLSearchParams(window.location.search);
const currentModule = urlParams.get('module') || 'boutique';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Adapter le titre et les options de l'interface au module
    configureModuleUI(currentModule);

    // 2. Charger les produits spécifiques au module
    loadProducts();

    // Event listeners
    const searchInput = document.getElementById('searchProd');
    if (searchInput) {
        searchInput.addEventListener('input', renderProducts);
    }

    const payBtn = document.getElementById('btnPay');
    if (payBtn) {
        payBtn.addEventListener('click', checkout);
    }
});

/**
 * Adapte dynamiquement l'interface selon le métier sélectionné
 */
function configureModuleUI(moduleKey) {
    const titleElem = document.getElementById('moduleTitle') || document.querySelector('.brand-title');
    
    // Éléments spécifiques optionnels s'ils existent dans ton HTML
    const pharmacyPanel = document.getElementById('pharmacyPanel');
    const microfinancePanel = document.getElementById('microfinancePanel');

    if (pharmacyPanel) pharmacyPanel.style.display = 'none';
    if (microfinancePanel) microfinancePanel.style.display = 'none';

    switch (moduleKey) {
        case 'pharmacy':
            if (titleElem) titleElem.innerText = "💊 SYA OS — Pharmacie & Santé";
            if (pharmacyPanel) pharmacyPanel.style.display = 'block';
            break;

        case 'microfinance':
            if (titleElem) titleElem.innerText = "🏦 SYA OS — Microfinance & Tontine";
            if (microfinancePanel) microfinancePanel.style.display = 'block';
            break;

        case 'restaurant':
            if (titleElem) titleElem.innerText = "🍽️ SYA OS — Restauration & Bar";
            break;

        case 'supermarket':
            if (titleElem) titleElem.innerText = "🛒 SYA OS — Supermarché & Grande Distribution";
            break;

        case 'wholesale':
            if (titleElem) titleElem.innerText = "📦 SYA OS — Gros & Semi-Gros";
            break;

        default:
            if (titleElem) titleElem.innerText = "🛍️ SYA OS — Caisse & Boutique";
            break;
    }
}

/**
 * Charge les données en filtrant par module
 */
async function loadProducts() {
    try {
        // Envoi du paramètre module au backend API
        const res = await fetch(`/api/products?module=${encodeURIComponent(currentModule)}`);
        
        if (!res.ok) {
            // Fallback si l'API ne filtre pas encore
            const fallbackRes = await fetch('/api/products');
            products = await fallbackRes.json();
        } else {
            products = await res.json();
        }

        renderProducts();
    } catch (err) {
        console.error("Erreur de chargement des produits", err);
    }
}

/**
 * Affiche la grille des produits / services
 */
function renderProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    const searchInput = document.getElementById('searchProd');
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    const filtered = products.filter(p => p.name.toLowerCase().includes(search));

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px;">Aucun article disponible pour le module : <strong>${currentModule}</strong></div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        // Affichage des infos médicales si pharmacie
        const extraInfo = (currentModule === 'pharmacy' && p.expiry_date) 
            ? `<br><small style="color: #f59e0b; font-size: 10px;">Exp: ${p.expiry_date}</small>` 
            : '';

        return `
            <div class="product-card" onclick="addToCart('${p.id}')">
                <strong>${p.name}</strong>
                <span>${Number(p.retail_price).toLocaleString()} FCFA</span>
                ${extraInfo}
            </div>
        `;
    }).join('');
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

    if (!tbody || !totalEl) return;

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

/**
 * Validation de la vente + option d'envoi WhatsApp
 */
async function checkout() {
    if (cart.length === 0) {
        alert('Le panier est vide !');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const paymentMethodEl = document.getElementById('paymentMethod');
    const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'Espèces';

    // Récupération optionnelle du téléphone client pour WhatsApp
    const customerPhoneEl = document.getElementById('customerPhone');
    const customerPhone = customerPhoneEl ? customerPhoneEl.value.trim() : '';

    const payload = {
        module: currentModule,
        items: cart,
        total: total,
        payment_method: paymentMethod,
        customer_phone: customerPhone
    };

    try {
        const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            // 1. Impression Ticket / Facture avec Filigrane & Logo
            printer.print(data.sale);

            // 2. Proposer ou exécuter l'envoi du ticket via WhatsApp si le téléphone est fourni
            if (customerPhone) {
                sendWhatsAppReceipt(customerPhone, data.sale || { id: Date.now(), total: total });
            }

            // 3. Réinitialisation
            cart = [];
            renderCart();
            if (customerPhoneEl) customerPhoneEl.value = '';
        } else {
            alert('Erreur lors de l\'enregistrement de la vente.');
        }
    } catch (err) {
        console.error(err);
        alert('Erreur réseau lors de la validation.');
    }
}

/**
 * Envoi automatique ou manuel du reçu via WhatsApp
 */
function sendWhatsAppReceipt(phone, saleData) {
    const formattedPhone = phone.replace(/[^0-9+]/g, '');
    const cleanPhone = formattedPhone.startsWith('+') ? formattedPhone.substring(1) : formattedPhone;

    let itemsList = cart.map(i => `- ${i.name} x${i.qty} : ${(i.qty * i.price).toLocaleString()} FCFA`).join('%0A');
    
    const message = `*TICKET DE CAISSE SYA OS*%0A` +
                    `Réf: #${saleData.id}%0A` +
                    `--------------------------------%0A` +
                    `${itemsList}%0A` +
                    `--------------------------------%0A` +
                    `*TOTAL: ${saleData.total.toLocaleString()} FCFA*%0A%0A` +
                    `Merci pour votre achat !`;

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`;
    window.open(waUrl, '_blank');
}