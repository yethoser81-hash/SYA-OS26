const express = require('express');
const router = express.Router();

// ==========================================
// 1. BASE DE DONNÉES EN MÉMOIRE (SIMULATION BDD)
// ==========================================
let dbClients = [
  { id: 1, nom: "Maman Brigitte", phone: "237699123456", carnet: "TON-884", solde: 143000, historique: [2000, 2000, 5000, 2000] },
  { id: 2, nom: "Ets Mbolo & Fils", phone: "237677889900", carnet: "EP-102", solde: 580000, historique: [25000, 50000, 10000] }
];

let dbAgents = [
  { id: "A1", nom: "Amina K.", phone: "237699001122", zone: "Marché", caisseAttendue: 520000 },
  { id: "A2", nom: "Chantal M.", phone: "237677334455", zone: "Gare", caisseAttendue: 310000 }
];

let dbTransactions = [];

// ==========================================
// 2. MOTEUR DE CALCUL : CREDIT SCORING IA
// ==========================================
function calculerCreditScore(client) {
  const nbVersements = client.historique.length;
  const totalEpargne = client.solde;
  
  // Algorithme de scoring basé sur la régularité et le volume
  let score = "C";
  let plafondCredit = 50000;

  if (totalEpargne >= 500000 && nbVersements >= 10) {
    score = "A+ (Excellent)";
    plafondCredit = totalEpargne * 2.5; // Crédit jusqu'à 250% de l'épargne
  } else if (totalEpargne >= 100000 && nbVersements >= 5) {
    score = "A (Très Bon)";
    plafondCredit = totalEpargne * 1.5;
  } else if (totalEpargne >= 30000) {
    score = "B (Régulier)";
    plafondCredit = totalEpargne * 1.0;
  }

  return { score, plafondCredit };
}

// ==========================================
// 3. API RECHERCHE BDD EN TEMPS RÉEL
// ==========================================
router.get('/api/clients/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  const results = dbClients.filter(c => 
    c.nom.toLowerCase().includes(query) || 
    c.phone.includes(query) || 
    c.carnet.toLowerCase().includes(query)
  ).map(c => {
    const scoring = calculerCreditScore(c);
    return { ...c, creditScore: scoring.score, creditMax: scoring.plafondCredit };
  });

  res.json(results);
});

// ==========================================
// 4. API ENCAISSEMENT & ENVOI AUTOMATIQUE REÇU
// ==========================================
router.post('/api/collecte/encaisser', async (req, res) => {
  const { phone, montant, agentPhone, typeOp } = req.body;

  // 1. Recherche du client
  const client = dbClients.find(c => c.phone === phone);
  if (!client) {
    return res.status(404).json({ error: "Client introuvable" });
  }

  // 2. Calcul des nouveaux soldes
  const soldeAncien = client.solde;
  const nouveauSolde = soldeAncien + parseFloat(montant);
  client.solde = nouveauSolde;
  client.historique.push(parseFloat(montant));

  // 3. Mise à jour de la caisse de l'agent
  const agent = dbAgents.find(a => a.phone === agentPhone) || dbAgents[0];
  agent.caisseAttendue += parseFloat(montant);

  // 4. Enregistrement de la transaction
  const recuNo = `REC-${Date.now().toString().slice(-6)}`;
  const transaction = {
    recuNo,
    clientName: client.nom,
    phone: client.phone,
    carnet: client.carnet,
    montant: parseFloat(montant),
    soldeAncien,
    nouveauSolde,
    agentName: agent.nom,
    date: new Date().toISOString()
  };
  dbTransactions.unshift(transaction);

  // 5. Envoi du Reçu Officiel via l'API WhatsApp
  const messageWhatsApp = `🏛️ *SYA OS — REÇU FINANCIER CERTIFIÉ*\n----------------------------------------\n📄 Reçu N° : #${recuNo}\n👤 Client : ${client.nom} (${client.carnet})\n🏃‍♀️ Agent : ${agent.nom}\n----------------------------------------\n💵 Versé ce jour : *${parseFloat(montant).toLocaleString()} FCFA*\n📊 Solde Précédent : ${soldeAncien.toLocaleString()} FCFA\n🟢 *NOUVEAU SOLDE GLOBAL : ${nouveauSolde.toLocaleString()} FCFA*\n----------------------------------------\nTransaction enregistrée avec succès.`;

  console.log(`[WHATSAPP BOT] Message envoyé à ${phone}:\n${messageWhatsApp}`);

  res.json({
    success: true,
    message: "Transaction enregistrée et reçu WhatsApp envoyé.",
    transaction,
    client
  });
});

// ==========================================
// 5. WEBHOOK ENTREE WHATSAPP (BOT TEXTE / VOCAL)
// ==========================================
// Reçoit le SMS/WhatsApp envoyé directement par l'agent depuis le marché
router.post('/api/whatsapp/webhook', async (req, res) => {
  const { senderPhone, messageText } = req.body;

  // Verification si c'est un agent autorisé
  const agent = dbAgents.find(a => a.phone === senderPhone);
  if (!agent) {
    return res.status(403).json({ error: "Numéro non autorisé comme collecteur." });
  }

  // Parsing du message : Ex: "884 2000 Epargne"
  const parts = messageText.trim().split(' ');
  const carnetCode = parts[0];
  const montant = parseFloat(parts[1]);

  const client = dbClients.find(c => c.carnet.includes(carnetCode));
  if (client && montant) {
    client.solde += montant;
    agent.caisseAttendue += montant;

    console.log(`[BOT AUTO] Cotisation de ${montant} FCFA enregistrée pour ${client.nom} via WhatsApp Agent !`);
    return res.json({ status: "OK", client: client.nom, nouveauSolde: client.solde });
  }

  res.status(400).json({ error: "Format du message invalide. Format attendu : CARNET MONTANT" });
});

// ==========================================
// 6. RAPPROCHEMENT & CLÔTURE DE CAISSE AGENT
// ==========================================
router.post('/api/caisse/rapprochement', (req, res) => {
  const { agentId, montantPhysiqueRemis } = req.body;
  const agent = dbAgents.find(a => a.id === agentId);

  if (!agent) return res.status(404).json({ error: "Agent non trouvé" });

  const ecart = parseFloat(montantPhysiqueRemis) - agent.caisseAttendue;

  res.json({
    agent: agent.nom,
    attendu: agent.caisseAttendue,
    physique: parseFloat(montantPhysiqueRemis),
    ecart: ecart,
    status: ecart === 0 ? "PARFAIT" : (ecart < 0 ? "MANQUANT CAISSE" : "EXCÉDENT")
  });
});

module.exports = router;