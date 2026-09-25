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
// CONFIGURATION DU MAGASIN & PARAMÈTRES GLOBATION
// ============================================================================

let storeConfig = {
    store_name: "GRAND MARCHÉ SYA",
    nui: "M08120004512A",
    rc: "RC/DLA/2024/B/1200",
    address: "Avenue Centrale, Yaoundé",
    tva_rate: 0.1925, // 19.25%
    admin_whatsapp: "+237600000000"
};

// Multi-Dépôts / Emplacements de Stock
let warehouses = [
    { id: 'wh_main', name: 'Réserve Centrale' },
    { id: 'wh_shelf', name: 'Rayons Vente' },
    { id: 'wh_loss', name: 'Stock Avaries & Casse' }
];

// ============================================================================
// BASE DE DONNÉES EN MÉMOIRE (STRUCTURE SUPERMARCHÉ & COMPTABILITÉ)
// ============================================================================

let mockPOSConfigs = [
    { id: 'pos_caisse_1', name: 'Caisse Principale 01', status: 'OPEN', activeSessionId: 'sess_101', cashier: 'Paul', type: 'STANDARD' },
    { id: 'pos_caisse_2', name: 'Caisse Rayon Frais 02', status: 'CLOSED', activeSessionId: null, cashier: null, type: 'STANDARD' },
    { id: 'pos_self_checkout', name: 'Borne Libre-Service QR/MoMo', status: 'OPEN', activeSessionId: 'sess_self', cashier: 'Auto', type: 'SELF_CHECKOUT' }
];

let mockSessions = [
    { id: 'sess_101', pos_id: 'pos_caisse_1', opened_at: new Date().toISOString(), opening_balance: 50000, status: 'OPEN', total_sales: 0 }
];

// Catalogue étendu avec DLC (Anti-gaspi), Multi-dépôt et codes-barres
let mockProducts = [
    { 
        id: 'p1', code: '376001234501', name: 'Riz Parfumé 50kg', category: 'Alimentation', 
        cost_price: 22000, retail_price: 25000, stock_qty: 15, stock_wh_main: 50, stock_wh_shelf: 15, 
        min_stock_alert: 10, daily_avg_sales: 3, dlc: '2026-12-31', is_anti_gaspi: false 
    },
    { 
        id: 'p2', code: '376002456102', name: 'Huile Raffinée 1L', category: 'Alimentation', 
        cost_price: 1100, retail_price: 1350, stock_qty: 8, stock_wh_main: 30, stock_wh_shelf: 8, 
        min_stock_alert: 20, daily_avg_sales: 5, dlc: '2026-10-15', is_anti_gaspi: false 
    },
    { 
        id: 'p3', code: '376003789203', name: 'Lait Frais Écrémé 1L', category: 'Produits Frais', 
        cost_price: 900, retail_price: 1200, stock_qty: 12, stock_wh_main: 10, stock_wh_shelf: 12, 
        min_stock_alert: 15, daily_avg_sales: 4, dlc: '2026-09-28', is_anti_gaspi: false // DLC courte
    }
];

// Clients B2B & Crédits
let mockB2BClients = [
    { id: 'cli_1', name: 'Hôtel La Résidence', credit_limit: 1000000, current_balance: 350000, status: 'APPROVED' }
];

let mockSales = [];
let mockAccountingEntries = [];
let avariesLog = [];

// ============================================================================
// MOTEUR IA & SERVICING WHATSAPP / ANTI-GASPI
// ============================================================================

function analyserStocksEtAlertesIA() {
    let alertesList = [];

    mockProducts.forEach(prod => {
        const joursRestants = prod.daily_avg_sales > 0 ? (prod.stock_qty / prod.daily_avg_sales).toFixed(1) : 999;

        if (prod.stock_qty <= prod.min_stock_alert || joursRestants <= 3) {
            const alerte = {
                product_id: prod.id,
                product_name: prod.name,
                stock_actuel: prod.stock_qty,
                jours_restants: joursRestants,
                message: `⚠️ *Alerte Stock Prédictif* : '${prod.name}' épuisé dans ~${joursRestants} jours au rythme actuel. Stock actuel : ${prod.stock_qty} unités. Réapprovisionnement recommandé.`
            };
            alertesList.push(alerte);
        }
    });

    return alertesList;
}

