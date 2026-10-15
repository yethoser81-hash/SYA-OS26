/**
 * ============================================================================
 * SYA-OS — MOTEUR DE TOLÉRANCE LINGUISTIQUE & MULTILINGUE (config/i18n-engine.js)
 * ============================================================================
 */

const supportedLanguages = ['fr', 'en', 'sw', 'ha', 'pt', 'es', 'pidgin'];

/**
 * Calcul de la distance de Levenshtein pour la tolérance aux fautes d'orthographe
 */
function calculerDistanceMots(a, b) {
    if (!a || !b) return 999;
    const str1 = a.toLowerCase().trim();
    const str2 = b.toLowerCase().trim();
    
    const matrix = Array.from({ length: str2.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2[i - 1] === str1[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // Substitution
                    matrix[i][j - 1] + 1,     // Insertion
                    matrix[i - 1][j] + 1      // Suppression
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

/**
 * Analyse souple de l'intention utilisateur malgré les fautes
 */
function interpreterIntentionUtilisateur(saisieTexte) {
    const texteNormalise = saisieTexte.toLowerCase().trim();
    
    // Dictionnaire d'intentions souples avec tolérance phonétique
    const intentions = [
        { cle: 'VENTE', declencheurs: ['vendre', 'vendue', 'vante', 'vent', 'encaisse', 'paye'] },
        { cle: 'STOCK', declencheurs: ['reserve', 'magasin', 'stok', 'stck', 'reste', 'inventere'] },
        { cle: 'COMMANDE', declencheurs: ['commander', 'achte', 'fournisseur', 'cmd', 'livraison'] }
    ];

    const mots = texteNormalise.split(/\s+/);
    for (const mot of mots) {
        for (const item of intentions) {
            for (const dec of item.declencheurs) {
                if (calculerDistanceMots(mot, dec) <= 2) { // Tolère jusqu'à 2 fautes
                    return { intention: item.cle, motDetecte: mot, confiance: "HAUTE" };
                }
            }
        }
    }

    return { intention: 'UNKNOWN', confiance: "BASSE" };
}

module.exports = { supportedLanguages, interpreterIntentionUtilisateur, calculerDistanceMots };