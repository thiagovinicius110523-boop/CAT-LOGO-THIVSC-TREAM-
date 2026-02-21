ENGTHIVSC STREAM — Pacote v4

1) Suba TODOS os arquivos deste zip para seu GitHub Pages (mesma pasta).
2) Em supabase-config.js coloque SUPABASE_URL, SUPABASE_ANON_KEY e APP_BASE_URL.
3) No Supabase SQL Editor rode: sql/V4_patch.sql
   - Se você já tinha uma tabela site_settings com colunas diferentes, ela será renomeada para site_settings_old_v4.

4) No Storage do Supabase:
   - Crie bucket: assets (Public = true).
   - Crie/ajuste policies conforme comentado no SQL (assets_*). 
     *User avatar usa path: avatars/<user_id>/avatar.ext*
     *Admin usa: theme/* e covers/*

5) Admin:
   - /admin.html (whitelist + aparência + online)
   - /admin-modules.html (CRUD cursos + capa + ordem drag & drop)

Obs:
- Tema v4 salva em site_settings key='theme'. O login tenta carregar do Supabase; se não houver policy pública, ele usa o último tema salvo no localStorage.