function runAntiGaspiEngine() {
    const today = new Date();
    mockProducts.forEach(p => {
        const dlcDate = new Date(p.dlc);
        const diffDays = Math.ceil((dlcDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays <= 3 && diffDays >= 0 && !p.is_anti_gaspi) {
            p.is_anti_gaspi = true;
            p.old_price = p.retail_price;
            p.retail_price = Math.round(p.retail_price * 0.6); // Remise automatique de 40%
            
            envoyerNotificationWhatsAppAdmin(
                "Action IA Anti-Gaspi", 
                `♻️ *PROMOTION ANTI-GASPI*\nProduit: *${p.name}*\nDLC Proche (${diffDays} jour(s) restant(s)).\nPrix remisé sur les caisses : *${p.retail_price} FCFA* (au lieu de ${p.old_price} FCFA).`
            );
        }
    });
}

function envoyerNotificationWhatsAppAdmin(titre, corpsMsg) {
    console.log(`\n================================================`);
    console.log(`📲 [NOTIFICATION WHATSAPP ADMIN ENVOYÉE]`);
    console.log(`📌 SUJET: ${titre}`);
    console.log(`💬 MESSAGE:\n${corpsMsg}`);
    console.log(`================================================\n`);
}

// ============================================================================
// ROUTAGE DES VUES (GESTION DES ERREURS DE ROUTE ACUEIL)
// ============================================================================

// Redirection automatique ou envoi du fichier HTML principal si disponible
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'views', 'supermarche.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            const fallbackPath = path.join(__dirname, 'public', 'supermarche.html');
            res.sendFile(fallbackPath, (err2) => {
                if (err2) {
                    res.send(`
                        <html>
                            <head><title>SYA OS Supermarché</title></head>
                            <body style="font-family:sans-serif; background:#0f172a; color:#fff; text-align:center; padding-top:50px;">
                                <h1>🛒 SYA OS Supermarket Suite Active</h1>
                                <p>Le serveur backend tourne correctement.</p>
                                <p>Consultez les endpoints API : <code>/api/products</code>, <code>/api/pos/sessions</code></p>
                            </body>
                        </html>
                    `);
                }
            });
        }
    });
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'supermarche.html'), (err) => {
        if (err) res.sendFile(path.join(__dirname, 'public', 'supermarche.html'));
    });
});

// ============================================================================
// API REST — CONFIGURATION & CATALOGUE DYNAMIQUE
// ============================================================================

app.get('/api/config', (req, res) => res.json(storeConfig));

app.get('/api/products', (req, res) => {
    runAntiGaspiEngine(); // Moteur Anti-Gaspi à chaque requête
    res.json(mockProducts);
});

