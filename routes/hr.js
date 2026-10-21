/**
 * ============================================================================
 * SYA-OS — MODULE RESSOURCES HUMAINES (routes/hr.js)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * 1. Ajouter un nouvel employé
 * POST /api/hr/employees
 */
router.post('/employees', async (req, res) => {
    try {
        const { tenantId, matricule, nom, prenom, telephone, poste, typeContrat, salaireBase, dateEmbauche } = req.body;

        if (!tenantId || !matricule || !nom || !prenom || !poste) {
            return res.status(400).json({ statut: "ERREUR", message: "Les informations de base de l'employé sont incomplètes." });
        }

        const { data, error } = await supabase
            .from('hr_employees')
            .insert([{
                tenant_id: tenantId,
                matricule,
                nom,
                prenom,
                telephone: telephone || null,
                post_occupe: poste,
                type_contrat: typeContrat || 'CDI',
                salaire_de_base: Number(salaireBase || 0),
                date_embauche: dateEmbauche || new Date().toISOString().split('T')[0]
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            statut: "SUCCÈS",
            message: `Employé [${nom} ${prenom}] enregistré avec succès.`,
            employe: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 2. Récupérer la liste des employés d'un Tenant
 * GET /api/hr/employees/:tenantId
 */
router.get('/employees/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { data, error } = await supabase
            .from('hr_employees')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('nom', { ascending: true });

        if (error) throw error;

        res.status(200).json({ statut: "SUCCÈS", employes: data });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 3. Enregistrer un pointage (Présence / Absence / Retard)
 * POST /api/hr/attendance
 */
router.post('/attendance', async (req, res) => {
    try {
        const { tenantId, employeeId, statutPresence, heureArrivee, heureDepart, notes } = req.body;

        const { data, error } = await supabase
            .from('hr_attendance')
            .insert([{
                tenant_id: tenantId,
                employee_id: employeeId,
                statut_presence: statutPresence || 'PRESENT',
                heure_arrivee: heureArrivee || null,
                heure_depart: heureDepart || null,
                notes: notes || null
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            statut: "SUCCÈS",
            message: "Pointage enregistré.",
            pointage: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 4. Demander ou enregistrer un acompte sur salaire
 * POST /api/hr/advances
 */
router.post('/advances', async (req, res) => {
    try {
        const { tenantId, employeeId, montant, motif } = req.body;

        const { data, error } = await supabase
            .from('hr_advances')
            .insert([{
                tenant_id: tenantId,
                employee_id: employeeId,
                montant: Number(montant),
                motif: motif || 'Acompte mensuel'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            statut: "SUCCÈS",
            message: "Demande d'acompte enregistrée.",
            acompte: data
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

/**
 * 5. Générer le bulletin de paie mensuel d'un employé
 * POST /api/hr/payroll/generate
 */
router.post('/payroll/generate', async (req, res) => {
    try {
        const { tenantId, employeeId, mois, annee, primes } = req.body;

        // 1. Récupérer les informations de l'employé
        const { data: emp, error: empErr } = await supabase
            .from('hr_employees')
            .select('*')
            .eq('id', employeeId)
            .single();

        if (empErr || !emp) throw new Error("Employé non trouvé.");

        // 2. Récupérer les acomptes approuvés non encore déduits
        const { data: acomptes } = await supabase
            .from('hr_advances')
            .select('montant')
            .eq('employee_id', employeeId)
            .eq('statut', 'APPROUVE');

        const totalDeductions = (acomptes || []).reduce((acc, curr) => acc + Number(curr.montant), 0);
        const totalPrimes = Number(primes || 0);
        const salaireBase = Number(emp.salaire_de_base);
        const netAPayer = salaireBase + totalPrimes - totalDeductions;

        // 3. Insérer le bulletin de paie
        const { data: payroll, error: payErr } = await supabase
            .from('hr_payrolls')
            .insert([{
                tenant_id: tenantId,
                employee_id: employeeId,
                periode_mois: Number(mois),
                periode_annee: Number(annee),
                salaire_base: salaireBase,
                total_primes: totalPrimes,
                total_deductions: totalDeductions,
                net_a_payer: netAPayer,
                statut_paiement: 'VALIDE'
            }])
            .select()
            .single();

        if (payErr) throw payErr;

        res.status(201).json({
            statut: "SUCCÈS",
            message: "Bulletin de paie généré avec succès.",
            bulletin: payroll
        });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

module.exports = router;