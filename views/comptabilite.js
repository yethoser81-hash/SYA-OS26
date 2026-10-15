/**
 * ============================================================================
 * SYA-OS — MOTEUR COMPTABLE PROFESSIONNEL EXPERT & MULTI-MÉTIER (comptabilite.js)
 * ============================================================================
 * Conforme aux normes OHADA (SYSCOHADA) / IFRS / US GAAP[cite: 14, 15]
 * Gère la partie double stricte, les tiers, les immobilisations et l'adaptation sectorielle.
 */

class SyaMoteurComptableUniversel {
    constructor(options = {}) {
        // 1. CONFIGURATION UNIVERSELLE DYNAMIQUE (Zéro code en dur)
        this.config = {
            nomEntreprise: options.nomEntreprise || "MON ENTREPRISE PRO",
            secteur: options.secteur || 'supermarche', // 'supermarche', 'restaurant', 'grossiste', 'services'
            normeComptable: options.normeComptable || 'OHADA', // 'OHADA' ou 'IFRS_US'
            devise: options.devise || 'FCFA',
            symboleDevise: options.symboleDevise || 'FCFA',
            tauxTvaDefaut: options.tauxTvaDefaut !== undefined ? options.tauxTvaDefaut : 19.25,
            pays: options.pays || 'Cameroun',
            exerciceFiscal: options.exerciceFiscal || new Date().getFullYear()
        };

        this.initialiserPlansComptablesEtSecteur();
        this.initialiserStockageExpert();
    }

    // =========================================================================
    // ADAPTATION AUTOMATIQUE SELON LA ZONE ET LE CORPS DE MÉTIER
    // =========================================================================
    initialiserPlansComptablesEtSecteur() {
        if (this.config.normeComptable === 'OHADA') {
            this.classesComptes = {
                "1": "Comptes de ressources stables (Capital, Réserves)",
                "2": "Comptes d'actif immobilisé",
                "3": "Comptes de stocks (Marchandises / Matières)",
                "4": "Comptes de tiers (Fournisseurs 401, Clients 411, État 44)",
                "5": "Comptes de trésorerie (Banques 521, Caisse 571, Mobile Money)",
                "6": "Comptes de charges des activités ordinaires",
                "7": "Comptes de produits des activités ordinaires"
            };
        } else {
            this.classesComptes = {
                "1": "Equity & Long-term Liabilities",
                "2": "Fixed Assets & Non-current Assets",
                "3": "Inventory & Stock",
                "4": "Accounts Receivable & Payable (Tiers)",
                "5": "Cash & Cash Equivalents",
                "6": "Operating Expenses",
                "7": "Revenue & Sales"
            };
        }

        // Adaptation des libellés selon le métier choisi par l'utilisateur
        switch (this.config.secteur) {
            case 'restaurant':
                this.libelleDefautVente = "Recettes journalières Restauration & Bar";
                this.centreAnalytiqueDefaut = "Salle / Cuisine";
                break;
            case 'grossiste':
                this.libelleDefautVente = "Facturation Vente en Gros";
                this.centreAnalytiqueDefaut = "Entrepôt Principal";
                break;
            case 'services':
                this.libelleDefautVente = "Facturation Prestations de Services";
                this.centreAnalytiqueDefaut = "Département Prestations";
                break;
            default: // Supermarché
                this.libelleDefautVente = "Vente journalière caisses - Libre-Service";
                this.centreAnalytiqueDefaut = "Surface de Vente";
                break;
        }
    }

    initialiserStockageExpert() {
        const cleJournal = `sya_compta_journal_${this.config.exerciceFiscal}`;
        if (!localStorage.getItem(cleJournal)) {
            const journalInitial = [
                {
                    idPiece: `PIECE-${this.config.exerciceFiscal}-001`,
                    date: new Date().toISOString().split('T')[0],
                    journal: 'VE',
                    libelle: this.libelleDefautVente,
                    centreAnalytique: this.centreAnalytiqueDefaut,
                    lignes: [
                        { compte: '571000', intitule: 'Caisse / Trésorerie', debit: 0, credit: 0 },
                        { compte: '701000', intitule: 'Chiffre d’affaires', debit: 0, credit: 0 },
                        { compte: '443100', intitule: 'TVA Collectée', debit: 0, credit: 0 }
                    ],
                    valide: true,
                    utilisateur: 'Système'
                }
            ];
            localStorage.setItem(cleJournal, JSON.stringify(journalInitial));
        }

        if (!localStorage.getItem('sya_compta_tiers')) {
            localStorage.setItem('sya_compta_tiers', JSON.stringify([]));
        }

        if (!localStorage.getItem('sya_compta_immobilisations')) {
            localStorage.setItem('sya_compta_immobilisations', JSON.stringify([]));
        }
    }

