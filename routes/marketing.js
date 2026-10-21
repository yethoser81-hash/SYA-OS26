/**
 * ============================================================================
 * SYA-OS — MODULE MARKETING & CRM PRÉDICTIF (routes/marketing.js)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * 1. Créer ou mettre à jour un client CRM + Recalcul du segment RFM
 * POST /api/marketing/customers
 */
router.post('/customers', async (req, res) => {
    try {
        const { tenantId, nomComplet, telephoneWhatsapp, frequenceAchatJours, pointsFidelite, soldeCashback } = req.body;

        if (!tenantId || !nomComplet || !telephoneWhatsapp) {
            return res.status(400).json({ statut: "ERREUR", message: "tenantId, nomComplet et telephoneWhatsapp sont requis." });
        }

        // Insertion ou mise à jour (Upsert via telephoneWhatsapp)
        const { data, error } = await supabase
            .from('marketing_customers')
            .upsert([{
                tenant_id: tenantId,
                nom_complet: nomComplet,
                telephone_whatsapp: telephoneWhatsapp,
                frequence_achat_jours: Number(frequenceAchatJours || 14),
                points_fidelite: Number(pointsFidelite || 0),
                solde_cashback: Number(soldeCashback || 0),
                date_dernier_achat: new Date().toISOString()
            }], { onConflict: 'tenant_id, telephone_whatsapp' })
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            statut: "SUCCÈS",
            message: "Fiche client CRM synchronisée avec succès.",
            client: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 2. Moteur Prédictif : Déclencher les propositions de réapprovisionnement
 * POST /api/marketing/predictive/trigger
 */
router.post('/predictive/trigger', async (req, res) => {
    try {
        const { tenantId } = req.body;

        // A. Vérifier le mode marketing de l'entreprise (AUTOMATIQUE ou VALIDATION_REQUISE)
        const { data: tenant, error: tenantErr } = await supabase
            .from('tenants')
            .select('marketing_mode')
            .eq('id', tenantId)
            .single();

        if (tenantErr || !tenant) throw new Error("Tenant introuvable.");

        const modeAuto = tenant.marketing_mode === 'AUTOMATIQUE';

        // B. Récupérer les clients susceptibles de renouveler leur achat
        const { data: clients, error: clientErr } = await supabase
            .from('marketing_customers')
            .select('*')
            .eq('tenant_id', tenantId);

        if (clientErr) throw clientErr;

        const fileMessages = [];
        const maintenancesAujourdhui = new Date();

        (clients || []).forEach(c => {
            const dernierAchat = new Date(c.date_dernier_achat);
            const diffJours = Math.floor((maintenancesAujourdhui - dernierAchat) / (1000 * 60 * 60 * 24));

            // Si le client approche de son cycle de réapprovisionnement habituel
            if (diffJours >= c.frequence_achat_jours - 1) {
                const message = `Bonjour ${c.nom_complet} ! J'espère que vous allez bien. Selon vos habitudes, votre stock habituel arrive bientôt à terme. Souhaitez-vous qu'on vous le prépare avec vos ${c.points_fidelite} points de fidélité ?`;
                
                fileMessages.push({
                    tenant_id: tenantId,
                    customer_id: c.id,
                    canal: 'WHATSAPP',
                    contenu_message: message,
                    declencheur: 'PREDICTION_REAPPRO',
                    statut_validation: modeAuto ? 'ENVOYE' : 'EN_ATTENTE',
                    date_envoi: modeAuto ? new Date().toISOString() : null
                });
            }
        });

        if (fileMessages.length === 0) {
            return res.status(200).json({ statut: "SUCCÈS", message: "Aucune relance prédictive nécessaire aujourd'hui." });
        }

        const { data: queueData, error: queueErr } = await supabase
            .from('marketing_message_queue')
            .insert(fileMessages)
            .select();

        if (queueErr) throw queueErr;

        res.status(201).json({
            statut: "SUCCÈS",
            modeExecutif: tenant.marketing_mode,
            message: modeAuto 
                ? `${fileMessages.length} messages prédictifs envoyés automatiquement sur WhatsApp.`
                : `${fileMessages.length} messages prédictifs générés et placés dans la file de validation.`,
            messages: queueData
        });

    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 3. Récupérer la file des messages en attente de validation (Pour le Commerçant)
 * GET /api/marketing/queue/:tenantId
 */
router.get('/queue/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;

        const { data, error } = await supabase
            .from('marketing_message_queue')
            .select('*, marketing_customers(nom_complet, telephone_whatsapp)')
            .eq('tenant_id', tenantId)
            .eq('statut_validation', 'EN_ATTENTE')
            .order('date_creation', { ascending: false });

        if (error) throw error;

        res.status(200).json({
            statut: "SUCCÈS",
            totalEnAttente: data.length,
            file: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 4. Valider ou Rejeter un message en attente (Modération)
 * PATCH /api/marketing/queue/moderate
 */
router.patch('/queue/moderate', async (req, res) => {
    try {
        const { messageId, action, messageCorrige } = req.body; // action: 'VALIDER' ou 'REJETER'

        if (!['VALIDER', 'REJETER'].includes(action)) {
            return res.status(400).json({ statut: "ERREUR", message: "Action invalide. Utilisez VALLIDER ou REJETER." });
        }

        const nouveauStatut = action === 'VALIDER' ? 'VALIDE' : 'REJETE';
        const updatePayload = {
            statut_validation: nouveauStatut,
            date_envoi: action === 'VALIDER' ? new Date().toISOString() : null
        };

        if (messageCorrige) {
            updatePayload.contenu_message = messageCorrige;
        }

        const { data, error } = await supabase
            .from('marketing_message_queue')
            .update(updatePayload)
            .eq('id', messageId)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            statut: "SUCCÈS",
            message: `Message ${nouveauStatut === 'VALIDE' ? 'validé et transmis' : 'rejeté'}.`,
            donnees: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

module.exports = router;