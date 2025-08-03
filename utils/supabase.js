const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erro: SUPABASE_URL ou SUPABASE_ANON_KEY não definidos no .env');
  process.exit(1); // Encerra o processo se as variáveis não estiverem configuradas
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;