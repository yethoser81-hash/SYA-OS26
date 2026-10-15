/**
 * ============================================================================
 * SYA-OS — MOTEUR DE GESTION DES RAYONS & INTERCONNEXION (rayons-engine.js)
 * ============================================================================
 */

class SyaMoteurRayons {
    constructor() {
        this.rayonsKey = 'sya_rayons_interconnected_db';
        this.demandesKey = 'sya_demandes_reap_db';
        this.initialiserStockage();
    }

    initialiserStockage() {
        if (!localStorage.getItem(this.rayonsKey)) {
            localStorage.setItem(this.rayonsKey, JSON.stringify([]));
        }

        if (!localStorage.getItem(this.demandesKey)) {
            localStorage.setItem(this.demandesKey, JSON.stringify([]));
        }
    }

    obtenirRayons() {
        return JSON.parse(localStorage.getItem(this.rayonsKey)) || [];
    }

    obtenirDemandesReappro() {
        return JSON.parse(localStorage.getItem(this.demandesKey)) || [];
    }

    creerRayon(rayonData) {
        const rayons = this.obtenirRayons();
        const nouveauRayon = {
            id: Date.now(),
            nomRayon: rayonData.nomRayon || 'Nouveau Rayon',
            chefRayon: rayonData.chefRayon || 'Non assigné',
            capaciteFacing: Number(rayonData.capaciteFacing || 150),
            stockRayon: 0,
            seuilAlerteRupture: Number(rayonData.seuilAlerteRupture || 20),
            articlesExposes: rayonData.articlesExposes || []
        };
        
        nouveauRayon.stockRayon = nouveauRayon.articlesExposes.reduce((acc, curr) => acc + Number(curr.quantite || 0), 0);

        rayons.push(nouveauRayon);
        localStorage.setItem(this.rayonsKey, JSON.stringify(rayons));
        return { statut: "SUCCÈS", message: `Rayon [${nouveauRayon.nomRayon}] créé avec succès.`, rayon: nouveauRayon };
    }

    ajouterStockRayonDirect(rayonId, articleData) {
        const rayons = this.obtenirRayons();
        const rayon = rayons.find(r => r.id === Number(rayonId));
        if (!rayon) return { statut: "ERREUR", message: "Rayon introuvable." };

        let existant = rayon.articlesExposes.find(a => a.barcode === articleData.barcode);
        if (existant) {
            existant.quantite += Number(articleData.quantite);
            existant.nomArticle = articleData.nomArticle;
        } else {
            rayon.articlesExposes.push({
                barcode: articleData.barcode,
                nomArticle: articleData.nomArticle,
                quantite: Number(articleData.quantite)
            });
        }

        rayon.stockRayon = rayon.articlesExposes.reduce((acc, curr) => acc + curr.quantite, 0);
        localStorage.setItem(this.rayonsKey, JSON.stringify(rayons));
        return { statut: "SUCCÈS", message: `Rayon [${rayon.nomRayon}] mis à jour.` };
    }

    modifierChefRayon(rayonId, nouveauChef) {
        const rayons = this.obtenirRayons();
        const rayon = rayons.find(r => r.id === Number(rayonId));
        if (rayon) {
            rayon.chefRayon = nouveauChef;
            localStorage.setItem(this.rayonsKey, JSON.stringify(rayons));
            return { statut: "SUCCÈS", message: `Chef du rayon [${rayon.nomRayon}] mis à jour : ${nouveauChef}` };
        }
        return { statut: "ERREUR", message: "Rayon introuvable." };
    }

    rechercherRayons(query) {
        const rayons = this.obtenirRayons();
        if (!query) return rayons;
        const q = query.toLowerCase();
        return rayons.filter(r => r.nomRayon.toLowerCase().includes(q) || r.chefRayon.toLowerCase().includes(q));
    }

    emettreDemandeReappro(rayonId, articlesDemandes) {
        const rayons = this.obtenirRayons();
        const rayon = rayons.find(r => r.id === Number(rayonId));
        if (!rayon) return { statut: "ERREUR", message: "Rayon introuvable." };

        const demandes = this.obtenirDemandesReappro();
        const nouvelleDemande = {
            id: Date.now(),
            rayonId: rayon.id,
            nomRayon: rayon.nomRayon,
            chefRayon: rayon.chefRayon,
            articlesDemandes: articlesDemandes || [],
            statut: 'EN ATTENTE',
            dateDemande: new Date().toISOString().slice(0, 10)
        };

        demandes.unshift(nouvelleDemande);
        localStorage.setItem(this.demandesKey, JSON.stringify(demandes));
        return { statut: "SUCCÈS", message: `Demande de réapprovisionnement transmise à la Réserve pour le rayon [${rayon.nomRayon}].` };
    }

    transfererReserveVersRayon(articleIdReserve, rayonIdCible, quantiteTransfert, reserveEngineInstance) {
        const stockReserve = reserveEngineInstance.obtenirStockReserve();
        const articleReserve = stockReserve.find(a => a.id === Number(articleIdReserve));

        if (!articleReserve) return { statut: "ERREUR", message: "Article introuvable dans la réserve." };
        if (quantiteTransfert <= 0 || quantiteTransfert > articleReserve.quantiteReserve) {
            return { statut: "ERREUR", message: "Quantité invalide ou supérieure au stock disponible en réserve." };
        }

        articleReserve.quantiteReserve -= Number(quantiteTransfert);
        localStorage.setItem(reserveEngineInstance.stockKey, JSON.stringify(stockReserve));

        const rayons = this.obtenirRayons();
        const rayonCible = rayons.find(r => r.id === Number(rayonIdCible));

        if (rayonCible) {
            rayonCible.stockRayon += Number(quantiteTransfert);
            let articleExpose = rayonCible.articlesExposes.find(ae => ae.barcode === articleReserve.barcode);
            if (articleExpose) {
                articleExpose.quantite += Number(quantiteTransfert);
            } else {
                rayonCible.articlesExposes.push({
                    barcode: articleReserve.barcode,
                    nomArticle: articleReserve.nomArticle,
                    quantite: Number(quantiteTransfert)
                });
            }
            localStorage.setItem(this.rayonsKey, JSON.stringify(rayons));
        }

        return { statut: "SUCCÈS", message: `Transfert de ${quantiteTransfert} unités vers [${rayonCible.nomRayon}] effectué.` };
    }
}