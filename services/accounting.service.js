/**
 * Génère les écritures comptables automatiques en partie double
 * selon le module et le mode de paiement.
 */
function generateJournalEntries({ saleId, total, paymentMethod, moduleName }) {
  const timestamp = new Date().toISOString();
  const entries = [];

  // Détermination des comptes selon le mode de règlement
  let debitAccount = '571100'; // Caisse Centrale par défaut
  let debitLabel = 'Encaissement Caisse';

  if (paymentMethod === 'mobile_money') {
    debitAccount = '521100'; // Compte Mobile Money / Banque
    debitLabel = 'Encaissement Mobile Money';
  } else if (paymentMethod === 'credit') {
    debitAccount = '411100'; // Client / Créance
    debitLabel = 'Vente à crédit Client';
  }

  // Détermination du compte de produit selon l'activité
  let creditAccount = '701100'; // Vente de marchandises par défaut
  if (moduleName === 'pharmacy') creditAccount = '701200';
  if (moduleName === 'restaurant') creditAccount = '706100'; // Prestations / Restauration
  if (moduleName === 'microfinance') creditAccount = '707100'; // Intérêts & Produits financiers

  // 1. Écriture Débit (Trésorerie / Créance)
  entries.push({
    saleId,
    date: timestamp,
    account: debitAccount,
    label: `${debitLabel} - Ref: ${saleId}`,
    debit: total,
    credit: 0,
    analyticalAxis: moduleName.toUpperCase()
  });

  // 2. Écriture Crédit (Chiffre d'affaires)
  entries.push({
    saleId,
    date: timestamp,
    account: creditAccount,
    label: `Vente ${moduleName} - Ref: ${saleId}`,
    debit: 0,
    credit: total,
    analyticalAxis: moduleName.toUpperCase()
  });

  return entries;
}

module.exports = {
  generateJournalEntries
};