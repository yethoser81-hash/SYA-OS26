const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ AVERTISSEMENT : URL ou Clé Supabase manquante dans .env. Mode mémoire/fallback actif.");
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Méthodes pour interagir avec la base de données
const db = {
  // Récupérer les produits par secteur métier
  async getProductsByModule(moduleName) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('module', moduleName);
    
    if (error) throw error;
    return data;
  },

  // Enregistrer une vente
  async saveSale(saleRecord) {
    const { data, error } = await supabase
      .from('sales')
      .insert([{
        id: saleRecord.id,
        module: saleRecord.module,
        items: saleRecord.items,
        total: saleRecord.total,
        payment_method: saleRecord.paymentMethod,
        customer_phone: saleRecord.customerPhone,
        cashier_id: saleRecord.cashierId,
        security_code: saleRecord.securityCode,
        verified_by_security: saleRecord.verifiedBySecurity
      }]);

    if (error) throw error;
    return data;
  },

  // Mettre à jour le stock après vente
  async decrementStock(items) {
    for (const item of items) {
      if (item.id) {
        const { data: prod } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (prod) {
          const newStock = Math.max(0, prod.stock - item.qty);
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.id);
        }
      }
    }
  },

  // Sauvegarder les écritures comptables
  async saveAccountingEntries(entries) {
    const formatted = entries.map(e => ({
      sale_id: e.saleId,
      account: e.account,
      label: e.label,
      debit: e.debit,
      credit: e.credit,
      analytical_axis: e.analyticalAxis
    }));

    const { data, error } = await supabase
      .from('accounting_entries')
      .insert(formatted);

    if (error) throw error;
    return data;
  },

  // Récupérer une vente par son code de sécurité
  async getSaleBySecurityCode(code) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('security_code', code)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Marquer le ticket comme vérifié à la sortie par le gardien
  async updateSaleSecurityStatus(code, verifiedStatus, verifiedAt) {
    const { data, error } = await supabase
      .from('sales')
      .update({
        verified_by_security: verifiedStatus,
        verified_at: verifiedAt
      })
      .eq('security_code', code);

    if (error) throw error;
    return data;
  }
};

module.exports = db;