// index.js — lista cursos (somente logado) + favoritos + progresso + busca/filtros
(async()=>{
  const consoleEl = document.getElementById('console');
  const log = (m)=>{ if(consoleEl){ consoleEl.style.display = m ? 'block' : 'none'; consoleEl.textContent = m||''; } };

  const ok = await window.ENGTHIVSC.requireLogin('index.html');
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
  const toggleFavBtn = document.getElementById('toggleFav');

  let onlyFav = false;

  const user = await window.ENGTHIVSC.getUser();
  if (!user){
    location.href = './login.html';
    return;
  }

  // 1) carrega cursos
  const { data: courses, error } = await sb
    .from('courses')
    .select('course_id,title,subtitle,category,cover_url,created_at')
    .order('created_at', { ascending: false });

  if(error){
    log('Erro ao carregar cursos: ' + error.message);
    return;
  }

  const allCourses = courses || [];
  if(!allCourses.length){
    list.innerHTML = '<div class="meta">Nenhum curso cadastrado ainda.</div>';
    return;
  }

  // categorias
  const cats = Array.from(new Set(allCourses.map(c=>c.category).filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b)));
  if (filterCategory){
    filterCategory.innerHTML = '<option value="">Todas categorias</option>' + cats.map(c=>`<option value="${escAttr(c)}">${esc(c)}</option>`).join('');
  }

  // 2) carrega favoritos
  const favSet = new Set();
  try{
    const { data: favs } = await sb.from('favorites').select('course_id').eq('user_id', user.id);
    (favs||[]).forEach(f=>favSet.add(String(f.course_id)));
  }catch{}

  // 3) carrega progresso (watched / lesson count)
  const watchedSetByCourse = new Map();
  try{
    const { data: watched } = await sb.from('watched').select('course_id,lesson_id').eq('user_id', user.id);
    (watched||[]).forEach(w=>{
      const cid = String(w.course_id);
      if (!watchedSetByCourse.has(cid)) watchedSetByCourse.set(cid, new Set());
      watchedSetByCourse.get(cid).add(String(w.lesson_id));
    });
  }catch{}

  // lesson counts (best-effort): tenta course_lessons; se não existir, fica 0
  const lessonCountByCourse = new Map();
  try{
    const ids = allCourses.map(c=>String(c.course_id));
    // fetch lessons for these courses (can be large; ok for MVP)
    const { data: lessons, error: lErr } = await sb.from('course_lessons').select('course_id,lesson_id').in('course_id', ids);
    if (!lErr){
      (lessons||[]).forEach(l=>{
        const cid = String(l.course_id);
        lessonCountByCourse.set(cid, (lessonCountByCourse.get(cid)||0)+1);
      });
    }
  }catch{}


  // 4) last_open (para botão "Continuar")
  const lastOpenByCourse = new Map();
  try{
    const { data: lo } = await sb.from('last_open').select('course_id,last_lesson_id,opened_at').eq('user_id', user.id);
    (lo||[]).forEach(r=>lastOpenByCourse.set(String(r.course_id), r));
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

    if (onlyFav){
      filtered = filtered.filter(c => favSet.has(String(c.course_id)));
    }

    if (!filtered.length){
      list.innerHTML = '<div class="meta">Nenhum resultado.</div>';
      return;
    }

    const continueHref = (cid)=>{
      const lo = lastOpenByCourse.get(String(cid));
      if (lo?.last_lesson_id) return `./course.html?id=${encodeURIComponent(cid)}&resume=${encodeURIComponent(lo.last_lesson_id)}`;
      return `./course.html?id=${encodeURIComponent(cid)}`;
    };

        list.innerHTML = filtered.map(c=>{
      const cid = String(c.course_id);
      const title = esc(c.title||'Curso');
      const subtitle = c.subtitle ? `<div class="card__desc">${esc(c.subtitle)}</div>` : '';
      const catTxt = c.category ? `<div class="card__meta">${esc(c.category)}</div>` : '<div class="card__meta">&nbsp;</div>';
      const cover = c.cover_url ? `<img class="card__thumb" src="${escAttr(c.cover_url)}" alt="Capa" />` : '';

      const fav = favSet.has(cid);
      const pct = percentFor(cid);

      return `
        <div class="card card--click" data-open="${escAttr(cid)}">
          ${cover}
          <button class="star" data-fav="${escAttr(cid)}" aria-label="Favoritar">${fav ? '★' : '☆'}</button>
          <div class="card__title">${title}</div>
          ${catTxt}
          ${subtitle}
          <div class="progress" style="margin-top:10px;">
            <div class="progress__bar" style="width:${pct}%;"></div>
          </div>
          <div class="meta" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <span>${pct}% concluído</span>
            <a class="btn btn--ghost btn--xs" data-continue="${escAttr(cid)}" href="${continueHref(cid)}">Continuar</a>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-open]').forEach(el=>{
      el.addEventListener('click', (e)=>{
        // se clicou na estrela ou no botão continuar, não abre pelo card
        if ((e.target?.closest?.('[data-fav]')) || (e.target?.closest?.('[data-continue]'))) return;
        const cid = el.getAttribute('data-open');
        location.href = `./course.html?id=${encodeURIComponent(cid)}`;
      });
    });

    list.querySelectorAll('[data-fav]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const cid = btn.getAttribute('data-fav');
        const nowFav = await toggleFavorite(cid);
        if (nowFav) favSet.add(String(cid)); else favSet.delete(String(cid));
        render();
      });
    });
  }

  async function toggleFavorite(courseId){
    const cid = String(courseId);
    // já é favorito -> remove
    if (favSet.has(cid)){
      const { error: delErr } = await sb.from('favorites').delete().eq('user_id', user.id).eq('course_id', cid);
      if (delErr) log('Erro favoritos: ' + delErr.message);
      return false;
    }
    const { error: insErr } = await sb.from('favorites').insert({ user_id: user.id, course_id: cid });
    if (insErr) log('Erro favoritos: ' + insErr.message);
    return true;
  }

  search?.addEventListener('input', render);
  filterCategory?.addEventListener('change', render);
  toggleFavBtn?.addEventListener('click', ()=>{
    onlyFav = !onlyFav;
    toggleFavBtn.textContent = onlyFav ? '★' : '☆';
    render();
  });

  render();

  function esc(s){
    return String(s??'')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }
  function escAttr(s){
    return esc(s).replaceAll('`','');
  }
})();
