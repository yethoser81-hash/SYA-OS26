const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { generateJournalEntries } = require('../services/accounting.service');
const { sendInvoiceWhatsApp } = require('../services/whatsapp.service');

// 1. Récupération des produits par module métia
router.get('/products', async (req, res) => {
  try {
    const { module: moduleName } = req.query;
    const products = await db.getProductsByModule(moduleName || 'boutique');
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Enregistrement d'une vente / transaction
router.post('/sales', async (req, res) => {
  try {
    const { module: moduleName, items, total, paymentMethod, customerPhone, cashierId } = req.body;

    const saleId = `INV-${Date.now().toString().slice(-6)}`;
    const securityCode = `SEC-${Math.floor(100000 + Math.random() * 900000)}`;

    const saleRecord = {
      id: saleId,
      module: moduleName,
      items,
      total,
      paymentMethod,
      customerPhone,
      cashierId: cashierId || 'CASH-01',
      securityCode,
      verifiedBySecurity: false,
      createdAt: new Date().toISOString()
    };

    // Sauvegarde en base de données
    await db.saveSale(saleRecord);

    // Mettre à jour les stocks
    await db.decrementStock(items);

    // Génération automatique des écritures comptables
    const accountingEntries = generateJournalEntries({
      saleId,
      total,
      paymentMethod,
      moduleName
    });
    await db.saveAccountingEntries(accountingEntries);

    // Notification WhatsApp si numéro client renseigné
    if (customerPhone) {
      sendInvoiceWhatsApp(customerPhone, saleRecord).catch(err => 
        console.error("Erreur d'envoi WhatsApp:", err.message)
      );
    }

    res.json({
      success: true,
      message: 'Vente enregistrée avec succès',
      data: saleRecord
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Vérification du QR Code par le Gardien à la sortie
router.post('/security/verify', async (req, res) => {
  try {
    const { securityCode } = req.body;
    const sale = await db.getSaleBySecurityCode(securityCode);

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Ticket invalide ou inexistant' });
    }

    if (sale.verifiedBySecurity) {
      return res.status(400).json({
        success: false,
        alreadyVerified: true,
        message: `ATTENTION: Ce ticket a déjà été contrôlé à ${sale.verifiedAt}`
      });
    }

    // Marquer comme vérifié
    const verifiedAt = new Date().toLocaleTimeString('fr-FR');
    await db.updateSaleSecurityStatus(securityCode, true, verifiedAt);

    res.json({
      success: true,
      message: 'Ticket VALIDE — Sortie autorisée',
      data: {
        saleId: sale.id,
        itemsCount: sale.items.reduce((acc, item) => acc + item.qty, 0),
        items: sale.items,
        total: sale.total,
        verifiedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;