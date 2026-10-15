/**
 * Service d'envoi de factures et notifications via WhatsApp
 */
async function sendInvoiceWhatsApp(phoneNumber, saleData) {
  try {
    // Formater le numéro au format international si nécessaire
    const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');

    const itemsSummary = saleData.items
      .map(item => `• ${item.name} (x${item.qty}) : ${item.price * item.qty} FCFA`)
      .join('\n');

    const message = 
`🧾 *SYA OS — FACTURE DE CAISSE*
--------------------------------
N° Facture : *${saleData.id}*
Date : ${new Date(saleData.createdAt).toLocaleString('fr-FR')}
Secteur : ${saleData.module.toUpperCase()}

*Détails des articles :*
${itemsSummary}

--------------------------------
*TOTAL PAYÉ : ${saleData.total.toLocaleString('fr-FR')} FCFA*
Règlement : ${saleData.paymentMethod.toUpperCase()}
Code Sécurité Sortie : *${saleData.securityCode}*
--------------------------------
Merci pour votre confiance !`;

    console.log(`[WHATSAPP SERVICE] Envoi de la facture à ${formattedPhone}...`);
    // Intégration API WhatsApp (Twilio / Green API / WhatsApp Business Cloud)
    /*
      await axios.post(process.env.WHATSAPP_API_URL, {
        to: formattedPhone,
        message: message
      });
    */

    return { success: true, recipient: formattedPhone };
  } catch (error) {
    console.error('[WHATSAPP SERVICE ERROR]:', error.message);
    throw error;
  }
}

module.exports = {
  sendInvoiceWhatsApp
};