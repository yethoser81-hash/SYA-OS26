/**
 * ============================================================================
 * SYA-OS — MODULE COMPTABILITÉ GÉNÉRALE & ANALYTIQUE (routes/accounting.js)
 * Conforme aux normes internationales (OHADA, IFRS, US GAAP, PCG France)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * 1. Initialiser le Plan Comptable International et Multi-Référentiel pour un Tenant
 * POST /api/accounting/plan/init
 */
router.post('/plan/init', async (req, res) => {
    try {
        const { tenantId, referentiel } = req.body; // 'OHADA', 'IFRS', 'US_GAAP', 'PCG_FR'
        const norme = (referentiel || 'OHADA').toUpperCase();

        let planComptable = [];

        // Sélection dynamique du plan comptable selon la législation géographique / internationale
        if (norme === 'OHADA' || norme === 'SYSCOA') {
            planComptable = [
                { numero: '1011', intitule: 'Capital social', classe: '1', type: 'PASSIF' },
                { numero: '1310', intitule: 'Résultat net de l\'exercice (Bénéfice)', classe: '1', type: 'PASSIF' },
                { numero: '1610', intitule: 'Emprunts auprès des établissements de crédit', classe: '1', type: 'PASSIF' },
                { numero: '2110', intitule: 'Terrains', classe: '2', type: 'ACTIF' },
                { numero: '2450', intitule: 'Matériel de transport', classe: '2', type: 'ACTIF' },
                { numero: '3110', intitule: 'Marchandises', classe: '3', type: 'ACTIF' },
                { numero: '4010', intitule: 'Fournisseurs d\'exploitation', classe: '4', type: 'PASSIF' },
                { numero: '4110', intitule: 'Clients', classe: '4', type: 'ACTIF' },
                { numero: '5210', intitule: 'Banques', classe: '5', type: 'ACTIF' },
                { numero: '5310', intitule: 'Caisse principale', classe: '5', type: 'ACTIF' },
                { numero: '5710', intitule: 'Mobile Money / Portefeuilles électroniques', classe: '5', type: 'ACTIF' },
                { numero: '6011', intitule: 'Achats de marchandises', classe: '6', type: 'CHARGE' },
                { numero: '6610', intitule: 'Rémunérations du personnel', classe: '6', type: 'CHARGE' },
                { numero: '7011', intitule: 'Ventes de marchandises', classe: '7', type: 'PRODUIT' }
            ];
        } else if (norme === 'IFRS' || norme === 'US_GAAP') {
            planComptable = [
                { numero: '1000', intitule: 'Share Capital & Equity', classe: '1', type: 'PASSIF' },
                { numero: '1200', intitule: 'Retained Earnings', classe: '1', type: 'PASSIF' },
                { numero: '2000', intitule: 'Long-term Liabilities & Debt', classe: '2', type: 'PASSIF' },
                { numero: '1100', intitule: 'Accounts Receivable (Assets)', classe: '1', type: 'ACTIF' },
                { numero: '1400', intitule: 'Inventory / Stock', classe: '1', type: 'ACTIF' },
                { numero: '1500', intitule: 'Cash and Cash Equivalents', classe: '1', type: 'ACTIF' },
                { numero: '2010', intitule: 'Accounts Payable', classe: '2', type: 'PASSIF' },
                { numero: '4000', intitule: 'Revenue / Sales', classe: '4', type: 'PRODUIT' },
                { numero: '5000', intitule: 'Cost of Goods Sold (COGS)', classe: '5', type: 'CHARGE' },
                { numero: '6000', intitule: 'Operating Expenses', classe: '6', type: 'CHARGE' }
            ];
        } else if (norme === 'PCG_FR' || norme === 'FRANCE') {
            planComptable = [
                { numero: '101000', intitule: 'Capital social', classe: '1', type: 'PASSIF' },
                { numero: '120000', intitule: 'Résultat de l\'exercice (bénéfice)', classe: '1', type: 'PASSIF' },
                { numero: '164000', intitule: 'Emprunts auprès des établissements de crédit', classe: '1', type: 'PASSIF' },
                { numero: '211000', intitule: 'Terrains', classe: '2', type: 'ACTIF' },
                { numero: '370000', intitule: 'Stocks de marchandises', classe: '3', type: 'ACTIF' },
                { numero: '401000', intitule: 'Fournisseurs', classe: '4', type: 'PASSIF' },
                { numero: '411000', intitule: 'Clients', classe: '4', type: 'ACTIF' },
                { numero: '512000', intitule: 'Banque', classe: '5', type: 'ACTIF' },
                { numero: '530000', intitule: 'Caisse', classe: '5', type: 'ACTIF' },
                { numero: '607000', intitule: 'Achats de marchandises', classe: '6', type: 'CHARGE' },
                { numero: '707000', intitule: 'Ventes de marchandises', classe: '7', type: 'PRODUIT' }
            ];
        } else {
            return res.status(400).json({ 
                statut: "ERREUR", 
                message: `Le référentiel comptable '${norme}' n'est pas pris en charge nativement. Veuillez utiliser OHADA, IFRS, US_GAAP ou PCG_FR.` 
            });
        }

        const payload = planComptable.map(c => ({
            tenant_id: tenantId,
            referentiel: norme,
            numero_compte: c.numero,
            intitule_compte: c.intitule,
            classe_compte: c.classe,
            type_compte: c.type
        }));

        // Insertion ou mise à jour dans Supabase
        const { data, error } = await supabase
            .from('accounting_plans')
            .upsert(payload, { onConflict: 'tenant_id, numero_compte' })
            .select();

        if (error) throw error;

        res.status(200).json({
            statut: "SUCCÈS",
            message: `Plan comptable international [${norme}] initialisé avec succès (${data.length} comptes configurés).`,
            comptes: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 2. Enregistrer une écriture comptable en partie double (Débit = Crédit)
 * POST /api/accounting/entries
 */
router.post('/entries', async (req, res) => {
    try {
        const { tenantId, journalCode, referencePiece, libelle, lignes } = req.body;
        // lignes = [ { numeroCompte: '4110', debit: 5000, credit: 0 }, { numeroCompte: '7011', debit: 0, credit: 5000 } ]

        if (!tenantId || !journalCode || !lignes || !Array.isArray(lignes) || lignes.length < 2) {
            return res.status(400).json({ statut: "ERREUR", message: "Une écriture comptable requiert un journal et au moins 2 lignes (partie double)." });
        }

        let totalDebit = 0;
        let totalCredit = 0;

        lignes.forEach(l => {
            totalDebit += Number(l.debit || 0);
            totalCredit += Number(l.credit || 0);
        });

        // Vérification rigoureuse de l'équilibre Débit / Crédit
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return res.status(400).json({
                statut: "ERREUR",
                message: `Écriture déséquilibrée. Total Débit (${totalDebit}) != Total Crédit (${totalCredit}).`
            });
        }

        const pieceRef = referencePiece || ('PIECE-' + Date.now());
        const dateEcriture = new Date().toISOString();

        const ecrituresRows = lignes.map(l => ({
            tenant_id: tenantId,
            journal_code: journalCode.toUpperCase(), // AC, VE, BQ, CA, OD
            reference_piece: pieceRef,
            libelle_ecriture: libelle,
            numero_compte: l.numeroCompte,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            date_ecriture: dateEcriture
        }));

        const { data, error } = await supabase
            .from('accounting_entries')
            .insert(ecrituresRows)
            .select();

        if (error) throw error;

        res.status(201).json({
            statut: "SUCCÈS",
            message: "Écriture comptable validée et enregistrée au Grand Livre.",
            reference: pieceRef,
            equilibree: true,
            totaux: { totalDebit, totalCredit },
            mouvements: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 3. Obtenir le Grand Livre et la Balance Générale d'un Tenant
 * GET /api/accounting/ledger/:tenantId
 */
router.get('/ledger/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;

        const { data, error } = await supabase
            .from('accounting_entries')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('date_ecriture', { ascending: false });

        if (error) throw error;

        let generalDebit = 0;
        let generalCredit = 0;
        const balanceParCompte = {};

        data.forEach(m => {
            generalDebit += Number(m.debit);
            generalCredit += Number(m.credit);

            if (!balanceParCompte[m.numero_compte]) {
                balanceParCompte[m.numero_compte] = { numeroCompte: m.numero_compte, totalDebit: 0, totalCredit: 0, solde: 0 };
            }
            balanceParCompte[m.numero_compte].totalDebit += Number(m.debit);
            balanceParCompte[m.numero_compte].totalCredit += Number(m.credit);
        });

        // Calcul des soldes par compte
        Object.keys(balanceParCompte).forEach(compte => {
            const b = balanceParCompte[compte];
            b.solde = b.totalDebit - b.totalCredit;
        });

        res.status(200).json({
            statut: "SUCCÈS",
            tenantId,
            totalGeneral: { debit: generalDebit, credit: generalCredit, equilibre: Math.abs(generalDebit - generalCredit) < 0.01 },
            balanceComptable: Object.values(balanceParCompte),
            grandLivre: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

module.exports = router;