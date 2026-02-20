/**
 * supabase-config.js
 * Preencha com os dados do seu projeto Supabase:
 *  - SUPABASE_URL (Project Settings > API)
 *  - SUPABASE_ANON_KEY (Project Settings > API)
 *
 * Dica: o anon key é público (vai para o front). Não use service_role aqui.
 */
window.SUPABASE_URL = window.SUPABASE_URL || "https://SEU-PROJETO.supabase.co";
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "SUA_ANON_KEY_AQUI";

/**
 * APP_BASE_URL (opcional)
 * Use quando estiver em GitHub Pages com subpasta, ex:
 * https://usuario.github.io/REPO/
 */
window.APP_BASE_URL = window.APP_BASE_URL || (location.origin + location.pathname.replace(/\/[^\/]*$/, "/"));
