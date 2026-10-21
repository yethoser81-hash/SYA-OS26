/**
 * ============================================================================
 * SYA-OS — ROUTE D'ONBOARDING & CONFIGURATION MODULAIRE (routes/onboarding.js)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { obtenirRegimeComptable } = require('../config/accounting-engines');

/**
 * 1. Initialisation complète d'une nouvelle entreprise (Tenant + Modules + Admin)
 * POST /api/onboarding/register
 */
router.post('/register', async (req, res) => {
    try {
        const {
            nomEnseigne,
            secteurActivite,   // 'supermarket', 'microfinance', 'retail', 'wholesale', 'restaurant', 'corporate', 'other'
            regimeComptable,   // 'OHADA', 'IFRS', 'LOCAL_STANDARD'
            devisePrincipale,  // ex: 'FCFA', 'USD', 'EUR'
            telephoneWhatsapp,
            modulesPacks,      // Tableau des modules choisis ex: ['accounting', 'hr', 'marketing']
            adminNomComplet,
            adminPin
        } = req.body;

        // Validation des champs obligatoires
        if (!nomEnseigne || !secteurActivite || !adminNomComplet || !adminPin) {
            return res.status(400).json({
                statut: "ERREUR",
                message: "Les champs nomEnseigne, secteurActivite, adminNomComplet et adminPin sont requis."
            });
        }

        const regime = regimeComptable || 'OHADA';
        const regimeValide = obtenirRegimeComptable(regime);

        // A. Création du Tenant
        const { data: tenant, error: tenantErr } = await supabase
            .from('tenants')
            .insert([{
                nom_enseigne: nomEnseigne,
                secteur_activite: secteurActivite,
                regime_comptable: regimeValide.code,
                devise_principale: devisePrincipale || regimeValide.defaultCurrency,
                telephone_whatsapp: telephoneWhatsapp || null
            }])
            .select()
            .single();

        if (tenantErr) throw tenantErr;

        // B. Configuration dynamique des modules souscrits
        // On inclut d'office le module métier principal + les modules optionnels choisis (Compta, RH, Marketing)
        const modulesAActiver = new Set([secteurActivite]);
        
        if (Array.isArray(modulesPacks)) {
            modulesPacks.forEach(m => modulesAActiver.add(m));
        }

        const payloadModules = Array.from(modulesAActiver).map(moduleCode => ({
            tenant_id: tenant.id,
            module_code: moduleCode,
            est_actif: true
        }));

        const { error: modulesErr } = await supabase
            .from('tenant_modules')
            .insert(payloadModules);

        if (modulesErr) throw modulesErr;

        // C. Création de l'Administrateur Principal
        const { data: adminUser, error: adminErr } = await supabase
            .from('users_profiles')
            .insert([{
                tenant_id: tenant.id,
                nom_complet: adminNomComplet,
                role: 'admin',
                code_pin: adminPin
            }])
            .select()
            .single();

        if (adminErr) throw adminErr;

        res.status(201).json({
            statut: "SUCCÈS",
            message: "Entreprise configurée et initialisée avec succès dans SYA-OS.",
            donnees: {
                tenantId: tenant.id,
                nomEnseigne: tenant.nom_enseigne,
                regimeComptable: tenant.regime_comptable,
                devise: tenant.devise_principale,
                modulesActifs: Array.from(modulesAActiver),
                administrateur: {
                    id: adminUser.id,
                    nomComplet: adminUser.nom_complet,
                    role: adminUser.role
                }
            }
        });

    } catch (err) {
        console.error("Erreur lors de l'onboarding :", err);
        res.status(500).json({
            statut: "ERREUR",
            message: "Impossible d'effectuer la configuration initiale.",
            erreur: err.message
        });
    }
});

/**
 * 2. Obtenir la liste des modules activés pour un Tenant donné
 * GET /api/onboarding/modules/:tenantId
 */
router.get('/modules/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;

        const { data, error } = await supabase
            .from('tenant_modules')
            .select('module_code, est_actif, activated_at')
            .eq('tenant_id', tenantId)
            .eq('est_actif', true);

        if (error) throw error;

        res.status(200).json({
            statut: "SUCCÈS",
            tenantId,
            modulesActifs: data
        });
    } catch (err) {
        res.status(500).json({
            statut: "ERREUR",
            message: err.message
        });
    }
});

module.exports = router;