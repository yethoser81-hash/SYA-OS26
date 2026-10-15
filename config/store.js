require('dotenv').config();

module.exports = {
    // Informations de l'Enseigne / Entreprise
    store_name: process.env.STORE_NAME || "GRAND MARCHÉ SYA",
    nui: process.env.STORE_NUI || "M08120004512A",
    rc: process.env.STORE_RC || "RC/DLA/2026/B/1200",
    address: "Avenue Centrale, Yaoundé, Cameroun",
    phone: "+237 600 00 00 00",
    email: "contact@sya-os.cm",

    // Configuration Fiscale & Monétaire
    currency: "FCFA",
    tva_rate: parseFloat(process.env.TVA_RATE) || 0.1925, // 19.25% (TVA Cameroun/CEMAC)

    // Paramètres WhatsApp & Notifications
    admin_whatsapp: process.env.ADMIN_WHATSAPP || "+237600000000",
    
    // Multi-Dépôts / Emplacements de Stock par Défaut
    default_warehouses: [
        { id: 'wh_main', name: 'Réserve Centrale', description: 'Stock principal de réapprovisionnement' },
        { id: 'wh_shelf', name: 'Rayons Vente', description: 'Stock directement accessible en caisse/surface' },
        { id: 'wh_loss', name: 'Stock Avaries & Casse', description: 'Zone de confinement des produits détériorés/périmés' }
    ],

    // Mentions légales bas de ticket / facture
    receipt_footer: "Merci pour votre confiance ! Les marchandises vendues ne sont ni reprises ni échangées."
};