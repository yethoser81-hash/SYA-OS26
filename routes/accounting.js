/**
 * ============================================================================
 * SYA-OS — MODULE COMPTABILITÉ GÉNÉRALE (routes/accounting.js)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { obtenirRegimeComptable } = require('../config/accounting-engines');

/**
 * 1. Initialiser le plan comptable de base selon le régime de l'entreprise
 * POST /api/accounting/init-plan
 */
router.post('/init-plan', async (req, res) => {
    try {
        const { tenantId, regimeCode } = req.body;
        const regime = obtenirRegimeComptable(regimeCode);

        // Génération des comptes de base selon le régime
        const comptesParDefaut = [];
        for (const [classeKey, desc] of Object.entries(regime.classes)) {
            comptesParDefaut.push({
                tenant_id: tenantId,
                regime: regime.code,
                numero_compte: classeKey.toUpperCase(),
                intitule_compte: desc,
                classe_compte: classeKey
            });
        }

        const { data, error } = await supabase
            .from('accounting_plans')
            .insert(comptesParDefaut)
            .select();

        if (error) throw error;

        res.status(201).json({
            statut: "SUCCÈS",
            message: `Plan comptable [${regime.name}] initialisé avec succès.`,
            comptes: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 2. Enregistrer une écriture comptable dans le Grand Livre
 * POST /api/accounting/entries
 */
router.post('/entries', async (req, res) => {
    try {
        const { tenantId, journalCode, numeroCompte, libelle, debit, credit, referencePiece } = req.body;

        if (!tenantId || !journalCode || !numeroCompte || !libelle) {
            return res.status(400).json({ statut: "ERREUR", message: "Paramètres d'écriture incomplets." });
        }

        const montantDebit = Number(debit || 0);
        const montantCredit = Number(credit || 0);

        if (montantDebit === 0 && montantCredit === 0) {
            return res.status(400).json({ statut: "ERREUR", message: "Une écriture doit comporter un montant au débit ou au crédit." });
        }

        const { data, error } = await supabase
            .from('accounting_entries')
            .insert([{
                tenant_id: tenantId,
                journal_code: journalCode,
                numero_compte: numeroCompte,
                libelle_ecriture: libelle,
                debit: montantDebit,
                credit: montantCredit,
                reference_piece: referencePiece || 'REF-N/C'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            statut: "SUCCÈS",
            message: "Écriture comptable enregistrée avec succès.",
            ecriture: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 3. Obtenir le Grand Livre / Balance d'un Tenant
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

        // Calcul des totaux Débit / Crédit pour vérification de l'équilibre
        let totalDebit = 0;
        let totalCredit = 0;
        data.forEach(item => {
            totalDebit += Number(item.debit);
            totalCredit += Number(item.credit);
        });

        res.status(200).json({
            statut: "SUCCÈS",
            tenantId,
            equilibree: Math.abs(totalDebit - totalCredit) < 0.01,
            totaux: { totalDebit, totalCredit, ecart: totalDebit - totalCredit },
            mouvements: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

module.exports = router;