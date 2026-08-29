const { createClient } = require('@supabase/supabase-js');

const hasSupabaseConfig = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!hasSupabaseConfig) {
  console.warn('Supabase is not configured. File-storage routes will return a configuration error.');
}

const supabase = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

module.exports = supabase;
