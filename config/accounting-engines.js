/**
 * ============================================================================
 * SYA-OS — MOTEUR COMPTABLE MULTI-NORMES (config/accounting-engines.js)
 * ============================================================================
 */

const accountingFrameworks = {
    OHADA: {
        code: 'OHADA',
        name: 'SYSCOHADA Révisé',
        classes: {
            classe1: 'Comptes de capitaux',
            classe2: 'Comptes d\'immobilisations',
            classe3: 'Comptes de stocks',
            classe4: 'Comptes de tiers',
            classe5: 'Comptes de trésorerie',
            classe6: 'Comptes de charges',
            classe7: 'Comptes de produits'
        },
        defaultCurrency: 'FCFA'
    },
    IFRS: {
        code: 'IFRS',
        name: 'International Financial Reporting Standards',
        classes: {
            assets: 'Non-current and Current Assets',
            liabilities: 'Equity and Liabilities',
            revenues: 'Revenues',
            expenses: 'Operating Expenses'
        },
        defaultCurrency: 'USD'
    },
    LOCAL_STANDARD: {
        code: 'LOCAL',
        name: 'Standard National Simplifié (Tiers-Monde)',
        classes: {
            capital: 'Capitaux & Apports',
            stocks: 'Marchandises & Matériel',
            creances: 'Créances & Dettes',
            tresorerie: 'Caisse & Mobile Money',
            exploitation: 'Recettes & Dépenses d\'exploitation'
        },
        defaultCurrency: 'LOCAL'
    }
};

function obtenirRegimeComptable(regimeCode) {
    return accountingFrameworks[regimeCode] || accountingFrameworks.OHADA;
}

module.exports = { accountingFrameworks, obtenirRegimeComptable };