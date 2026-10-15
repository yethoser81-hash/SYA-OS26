/**
 * ============================================================================
 * SYA-OS — MOTEUR DE GESTION DE RÉSERVE & ENTREPÔT (reserve-engine.js)
 * ============================================================================
 */

class SyaMoteurReserve {
    constructor() {
        this.stockKey = 'sya_reserve_stock_pro';
        this.demandesKey = 'sya_demandes_rayons_db';
        this.initialiserStockage();
    }

    initialiserStockage() {
        if (!localStorage.getItem(this.stockKey)) {
            localStorage.setItem(this.stockKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.demandesKey)) {
            localStorage.setItem(this.demandesKey, JSON.stringify([]));
        }
    }

    obtenirStockReserve() {
        return JSON.parse(localStorage.getItem(this.stockKey)) || [];
    }

    obtenirDemandesRayons() {
        return JSON.parse(localStorage.getItem(this.demandesKey)) || [];
    }

    traiterDemandeRayon(demandeId, rayonsEngineInstance) {
        const demandes = this.obtenirDemandesRayons();
        const demande = demandes.find(d => d.id === Number(demandeId));
        if (!demande || demande.statut === 'LIVRÉ') {
            return { statut: "ERREUR", message: "Demande introuvable ou déjà traitée." };
        }

        const stockReserve = this.obtenirStockReserve();
        let toutEstLivre = true;

        demande.articlesDemandes.forEach(item => {
            const articleReserve = stockReserve.find(a => a.barcode === item.barcode || a.id === Number(item.idReserve));
            if (articleReserve && articleReserve.quantiteReserve >= Number(item.quantite)) {
                articleReserve.quantiteReserve -= Number(item.quantite);
                
                rayonsEngineInstance.ajouterStockRayonDirect(demande.rayonId, {
                    barcode: articleReserve.barcode,
                    nomArticle: articleReserve.nomArticle,
                    quantite: Number(item.quantite)
                });
            } else {
                toutEstLivre = false;
            }
        });

        localStorage.setItem(this.stockKey, JSON.stringify(stockReserve));
        
        if (toutEstLivre) {
            demande.statut = 'LIVRÉ';
            localStorage.setItem(this.demandesKey, JSON.stringify(demandes));
            return { statut: "SUCCÈS", message: `Demande du rayon [${demande.nomRayon}] validée, préparée et livrée avec succès.` };
        }
        return { statut: "AVERTISSEMENT", message: "Stock insuffisant en réserve pour certains articles de la demande." };
    }

    ajouterEntreeReserve(articleData) {
        const stock = this.obtenirStockReserve();
        const nouvelArticle = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            barcode: articleData.barcode || 'N/C',
            nomArticle: articleData.nomArticle || 'Article Réceptionné',
            numLot: articleData.numLot || `LOT-${new Date().getFullYear()}-${Math.floor(Math.random()*1000)}`,
            dlc: articleData.dlc || '2027-01-01',
            emplacement: articleData.emplacement || 'Entrepôt Général',
            quantiteReserve: Number(articleData.quantiteReserve || 0),
            seuilAlerteRupture: Number(articleData.seuilAlerteRupture || 10),
            prixAchat: Number(articleData.prixAchat || 0),
            prixVente: Number(articleData.prixVente || 0)
        };

        stock.push(nouvelArticle);
        localStorage.setItem(this.stockKey, JSON.stringify(stock));
        return { statut: "SUCCÈS", message: `Article ${nouvelArticle.nomArticle} enregistré en réserve.`, article: nouvelArticle };
    }

    rechercherStock(query) {
        const stock = this.obtenirStockReserve();
        if (!query) return stock;
        const q = query.toLowerCase();
        return stock.filter(item => 
            item.nomArticle.toLowerCase().includes(q) || 
            item.barcode.toLowerCase().includes(q) || 
            item.numLot.toLowerCase().includes(q)
        );
    }
}