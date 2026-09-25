const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// --- VUES HTML ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/security', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'security.html'));
});

app.get('/settings/invoice', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'settings-invoice.html'));
});

// --- API REST ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', system: 'SYA OS Core', version: '1.0.0', timestamp: new Date() });
});

// Base de données temporaire en mémoire
let mockProducts = [
    { id: 'p1', name: 'Riz Parfumé 50kg', category: 'Alimentation', bulk_unit: 'Sac', bulk_cost: 22000, ratio: 50, retail_price: 500, stock_bulk: 20 },
    { id: 'p2', name: 'Huile Raffinée 1L', category: 'Alimentation', bulk_unit: 'Carton', bulk_cost: 18000, ratio: 15, retail_price: 1350, stock_bulk: 12 },
    { id: 'p3', name: 'Savon de Ménage', category: 'Entretien', bulk_unit: 'Carton', bulk_cost: 12000, ratio: 24, retail_price: 600, stock_bulk: 8 }
];

let mockSales = [];
let mockAccountingEntries = [];

// API Produits
app.get('/api/products', (req, res) => {
    res.json(mockProducts);
});

app.post('/api/products', (req, res) => {
    const newProduct = { id: 'p_' + Date.now(), ...req.body };
    mockProducts.unshift(newProduct);
    res.status(201).json(newProduct);
});

// API Ventes & Génération automatique d'écritures comptables
app.post('/api/sales', (req, res) => {
    const { items, total, payment_method, client_name, client_whatsapp, analytic_center } = req.body;

    const ticketRef = 'TICK-' + Math.floor(100000 + Math.random() * 900000);
    const sale = {
        id: 'sale_' + Date.now(),
        ticket_ref: ticketRef,
        items,
        total,
        payment_method: payment_method || 'CASH',
        client_name: client_name || 'Client Passage',
        client_whatsapp: client_whatsapp || null,
        scanned_at_exit: false,
        created_at: new Date().toISOString()
    };

    mockSales.unshift(sale);

    // Écriture Comptable Automatique (Système OHADA / Général)
    const journalEntry = {
        id: 'ecr_' + Date.now(),
        date: new Date().toISOString(),
        ref: ticketRef,
        libelle: `Vente Comptant - Ticket ${ticketRef}`,
        debit_account: payment_method === 'MOBILE_MONEY' ? '521100 (Banque/Mobile)' : '571100 (Caisse)',
        credit_account: '701100 (Ventes de marchandises)',
        amount: total,
        analytic_center: analytic_center || 'GENERIC_STORE'
    };
    mockAccountingEntries.unshift(journalEntry);

    res.status(201).json({ sale, journalEntry });
});

// API Sécurité Gardien (Scan QR Code à la sortie)
app.get('/api/verify-ticket/:ticketRef', (req, res) => {
    const { ticketRef } = req.params;
    const sale = mockSales.find(s => s.ticket_ref === ticketRef);

    if (!sale) {
        return res.status(404).json({ valid: false, message: 'Ticket Invalide ou Introuvable !' });
    }

    if (sale.scanned_at_exit) {
        return res.status(400).json({ 
            valid: false, 
            message: 'ALERTE : Ce ticket a DEJA été scanné à la sortie !',
            scanned_at: sale.scanned_time
        });
    }

    // Validation et Marquage
    sale.scanned_at_exit = true;
    sale.scanned_time = new Date().toISOString();

    res.json({
        valid: true,
        message: 'TICKET VALIDÉ - SORTIE AUTORISÉE',
        ticket_ref: sale.ticket_ref,
        total: sale.total,
        items_count: sale.items ? sale.items.length : 0,
        items: sale.items,
        time: sale.scanned_time
    });
});

// API Comptabilité (Consortium & Rapports)
app.get('/api/accounting/entries', (req, res) => {
    res.json(mockAccountingEntries);
});

// Lancement du Serveur
app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`  SYA OS Core running on port ${PORT}`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`================================================`);
});