// Génération d'étiquetage code-barres dynamique
app.get('/api/products/barcode/:id', (req, res) => {
    const p = mockProducts.find(prod => prod.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Produit non trouvé" });

    res.json({
        label_data: {
            ean: p.code,
            name: p.name,
            price: `${p.retail_price} FCFA`,
            unit: p.category === 'Boucherie' ? 'KG' : 'UNITÉ',
            qr_code: `SYA-PROD-${p.code}-${p.retail_price}`
        }
    });
});

// ============================================================================
// API REST — SESSIONS POS & ENCAISSEMENT (STANDARD & SELF-CHECKOUT)
// ============================================================================

app.get('/api/pos/sessions', (req, res) => {
    res.json({ configs: mockPOSConfigs, sessions: mockSessions });
});

app.post('/api/pos/session/toggle', (req, res) => {
    const { pos_id, action, opening_balance, closing_balance } = req.body;
    let pos = mockPOSConfigs.find(p => p.id === pos_id);

    if (!pos) return res.status(404).json({ error: "POS introuvable" });

    if (action === 'OPEN') {
        const newSession = {
            id: 'sess_' + Date.now(),
            pos_id: pos.id,
            opened_at: new Date().toISOString(),
            opening_balance: parseFloat(opening_balance || 0),
            status: 'OPEN',
            total_sales: 0
        };
        mockSessions.push(newSession);
        pos.status = 'OPEN';
        pos.activeSessionId = newSession.id;

        envoyerNotificationWhatsAppAdmin("Ouverture de Caisse", `🟢 Caisse '${pos.name}' ouverte avec un fond de caisse de ${opening_balance} FCFA.`);
        return res.json({ message: "Session ouverte", session: newSession });
    } 
    
    if (action === 'CLOSE') {
        let session = mockSessions.find(s => s.id === pos.activeSessionId);
        if (session) {
            session.status = 'CLOSED';
            session.closed_at = new Date().toISOString();
            session.closing_balance = parseFloat(closing_balance || 0);
            
            const totalEcar = session.closing_balance - (session.opening_balance + session.total_sales);

            const bilanMsg = `📊 *Bilan de Clôture - ${pos.name}*\n` +
                `- Fond de Départ : ${session.opening_balance.toLocaleString()} FCFA\n` +
                `- Ventes de la Session : ${session.total_sales.toLocaleString()} FCFA\n` +
                `- Attendu en Caisse : ${(session.opening_balance + session.total_sales).toLocaleString()} FCFA\n` +
                `- Réellement Encaissé : ${session.closing_balance.toLocaleString()} FCFA\n` +
                `- Écart de Caisse : ${totalEcar === 0 ? '✅ 0 FCFA' : '⚠️ ' + totalEcar + ' FCFA'}`;

            envoyerNotificationWhatsAppAdmin("Bilan Clôture de Caisse", bilanMsg);
        }

        pos.status = 'CLOSED';
        pos.activeSessionId = null;
        return res.json({ message: "Session fermée avec succès", session });
    }

    res.status(400).json({ error: "Action invalide" });
});

app.post('/api/pos/order', (req, res) => {
    const { pos_id, session_id, items, payment_method, cashier_name, client_type, b2b_client_id } = req.body;

    let session = mockSessions.find(s => s.id === session_id);
    if (!session || session.status !== 'OPEN') {
        return res.status(400).json({ error: "Session de caisse fermée ou invalide" });
    }

    let orderTotal = 0;
    let totalCostOfGoods = 0;

    items.forEach(item => {
        let prod = mockProducts.find(p => p.id === item.id);
        if (prod) {
            prod.stock_qty -= item.qty;
            if (prod.stock_wh_shelf >= item.qty) prod.stock_wh_shelf -= item.qty;
            
            orderTotal += prod.retail_price * item.qty;
            totalCostOfGoods += prod.cost_price * item.qty;
        }
    });

    const taxAmount = Math.round(orderTotal * storeConfig.tva_rate);
    const orderRef = 'POS-' + Math.floor(100000 + Math.random() * 900000);
    
    const order = {
        id: 'ord_' + Date.now(),
        ref: orderRef,
        pos_id,
        session_id,
        items,
        total_amount: orderTotal,
        tax_amount: taxAmount,
        payment_method,
        cashier_name: cashier_name || 'Inconnu',
        created_at: new Date().toISOString()
    };

    mockSales.unshift(order);
    session.total_sales += orderTotal;

    // Écritures comptables OHADA intégrées
    const dateISO = new Date().toISOString();
    let debitAccount = payment_method === 'MOBILE_MONEY' ? '521100 (Banque/Orange/MTN MoMo)' : '571100 (Caisse)';
    if (client_type === 'B2B') debitAccount = '411100 (Clients B2B - Compte de créance)';

    mockAccountingEntries.push({
        id: 'ecr_' + Date.now() + '_1',
        date: dateISO,
        ref: orderRef,
        libelle: `Vente POS ${pos_id} - Ticket ${orderRef}`,
        debit_account: debitAccount,
        credit_account: '701100 (Vente de marchandises)',
        amount: orderTotal - taxAmount
    });

    mockAccountingEntries.push({
        id: 'ecr_' + Date.now() + '_2',
        date: dateISO,
        ref: orderRef,
        libelle: `TVA Facturée - Ticket ${orderRef}`,
        debit_account: debitAccount,
        credit_account: '443100 (TVA Facturée sur ventes)',
        amount: taxAmount
    });

    mockAccountingEntries.push({
        id: 'ecr_' + Date.now() + '_3',
        date: dateISO,
        ref: orderRef,
        libelle: `Variation Stock - Ticket ${orderRef}`,
        debit_account: '603100 (Variation des stocks)',
        credit_account: '311100 (Stock de marchandises)',
        amount: totalCostOfGoods
    });

    const alertes = analyserStocksEtAlertesIA();
    if (alertes.length > 0) {
        alertes.forEach(a => envoyerNotificationWhatsAppAdmin("Alerte Réapprovisionnement", a.message));
    }

    res.status(201).json({ order, alertes_declenchees: alertes.length });
});

// ============================================================================
// API REST — AVARIES, CASSE & PERTES EN STOCK
// ============================================================================

app.post('/api/inventory/avarie', (req, res) => {
    const { product_id, qty, reason, cashier } = req.body;
    let p = mockProducts.find(prod => prod.id === product_id);

    if (!p || p.stock_qty < qty) {
        return res.status(400).json({ error: "Stock insuffisant ou produit non trouvé" });
    }

    p.stock_qty -= qty;
    p.stock_wh_shelf = Math.max(0, p.stock_wh_shelf - qty);

    const lossValue = p.cost_price * qty;
    const avarieEntry = { id: 'avr_' + Date.now(), product_id, qty, lossValue, reason, date: new Date().toISOString() };
    avariesLog.push(avarieEntry);

    // Écriture Comptable OHADA (Pertes sur stocks)
    mockAccountingEntries.push({
        id: 'ecr_avr_' + Date.now(),
        date: new Date().toISOString(),
        ref: 'AVARIE-' + avarieEntry.id,
        libelle: `Avarie/Casse: ${p.name} (${reason})`,
        debit_account: '658000 (Charges diverses / Pertes sur stocks)',
        credit_account: '311100 (Stock de marchandises)',
        amount: lossValue
    });

    envoyerNotificationWhatsAppAdmin(
        "Alerte Avarie / Casse", 
        `🚨 *DÉCLARATION AVARIE*\nProduit: ${p.name}\nQuantité: ${qty}\nPerte : ${lossValue.toLocaleString()} FCFA\nMotif: ${reason}`
    );

    res.json({ message: "Avarie comptabilisée avec succès", avarieEntry });
});

// ============================================================================
// API REST — WEBHOOK INTERACTIF WHATSAPP & RAPPROCHEMENT MOMO
// ============================================================================

app.post('/api/whatsapp/webhook', (req, res) => {
    const { sender, message_text } = req.body;
    const query = (message_text || '').toLowerCase().trim();

    let reply = "Commande non reconnue. Tapez 'bilan', 'stock' ou 'alertes'.";

    if (query.includes('bilan')) {
        const totalSales = mockSales.reduce((sum, s) => sum + s.total_amount, 0);
        reply = `📊 *BILAN EN TEMPS RÉEL*\n- Total Ventes : *${totalSales.toLocaleString()} FCFA*\n- Nombre de tickets : ${mockSales.length}\n- Caisses actives : ${mockPOSConfigs.filter(p => p.status === 'OPEN').length}`;
    } else if (query.includes('stock')) {
        const alertes = analyserStocksEtAlertesIA();
        reply = alertes.length > 0 
            ? alertes.map(a => a.message).join('\n') 
            : "✅ Tous les stocks de tous les rayons sont suffisants.";
    }

    envoyerNotificationWhatsAppAdmin(`Réponse WhatsApp -> ${sender}`, reply);
    res.json({ success: true, reply });
});

app.post('/api/accounting/reconcile', (req, res) => {
    const { statement_records } = req.body;
    let count = 0;

    if (Array.isArray(statement_records)) {
        statement_records.forEach(stmt => {
            let match = mockSales.find(s => s.payment_method === 'MOBILE_MONEY' && s.total_amount === stmt.amount && !s.reconciled);
            if (match) {
                match.reconciled = true;
                match.reconciled_ref = stmt.trx_id;
                count++;
            }
        });
    }

    res.json({ message: "Rapprochement automatique exécuté", reconciled_count: count });
});

// ============================================================================
// API REST — COMPTABILITÉ & GRAND LIVRE OHADA
// ============================================================================

app.get('/api/accounting/ledger', (req, res) => {
    res.json({
        total_entries: mockAccountingEntries.length,
        entries: mockAccountingEntries
    });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`  SYA OS Core running on port ${PORT}`);
    console.log(`  Supermarket POS & OHADA Engine active`);
    console.log(`================================================`);
});