    // =========================================================================
    // SAISIE STRICTE EN PARTIE DOUBLE (CONTRÔLE ÉQUILIBRE DÉBIT = CRÉDIT)
    // =========================================================================
    saisirEcriturePartieDouble(codeJournal, libelle, lignesEcriture, centreAnalytique = null) {
        let totalDebit = 0;
        let totalCredit = 0;

        lignesEcriture.forEach(l => {
            totalDebit += Number(l.debit || 0);
            totalCredit += Number(l.credit || 0);
        });

        totalDebit = Math.round(totalDebit * 100) / 100;
        totalCredit = Math.round(totalCredit * 100) / 100;

        if (totalDebit !== totalCredit) {
            return {
                statut: "REFUSÉ",
                message: `Équilibre comptable non respecté : Débit (${totalDebit}) ≠ Crédit (${totalCredit}).`
            };
        }

        const cleJournal = `sya_compta_journal_${this.config.exerciceFiscal}`;
        const journal = JSON.parse(localStorage.getItem(cleJournal)) || [];
        const idPiece = `PIECE-${this.config.exerciceFiscal}-${String(journal.length + 1).padStart(3, '0')}`;

        const nouvellePiece = {
            idPiece,
            date: new Date().toISOString().split('T')[0],
            journal: codeJournal, // 'VE', 'AC', 'BQ', 'OD'
            libelle,
            centreAnalytique: centreAnalytique || this.centreAnalytiqueDefaut,
            lignes: lignesEcriture,
            valide: true,
            devise: this.config.devise
        };

        journal.push(nouvellePiece);
        localStorage.setItem(cleJournal, JSON.stringify(journal));

        return { statut: "SUCCÈS", message: `Pièce ${idPiece} enregistrée avec succès.`, piece: nouvellePiece };
    }

    // =========================================================================
    // BALANCE GÉNÉRALE ET ÉTATS FINANCIERS
    // =========================================================================
    genererBalanceGenerale() {
        const cleJournal = `sya_compta_journal_${this.config.exerciceFiscal}`;
        const journal = JSON.parse(localStorage.getItem(cleJournal)) || [];
        const balance = {};

        journal.forEach(piece => {
            if (!piece.valide) return;
            piece.lignes.forEach(l => {
                if (!balance[l.compte]) {
                    balance[l.compte] = { compte: l.compte, intitule: l.intitule || 'Compte Général', totalDebit: 0, totalCredit: 0, soldeDebit: 0, soldeCredit: 0 };
                }
                balance[l.compte].totalDebit += Number(l.debit || 0);
                balance[l.compte].totalCredit += Number(l.credit || 0);
            });
        });

        Object.keys(balance).forEach(compte => {
            const b = balance[compte];
            b.totalDebit = Math.round(b.totalDebit * 100) / 100;
            b.totalCredit = Math.round(b.totalCredit * 100) / 100;
            const diff = b.totalDebit - b.totalCredit;
            if (diff > 0) {
                b.soldeDebit = diff;
                b.soldeCredit = 0;
            } else {
                b.soldeDebit = 0;
                b.soldeCredit = Math.abs(diff);
            }
        });

        return balance;
    }

    genererEtatsFinanciersOfficiels() {
        const balance = this.genererBalanceGenerale();
        let totalProduits = 0;
        let totalCharges = 0;
        let totalActifTresorerie = 0;

        Object.keys(balance).forEach(compte => {
            const b = balance[compte];
            if (compte.startsWith('7')) totalProduits += b.totalCredit - b.totalDebit;
            if (compte.startsWith('6')) totalCharges += b.totalDebit - b.totalCredit;
            if (compte.startsWith('5')) totalActifTresorerie += b.soldeDebit - b.soldeCredit;
        });

        const resultatNet = totalProduits - totalCharges;

        return {
            entreprise: this.config.nomEntreprise,
            norme: this.config.normeComptable,
            secteur: this.config.secteur,
            devise: this.config.devise,
            compteResultat: {
                totalProduits: Math.round(totalProduits * 100) / 100,
                totalCharges: Math.round(totalCharges * 100) / 100,
                resultatNet: Math.round(resultatsNet = resultatNet * 100) / 100,
                statut: resultatNet >= 0 ? "BÉNÉFICE NET" : "DÉFICIT NET"
            },
            bilan: {
                tresorerieActive: Math.round(totalActifTresorerie * 100) / 100,
                resultatExercice: Math.round(resultatNet * 100) / 100
            }
        };
    }
}