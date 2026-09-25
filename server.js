const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// BASE DE DONNÉES EN MÉMOIRE (ARCHITECTURE D'ENTREPRISE SUPERMARCHÉ)
// ============================================================================

// Configuration Paramètres Globaux
let storeConfig = {
    store_name: "GRAND MARCHÉ SYA",
    nui: "M08120004512A",
    rc: "RC/DLA/2024/B/1200",
    address: "Avenue Centrale, Yaoundé",
    tva_rate: 0.1925, // 19.25%
    admin_whatsapp: "+237600000000"
};

// Multi-Dépôts / Emplacements
let warehouses = [
    { id: 'wh_main', name: 'Réserve Centrale' },
    { id: 'wh_shelf', name: 'Rayons Vente' },
    { id: 'wh_loss', name: 'Stock Avaries & Casse' }
];

// Configuration des Points de Vente (POS)
let posConfigs = [
    { id: 'pos_1', name: 'Caisse Principale 01', type: 'STANDARD', printer: 'EPSON-TM88', activeSessionId: 'sess_1001', status: 'OPEN' },
    { id: 'pos_2', name: 'Caisse Rayon Frais 02', type: 'STANDARD', printer: 'EPSON-TM88', activeSessionId: null, status: 'CLOSED' },
    { id: 'pos_self', name: 'Borne Libre-Service 01', type: 'SELF_CHECKOUT', printer: 'KIOSK-PRINTER', activeSessionId: 'sess_self', status: 'OPEN' }
];

// Sessions Caisse
let posSessions = [
    { id: 'sess_1001', pos_id: 'pos_1', cashier: 'Paul', opening_balance: 50000, total_sales: 0, status: 'OPEN', opened_at: new Date().toISOString() }
];

// Catalogue Produits Avancé (DLC, Codes-barres, Tarifs dégressifs)
let products = [
    { 
        id: 'p1', ean: '376001234501', name: 'Riz Parfumé 50kg', category: 'Alimentation', 
        cost_price: 22000, retail_price: 25000, stock_wh_main: 50, stock_wh_shelf: 12, 
        min_stock: 10, dlc: '2026-12-31', daily_avg_sales: 4, is_anti_gaspi: false 
    },
    { 
        id: 'p2', ean: '376001234502', name: 'Lait Frais Écrémé 1L', category: 'Produits Frais', 
        cost_price: 900, retail_price: 1200, stock_wh_main: 20, stock_wh_shelf: 6, 
        min_stock: 15, dlc: '2026-09-28', daily_avg_sales: 5, is_anti_gaspi: false // DLC Proche !
    },
    { 
        id: 'p3', ean: '200001234000', name: 'Viande Hachée (au poids)', category: 'Boucherie', 
        cost_price: 3200, retail_price: 4500, stock_wh_main: 0, stock_wh_shelf: 18.5, 
        min_stock: 5, dlc: '2026-09-26', daily_avg_sales: 8, is_anti_gaspi: false 
    }
];

// Clients B2B & Comptes Crédit
let b2bClients = [
    { id: 'cli_1', name: 'Hôtel La Résidence', credit_limit: 1000000, current_balance: 350000, status: 'APPROVED' }
];

// Journaux Comptables & Ventes
let sales = [];
let accountingLedger = [];
let avariesLog = [];

// ============================================================================
// MOTEURS DE INTELLIGENCE SYA OS (IA, WHATSAPP & AUTOMATISATION)
// ============================================================================

// 1. Moteur Notification WhatsApp Simulée
function sendWhatsAppNotification(to, message) {
    console.log(`\n================================================`);
    console.log(`💬 [WHATSAPP OUTBOUND -> ${to}]`);
    console.log(message);
    console.log(`================================================\n`);
}

