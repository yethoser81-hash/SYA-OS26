/**
 * Moteur de cartographie des comptes SYSCOHADA Révisé pour SYA OS
 */
module.exports = {
    // Dictionnaire des comptes usuels SYSCOHADA
    ACCOUNTS: {
        // Classe 3 : STOCKS
        STOCK_MARCHANDISES: { code: '311100', label: 'Stock de marchandises' },
        
        // Classe 4 : TIERS (Clients, Fournisseurs, État)
        CLIENTS_B2B: { code: '411100', label: 'Clients - Ventes de marchandises' },
        FOURNISSEURS: { code: '401100', label: 'Fournisseurs d\'exploitation' },
        TVA_FACTUREE: { code: '443100', label: 'TVA facturée sur ventes' },
        TVA_RECUPERABLE: { code: '445100', label: 'TVA récupérable sur achats' },
        
        // Classe 5 : TRÉSORERIE
        BANQUE_MOBILE_MONEY: { code: '521100', label: 'Banque & Mobile Money (Orange/MTN/MoMo)' },
        CAISSE_ESPECES: { code: '571100', label: 'Caisse centrale / Espèces' },
        DIGITAL_TRUST_VAULT: { code: '585100', label: 'Garanties & Escrow Numériques (Trust Vault)' },
        
        // Classe 6 : CHARGES
        ACHATS_MARCHANDISES: { code: '601100', label: 'Achats de marchandises' },
        VARIATION_STOCKS: { code: '603100', label: 'Variation des stocks de marchandises' },
        PERTES_AVARIES_STOCKS: { code: '658000', label: 'Charges diverses / Pertes sur stocks & avaries' },
        
        // Classe 7 : PRODUITS
        VENTES_MARCHANDISES: { code: '701100', label: 'Ventes de marchandises' },
        COMMISSIONS_SERVICES: { code: '706100', label: 'Produits des activités annexes / Commissions' }
    },

    // Generateur automatique d'écritures en partie double
    buildJournalEntry: function({ ref, libelle, debitAccount, creditAccount, amount, date = new Date().toISOString() }) {
        return {
            id: 'ecr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            date,
            ref,
            libelle,
            debit_account: debitAccount,
            credit_account: creditAccount,
            amount: parseFloat(amount)
        };
    }
};