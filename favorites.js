// favorites.js — lista favoritos (somente logado) + progresso + busca/filtros + continuar
(async()=>{
  const consoleEl = document.getElementById('console');
  const log = (m)=>{ if(consoleEl){ consoleEl.style.display = m ? 'block' : 'none'; consoleEl.textContent = m||''; } };

  const ok = await window.ENGTHIVSC.requireLogin('favorites.html');
  if(!ok) return;

  await window.ENGTHIVSC.setupLogout();
  await window.ENGTHIVSC.applyUserUI();

  const app = document.getElementById('appContent');
  if(app) app.style.display = 'block';

  const sb = window.ENGTHIVSC.getSB();
  if(!sb){
    log('Supabase não inicializou. Verifique supabase-config.js');
    return;
  }

  const list = document.getElementById('coursesList');
  const search = document.getElementById('search');
  const filterCategory = document.getElementById('filterCategory');
  const sortBy = document.getElementById('sortBy');

  const user = await window.ENGTHIVSC.getUser();
  if (!user){ location.href='./login.html'; return; }

  // favoritos
  const favSet = new Set();
  const { data: favs, error: fErr } = await sb.from('favorites').select('course_id').eq('user_id', user.id);
  if (fErr){ log('Erro favoritos: ' + fErr.message); return; }
  (favs||[]).forEach(f=>favSet.add(String(f.course_id)));

  if (!favSet.size){
    list.innerHTML = '<div class="meta">Você ainda não favoritou nenhum curso.</div>';
    return;
  }

  // cursos
  const favIds = Array.from(favSet);
  const { data: courses, error } = await sb
    .from('courses')
    .select('course_id,title,subtitle,category,subcategory,subsubcategory,cover_url,created_at')
    .in('course_id', favIds);

  if (error){ log('Erro ao carregar cursos: ' + error.message); return; }

  const allCourses = (courses||[]).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));

  // categorias
  const cats = Array.from(new Set(allCourses.map(c=>c.category).filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b)));
  if (filterCategory){
    filterCategory.innerHTML = '<option value="">Todas categorias</option>' + cats.map(c=>`<option value="${escAttr(c)}">${esc(c)}</option>`).join('');
  }

  // watched
  const watchedSetByCourse = new Map();
  try{
    const { data: watched } = await sb.from('watched').select('course_id,lesson_id').eq('user_id', user.id).in('course_id', favIds);
    (watched||[]).forEach(w=>{
      const cid = String(w.course_id);
      if (!watchedSetByCourse.has(cid)) watchedSetByCourse.set(cid, new Set());
      watchedSetByCourse.get(cid).add(String(w.lesson_id));
    });
  }catch{}

  // lesson counts
  const lessonCountByCourse = new Map();
  try{
    const { data: lessons, error: lErr } = await sb.from('course_lessons').select('course_id,lesson_id').in('course_id', favIds);
    if (!lErr){
      (lessons||[]).forEach(l=>{
        const cid = String(l.course_id);
        lessonCountByCourse.set(cid, (lessonCountByCourse.get(cid)||0)+1);
      });
    }
  }catch{}

  // last_open (para continuar)
  const lastOpenByCourse = new Map();
  try{
    const { data: lo } = await sb.from('last_open').select('course_id,last_lesson_id,opened_at').eq('user_id', user.id);
    (lo||[]).forEach(r=> lastOpenByCourse.set(String(r.course_id), r));
  }catch{}

  function percentFor(courseId){
    const cid = String(courseId);
    const total = lessonCountByCourse.get(cid) || 0;
    if (!total) return 0;
    const done = watchedSetByCourse.get(cid)?.size || 0;
    return Math.max(0, Math.min(100, Math.round((done/total)*100)));
  }

  function render(){
    const q = (search?.value||'').trim().toLowerCase();
    const cat = (filterCategory?.value||'').trim();
    const sort = (sortBy?.value||'recent');

    let filtered = allCourses.slice();

    if (q){
      filtered = filtered.filter(c =>
        String(c.title||'').toLowerCase().includes(q) ||
        String(c.subtitle||'').toLowerCase().includes(q) ||
        String(c.category||'').toLowerCase().includes(q)
      );
    }
    if (cat){
      filtered = filtered.filter(c => String(c.category||'') === cat);
    }

    if (sort === 'az'){
      filtered.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
    } else if (sort === 'progress'){
      filtered.sort((a,b)=> percentFor(b.course_id) - percentFor(a.course_id));
    } else {
      filtered.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    }

    if (!filtered.length){
      list.innerHTML = '<div class="meta">Nenhum resultado.</div>';
      return;
    }

    list.innerHTML = filtered.map(c=>{
      const cid = String(c.course_id);
      const title = esc(c.title||'Curso');
      const subtitle = c.subtitle ? `<div class="card__desc">${esc(c.subtitle)}</div>` : '';
      const catTxt = [c.category,c.subcategory,c.subsubcategory].filter(Boolean).join(' • ');
      const meta = catTxt ? `<div class="card__meta">${esc(catTxt)}</div>` : '<div class="card__meta">&nbsp;</div>';
      const cover = c.cover_url ? `<img class="card__thumb" src="${escAttr(c.cover_url)}" alt="Capa" />` : '';

      const pct = percentFor(cid);
      const lo = lastOpenByCourse.get(cid);
      const continueTo = lo?.last_lesson_id ? `./course.html?id=${encodeURIComponent(cid)}&resume=${encodeURIComponent(lo.last_lesson_id)}` : `./course.html?id=${encodeURIComponent(cid)}`;

      return `
        <div class="card">
          ${cover}
          <div class="card__title">${title}</div>
          ${meta}
          ${subtitle}
          <div class="progress" style="margin-top:10px;">
            <div class="progress__bar" style="width:${pct}%;"></div>
          </div>
          <div class="meta" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <span>${pct}% concluído</span>
            <a class="btn btn--ghost" href="${continueTo}">Continuar</a>
          </div>
        </div>
      `;
    }).join('');
  }

  search?.addEventListener('input', render);
  filterCategory?.addEventListener('change', render);
  sortBy?.addEventListener('change', render);

  render();

  function esc(s){
    return String(s??'')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
  function escAttr(s){ return esc(s).replaceAll('`',''); }
})();
