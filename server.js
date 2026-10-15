/**
 * ============================================================================
 * SYA-OS — SERVEUR PRINCIPAL BACKEND (server.js)
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route de test de santé du serveur
app.get('/api/health', (req, res) => {
    res.status(200).json({
        statut: "SUCCÈS",
        systeme: "SYA-OS Enterprise Engine",
        temps: new Date().toISOString(),
        message: "Passerelle opérationnelle et connectée."
    });
});

// Montage des routes modulaires (Supermarché, Microfinance, Comptabilité, WhatsApp, etc.)
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/supermarket', require('./routes/supermarket'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Gestion centralisée des erreurs
app.use((err, req, res, next) => {
    console.error("Erreur serveur non interceptée :", err.stack);
    res.status(500).json({
        statut: "ERREUR",
        message: "Une erreur interne est survenue sur le serveur SYA-OS.",
        erreur: err.message
    });
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`[SYA-OS] Serveur de production démarré et actif sur le port ${PORT}`);
});