// 2. IA Anti-Gaspillage Proactive (Exécution Quotidienne/Événementielle)
function runAntiGaspiEngine() {
    const today = new Date();
    products.forEach(p => {
        const dlcDate = new Date(p.dlc);
        const diffDays = Math.ceil((dlcDate - today) / (1000 * 60 * 60 * 24));

        // Si DLC < 3 jours et non encore remisé
        if (diffDays <= 3 && diffDays >= 0 && !p.is_anti_gaspi) {
            p.is_anti_gaspi = true;
            p.old_price = p.retail_price;
            p.retail_price = Math.round(p.retail_price * 0.6); // 40% de remise automatique
            
            sendWhatsAppNotification(storeConfig.admin_whatsapp, 
                `♻️ *ACTION IA ANTI-GASPI*\nProduct: *${p.name}*\nDLC Proche (${diffDays}j restant).\nNouveau prix appliqué sur POS : *${p.retail_price} FCFA* (au lieu de ${p.old_price} FCFA).`
            );
        }
    });
}

// ============================================================================
// ROUTES API REST — MÉTIER SUPERMARCHÉ & COMPTABILITÉ
// ============================================================================

// --- CONFIGURATION FACTURATION ---
app.get('/api/config', (req, res) => res.json(storeConfig));
app.post('/api/config', (req, res) => {
    storeConfig = { ...storeConfig, ...req.body };
    res.json({ message: "Configuration mise à jour", config: storeConfig });
});

// --- CATALOGUE & ÉTIQUETAGE DYNAMIQUE ---
app.get('/api/products', (req, res) => {
    runAntiGaspiEngine(); // Contrôle à chaque appel catalogue
    res.json(products);
});

