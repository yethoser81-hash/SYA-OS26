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

// --- BASE DE DONNÉES EN MÉMOIRE (STRUCTURE TYPE ODOO) ---

let mockPOSConfigs = [
    { id: 'pos_caisse_1', name: 'Caisse Principale 01', status: 'OPEN', activeSessionId: 'sess_101', cashier: 'Paul' },
    { id: 'pos_caisse_2', name: 'Caisse Rayon Frais 02', status: 'CLOSED', activeSessionId: null, cashier: null }
];

let mockSessions = [
    { id: 'sess_101', pos_id: 'pos_caisse_1', opened_at: new Date().toISOString(), opening_balance: 50000, status: 'OPEN', total_sales: 0 }
];

let mockProducts = [
    { id: 'p1', code: '376001', name: 'Riz Parfumé 50kg', category: 'Alimentation', cost_price: 22000, retail_price: 25000, stock_qty: 15, min_stock_alert: 10, daily_avg_sales: 3 },
    { id: 'p2', code: '376002', name: 'Huile Raffinée 1L', category: 'Alimentation', cost_price: 1100, retail_price: 1350, stock_qty: 8, min_stock_alert: 20, daily_avg_sales: 5 },
    { id: 'p3', code: '376003', name: 'Lait Concentré 1kg', category: 'Épicerie', cost_price: 650, retail_price: 800, stock_qty: 45, min_stock_alert: 15, daily_avg_sales: 4 }
];

let mockSales = [];
let mockAccountingEntries = [];

// --- MOTEUR IA PRÉDICTIF & SIMULATION NOTIFICATION WHATSAPP/SMS ---

function analyserStocksEtAlertesIA() {
    let alertesList = [];

    mockProducts.forEach(prod => {
        // Calcul du nombre de jours de stock restant
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

function envoyerNotificationWhatsAppAdmin(titre, corpsMsg) {
    console.log(`\n================================================`);
    console.log(`📲 [NOTIFICATION WA / SMS ENVOYÉE À L'ADMIN]`);
    console.log(`📌 SUJET: ${titre}`);
    console.log(`💬 MESSAGE:\n${corpsMsg}`);
    console.log(`================================================\n`);
}

// --- ROUTAGE DES VUES ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'views', 'supermarche.html')));

// --- API REST COMPTABILITÉ & POS ---

// 1. Obtenir les sessions & configurations POS
app.get('/api/pos/sessions', (req, res) => {
    res.json({ configs: mockPOSConfigs, sessions: mockSessions });
});

// 2. Ouvrir / Fermer une Session POS avec Bilan
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

            // Bilan Automatique de clôture généré par l'IA
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

// 3. Traitement Vente POS & Génération Écritures Comptables OHADA
app.post('/api/pos/order', (req, res) => {
    const { pos_id, session_id, items, payment_method, cashier_name } = req.body;

    let session = mockSessions.find(s => s.id === session_id);
    if (!session || session.status !== 'OPEN') {
        return res.status(400).json({ error: "Session de caisse fermée ou invalide" });
    }

    let orderTotal = 0;
    let totalCostOfGoods = 0;

    // Déstockage et calculs
    items.forEach(item => {
        let prod = mockProducts.find(p => p.id === item.id);
        if (prod) {
            prod.stock_qty -= item.qty;
            orderTotal += prod.retail_price * item.qty;
            totalCostOfGoods += prod.cost_price * item.qty;
        }
    });

    const orderRef = 'POS-' + Math.floor(100000 + Math.random() * 900000);
    const order = {
        id: 'ord_' + Date.now(),
        ref: orderRef,
        pos_id,
        session_id,
        items,
        total_amount: orderTotal,
        payment_method,
        cashier_name,
        created_at: new Date().toISOString()
    };

    mockSales.unshift(order);
    session.total_sales += orderTotal;

    // Écritures comptables selon le système OHADA
    const dateISO = new Date().toISOString();
    
    // Écriture 1 : Enregistrement de la vente (Trésorerie / Chiffre d'Affaires)
    mockAccountingEntries.push({
        id: 'ecr_' + Date.now() + '_1',
        date: dateISO,
        ref: orderRef,
        libelle: `Vente POS ${pos_id} - Ticket ${orderRef}`,
        debit_account: payment_method === 'MOBILE_MONEY' ? '521100 (Banque/Mobile)' : '571100 (Caisse)',
        credit_account: '701100 (Vente de marchandises)',
        amount: orderTotal
    });

    // Écriture 2 : Enregistrement de la variation de stock (COGS / Sortie de Stock)
    mockAccountingEntries.push({
        id: 'ecr_' + Date.now() + '_2',
        date: dateISO,
        ref: orderRef,
        libelle: `Variation Stock - Ticket ${orderRef}`,
        debit_account: '603100 (Variation des stocks de marchandises)',
        credit_account: '311100 (Stock de marchandises)',
        amount: totalCostOfGoods
    });

    // Analyse IA prédictive immédiate pour alerte de réapprovisionnement
    const alertes = analyserStocksEtAlertesIA();
    if (alertes.length > 0) {
        alertes.forEach(a => envoyerNotificationWhatsAppAdmin("Alerte Réapprovisionnement", a.message));
    }

    res.status(201).json({ order, alertes_declenchees: alertes.length });
});

// 4. Consultation du Grand Livre Comptable OHADA
app.get('/api/accounting/ledger', (req, res) => {
    res.json({
        total_entries: mockAccountingEntries.length,
        entries: mockAccountingEntries
    });
});

app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`  SYA OS Core running on port ${PORT}`);
    console.log(`  based POS & OHADA Engine active`);
    console.log(`================================================`);
});