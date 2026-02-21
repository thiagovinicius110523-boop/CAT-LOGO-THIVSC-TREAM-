ENGTHIVSC STREAM — V5 (Admin categorias/subcategorias)

Inclui:
- admin-courses.html
- admin-courses.js
- Link "Cursos" no admin.html

Supabase (SQL) necessário:
1) Colunas (se não existirem):
   alter table public.courses add column if not exists category text;
   alter table public.courses add column if not exists subcategory text;
   alter table public.courses add column if not exists subsubcategory text;

2) Policies (se ainda não fez):
   alter table public.courses enable row level security;

   drop policy if exists "courses_read_all" on public.courses;
   create policy "courses_read_all"
   on public.courses for select to public using (true);

   drop policy if exists "courses_write_admin" on public.courses;
   create policy "courses_write_admin"
   on public.courses for all to authenticated
   using (
     exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin')
   )
   with check (
     exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin')
   );

Como usar:
- Login como admin → Admin → Cursos → editar → Salvar.
