/**
 * ============================================================================
 * SYA-OS — CONFIGURATION SUPABASE (config/supabase.js)
 * ============================================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERREUR CRITIQUE : Les variables d'environnement Supabase sont manquantes.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;