/**
 * ============================================================================
 * SYA-OS — CONFIGURATION SUPABASE (config/supabase.js)
 * ============================================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// On accepte soit SUPABASE_KEY (comme sur ton Render), soit SUPABASE_ANON_KEY
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERREUR CRITIQUE : Les variables d'environnement Supabase (URL ou KEY) sont manquantes.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;