// public/js/supabase.js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_ANON_KEY_PUBLICA";

const FUNCTION_UPSERT_CHAMADO = "upsert-chamado";
const FUNCTION_REPLACE_ITENS = "replace-chamado-itens";
const FUNCTION_DELETE_CHAMADO = "delete-chamado";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);