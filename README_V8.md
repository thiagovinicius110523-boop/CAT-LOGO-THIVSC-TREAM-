# ENTHIVSC STREAM — V8 (Master)

## O que muda na V8
- Corrige whitelist: usa `allowed_emails` + RPC `is_email_allowed`
- Corrige RLS de `comments` (insert/upsert)
- Implementa favoritos clicáveis (index + curso)
- Implementa marcar/desmarcar aulas assistidas e progresso
- Adiciona busca + filtro por categoria + filtro "só favoritos"
- Adiciona página `profile.html` (avatar + nome)
- Avatar atualiza no topo (cache-busting)

## Supabase
Execute `SUPABASE_V8_PATCH.sql` no SQL Editor.

## Storage
Crie o bucket `assets` e marque como **Public**.

## GitHub Pages
Deploy from a branch → main → /(root).