// Génération de Code-Barres / Étiquette
app.get('/api/products/barcode/:id', (req, res) => {
    const p = products.find(prod => prod.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Produit non trouvé" });

    res.json({
        label_data: {
            ean: p.ean,
            name: p.name,
            price: `${p.retail_price} FCFA`,
            unit: p.category === 'Boucherie' ? 'KG' : 'UNIT',
            qr_code: `SYA-PROD-${p.ean}-${p.retail_price}`
        }
    });
});

// --- GESTION DES AVARIES & CASSE ---
app.post('/api/inventory/avarie', (req, res) => {
    const { product_id, qty, reason, cashier } = req.body;
    let p = products.find(prod => prod.id === product_id);

    if (!p || p.stock_wh_shelf < qty) {
        return res.status(400).json({ error: "Stock en rayon insuffisant ou produit invalide" });
    }

    // Déstockage du rayon vers dépôt Avaries
    p.stock_wh_shelf -= qty;
    
    const lossValue = p.cost_price * qty;
    const avarieEntry = { id: 'avr_' + Date.now(), product_id, qty, lossValue, reason, date: new Date().toISOString() };
    avariesLog.push(avarieEntry);

    // Écriture Comptable OHADA (Perte/Casse)
    accountingLedger.push({
        id: 'ecr_avr_' + Date.now(),
        date: new Date().toISOString(),
        ref: 'AVARIE-' + avarieEntry.id,
        libelle: `Avarie/Casse: ${p.name} (${reason})`,
        debit_account: '658000 (Charges diverses / Pertes sur stocks)',
        credit_account: '311100 (Stock de marchandises)',
        amount: lossValue
    });

    sendWhatsAppNotification(storeConfig.admin_whatsapp, `🚨 *ALERTE AVARIE/CASSE*\nProduit: ${p.name}\nQté: ${qty}\nPerte : ${lossValue.toLocaleString()} FCFA\nMotif: ${reason}`);

    res.json({ message: "Avarie enregistrée et comptabilisée", avarieEntry });
});

// --- ACHAT & ENCAISSEMENT POS (STANDARD & BORNE SELF-CHECKOUT) ---
app.post('/api/pos/checkout', (req, res) => {
    const { pos_id, session_id, items, payment_method, client_type, b2b_client_id } = req.body;

    let totalAmount = 0;
    let totalCost = 0;

    items.forEach(item => {
        let p = products.find(prod => prod.id === item.id);
        if (p) {
            p.stock_wh_shelf -= item.qty;
            totalAmount += p.retail_price * item.qty;
            totalCost += p.cost_price * item.qty;
        }
    });

    const taxAmount = Math.round(totalAmount * storeConfig.tva_rate);
    const orderRef = 'TKT-' + Math.floor(100000 + Math.random() * 900000);

    // Écritures comptables OHADA intégrées
    const now = new Date().toISOString();
    let accountDebit = '571100 (Caisse)';
    if (payment_method === 'MOBILE_MONEY') accountDebit = '521100 (Banque / Orange / MTN MoMo)';
    if (client_type === 'B2B') accountDebit = '411100 (Clients B2B - Compte de créance)';

    // 1. Enregistrement Vente + TVA
    accountingLedger.push({
        id: 'ecr_' + Date.now() + '_1', date: now, ref: orderRef,
        libelle: `Vente ${pos_id} - Ticket ${orderRef}`,
        debit_account: accountDebit,
        credit_account: '701100 (Vente de marchandises)',
        amount: totalAmount - taxAmount
    });
    accountingLedger.push({
        id: 'ecr_' + Date.now() + '_2', date: now, ref: orderRef,
        libelle: `TVA Collectée - Ticket ${orderRef}`,
        debit_account: accountDebit,
        credit_account: '443100 (TVA Facturée sur ventes)',
        amount: taxAmount
    });

    // 2. Variation de stock
    accountingLedger.push({
        id: 'ecr_' + Date.now() + '_3', date: now, ref: orderRef,
        libelle: `Sortie de Stock - Ticket ${orderRef}`,
        debit_account: '603100 (Variation des stocks)',
        credit_account: '311100 (Stock de marchandises)',
        amount: totalCost
    });

    const saleRecord = { id: orderRef, pos_id, totalAmount, taxAmount, payment_method, date: now };
    sales.unshift(saleRecord);

    res.status(201).json({
        receipt: {
            store: storeConfig.store_name,
            nui: storeConfig.nui,
            rc: storeConfig.rc,
            ticket_no: orderRef,
            total_ht: totalAmount - taxAmount,
            tva: taxAmount,
            total_ttc: totalAmount,
            qr_validation: `https://sya-os.com/verify?tkt=${orderRef}&amt=${totalAmount}`
        }
    });
});

// --- RAPPROCHEMENT BANCAIRE AUTOMATIQUE & MOMO ---
app.post('/api/accounting/reconcile', (req, res) => {
    const { statement_records } = req.body; // Liste des transactions Orange/MTN/Banque reçues
    let reconciledCount = 0;

    statement_records.forEach(stmt => {
        let match = sales.find(s => s.payment_method === 'MOBILE_MONEY' && s.totalAmount === stmt.amount && !s.reconciled);
        if (match) {
            match.reconciled = true;
            match.reconciled_ref = stmt.trx_id;
            reconciledCount++;
        }
    });

    res.json({ message: "Rapprochement automatique effectué", reconciled_count: reconciledCount });
});

// --- WEBHOOK INTERACTIF WHATSAPP ADMIN ---
app.post('/api/whatsapp/webhook', (req, res) => {
    const { sender, message_text } = req.body;
    const query = message_text.toLowerCase().trim();

    let reply = "Désolé, commande non reconnue. Essayez 'bilan', 'stock' ou 'alertes'.";

    if (query.includes('bilan')) {
        const totalSalesToday = sales.reduce((sum, s) => sum + s.totalAmount, 0);
        reply = `📊 *BILAN EN TEMPS RÉEL (${new Date().toLocaleDateString()})*\n` +
                `- Chiffre d'Affaires : *${totalSalesToday.toLocaleString()} FCFA*\n` +
                `- Ventes Total : ${sales.length} tickets\n` +
                `- Statut Caisses : ${posConfigs.filter(p => p.status === 'OPEN').length} Ouverte(s)`;
    } else if (query.includes('stock')) {
        const lowStock = products.filter(p => p.stock_wh_shelf <= p.min_stock);
        reply = `📦 *ÉTAT DES STOCKS CRITIQUES*\n` +
                lowStock.map(p => `• ${p.name}: ${p.stock_wh_shelf} unités (Seuil: ${p.min_stock})`).join('\n');
    }

    sendWhatsAppNotification(sender, reply);
    res.json({ success: true, replied: reply });
});

// --- COMPTABILITÉ & GRAND LIVRE ---
app.get('/api/accounting/ledger', (req, res) => {
    res.json({ total: accountingLedger.length, entries: accountingLedger });
});

app.listen(PORT, () => console.log(`SYA OS Supermarket Enterprise System Active on Port ${PORT}`));