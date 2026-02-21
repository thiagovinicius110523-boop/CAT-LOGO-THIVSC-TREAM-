# ENTHIVSC STREAM — Site (2 páginas) + Supabase

## Arquivos
- index.html (catálogo)
- course.html (curso)
- data/courses.json (conteúdo)
- supabase-config.js (colar URL/ANON KEY)
- app.js (core)
- index.js, course.js

## Rodar local
Recomendado para evitar bloqueio do fetch do JSON:

### Python
python -m http.server 8000
Abra: http://localhost:8000

## Conectar no Supabase
Abra supabase-config.js e cole:
window.SUPABASE_URL = "https://xxxx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOi...";

## Próximo
Depois a gente cria o script Telethon para gerar data/courses.json automaticamente do Telegram.


## Importante (ajustes feitos nesta versão)
- Adicionado `supabase-config.js` (preencha URL e ANON KEY).
- `app.js` agora inclui helpers usados pelo Admin (`initSupabase`, `getSB`, `getUser`, `requireLogin`, `isAdmin`).
- Corrigido `admin-courses.js` para usar `course_id` (não `id`).
- Adicionado SQL de migração recomendado: `sql/V5_migration.sql`.
- Adicionado workflow do GitHub Pages: `.github/workflows/pages.yml`.
