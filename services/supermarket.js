/**
 * ============================================================================
 * SYA-OS — ROUTE BACKEND SUPERMARCHÉ & GESTION DES STOCKS (routes/supermarket.js)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// 1. Récupérer l'état complet de la réserve d'un tenant (avec recherche floue optionnelle)
router.get('/reserve/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { search } = req.query;

        let query = supabase.from('reserve_stock').select('*').eq('tenant_id', tenantId);

        if (search) {
            // Utilisation de la recherche textuelle souple
            query = query.ilike('nom_article', `%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json({ statut: "SUCCÈS", stock: data });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

// 2. Ajouter une entrée de stock en réserve (Entrepôt)
router.post('/reserve/entree', async (req, res) => {
    try {
        const { tenantId, barcode, nomArticle, numLot, dlc, emplacement, quantiteReserve, seuilAlerteRupture, prixAchat, prixVente } = req.body;

        const { data, error } = await supabase.from('reserve_stock').insert([{
            tenant_id: tenantId,
            barcode: barcode || 'N/C',
            nom_article: nomArticle,
            num_lot: numLot,
            dlc: dlc,
            emplacement: emplacement || 'Entrepôt Général',
            quantite_reserve: Number(quantiteReserve || 0),
            seuil_alerte_rupture: Number(seuilAlerteRupture || 10),
            prix_achat: Number(prixAchat || 0),
            prix_vente: Number(prixVente || 0)
        }]).select();

        if (error) throw error;

        res.status(201).json({ statut: "SUCCÈS", message: "Article enregistré en réserve avec succès.", article: data[0] });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

// 3. Récupérer les rayons d'un tenant
router.get('/rayons/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { data, error } = await supabase.from('rayons').select('*').eq('tenant_id', tenantId);

        if (error) throw error;

        res.status(200).json({ statut: "SUCCÈS", rayons: data });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

// 4. Créer un nouveau rayon
router.post('/rayons/creer', async (req, res) => {
    try {
        const { tenantId, nomRayon, chefRayon, capaciteFacing, seuilAlerteRupture } = req.body;

        const { data, error } = await supabase.from('rayons').insert([{
            tenant_id: tenantId,
            nom_rayon: nomRayon,
            chef_rayon: chefRayon || 'Non assigné',
            capacite_facing: Number(capaciteFacing || 150),
            stock_rayon: 0,
            seuil_alerte_rupture: Number(seuilAlerteRupture || 20),
            articles_exposes: []
        }]).select();

        if (error) throw error;

        res.status(201).json({ statut: "SUCCÈS", message: `Rayon [${nomRayon}] créé avec succès.`, rayon: data[0] });
    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

// 5. Transférer du stock de la Réserve vers un Rayon
router.post('/transfert', async (req, res) => {
    try {
        const { tenantId, articleIdReserve, rayonIdCible, quantiteTransfert } = req.body;

        // 1. Récupérer l'article en réserve
        const { data: articleRes, error: errRes } = await supabase
            .from('reserve_stock')
            .select('*')
            .eq('id', articleIdReserve)
            .eq('tenant_id', tenantId)
            .single();

        if (errRes || !articleRes) {
            return res.status(404).json({ statut: "ERREUR", message: "Article introuvable dans la réserve." });
        }

        const qte = Number(quantiteTransfert);
        if (qte <= 0 || qte > Number(articleRes.quantite_reserve)) {
            return res.status(400).json({ statut: "ERREUR", message: "Quantité invalide ou supérieure au stock disponible en réserve." });
        }

        // 2. Mettre à jour la réserve (Déduire la quantité)
        const nouveauStockReserve = Number(articleRes.quantite_reserve) - qte;
        await supabase
            .from('reserve_stock')
            .update({ quantite_reserve: nouveauStockReserve, mis_a_jour_le: new Date() })
            .eq('id', articleIdReserve);

        // 3. Récupérer le rayon cible
        const { data: rayonCible, error: errRayon } = await supabase
            .from('rayons')
            .select('*')
            .eq('id', rayonIdCible)
            .eq('tenant_id', tenantId)
            .single();

        if (errRayon || !rayonCible) {
            return res.status(404).json({ statut: "ERREUR", message: "Rayon cible introuvable." });
        }

        // 4. Mettre à jour le stock et les articles exposés dans le rayon
        let articlesExposes = rayonCible.articles_exposes || [];
        let indexExpose = articlesExposes.findIndex(a => a.barcode === articleRes.barcode);

        if (indexExpose >= 0) {
            articlesExposes[indexExpose].quantite = Number(articlesExposes[indexExpose].quantite) + qte;
        } else {
            articlesExposes.push({
                barcode: articleRes.barcode,
                nomArticle: articleRes.nom_article,
                quantite: qte
            });
        }

        const nouveauStockRayon = Number(rayonCible.stock_rayon) + qte;

        await supabase
            .from('rayons')
            .update({
                stock_rayon: nouveauStockRayon,
                articles_exposes: articlesExposes,
                mis_a_jour_le: new Date()
            })
            .eq('id', rayonIdCible);

        res.status(200).json({
            statut: "SUCCÈS",
            message: `Transfert de ${qte} unités vers le rayon [${rayonCible.nom_rayon}] effectué avec succès.`
        });

    } catch (err) {
        res.status(500).json({ statut: "ERREUR", message: err.message });
    }
});

module.exports = router;