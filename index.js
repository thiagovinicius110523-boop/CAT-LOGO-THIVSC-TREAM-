// index.js — Catálogo (somente logado) + favoritos + continuar assistindo
(async ()=>{
  const consoleEl = document.getElementById('console');
  const log = (m)=>{ if(consoleEl){ consoleEl.style.display = m ? 'block':'none'; consoleEl.textContent = m||''; } };

  await window.ENGTHIVSC.initSupabase();

  const ok = await window.ENGTHIVSC.requireLogin('index.html');
  if(!ok) return;

  await window.ENGTHIVSC.setupLogout();
  await window.ENGTHIVSC.applyUserUI();

  const app = document.getElementById('appContent');
  if(app) app.style.display = 'block';

  const sb = window.ENGTHIVSC.getSB();
  if(!sb){ log('Supabase não inicializou. Verifique supabase-config.js'); return; }

  // Carrega cursos + favoritos do usuário
  const [{ data: courses, error: e1 }, { data: favs, error: e2 }, { data: last, error: e3 }] = await Promise.all([
    sb.from('courses').select('course_id,title,subtitle,category,cover_url,updated_at').order('updated_at', {ascending:false}),
    sb.from('favorites').select('course_id'),
    sb.from('last_open').select('course_id,lesson_id,updated_at').order('updated_at', {ascending:false})
  ]);

  if(e1){ log('Erro ao carregar cursos: ' + e1.message); return; }
  if(e2){ /* ignore */ }
  if(e3){ /* ignore */ }

  const favSet = new Set((favs||[]).map(x=>x.course_id));
  const lastMap = new Map((last||[]).map(x=>[x.course_id, x]));

  const list = document.getElementById('coursesList');
  if(!list) return;

  if(!(courses||[]).length){
    list.innerHTML = '<div class="empty">Nenhum curso cadastrado.</div>';
    return;
  }

  list.innerHTML = (courses||[]).map(c=>{
    const fav = favSet.has(c.course_id);
    const cont = lastMap.get(c.course_id);
    const contHtml = cont ? `<div class="muted">Continuar: <a class="link" href="./course.html?id=${encodeURIComponent(c.course_id)}&lesson=${encodeURIComponent(cont.lesson_id)}">${escapeHtml(cont.lesson_id)}</a></div>` : '';
    return `
      <div class="card">
        <div class="card__cover">
          ${c.cover_url ? `<img src="${escapeHtml(c.cover_url)}" alt="Capa" />` : `<div class="card__cover--empty"></div>`}
          <button class="iconbtn ${fav ? 'is-on':''}" data-fav="${escapeHtml(c.course_id)}" title="Favorito">★</button>
        </div>
        <div class="card__body">
          <div class="card__title">${escapeHtml(c.title||'Curso')}</div>
          ${c.subtitle ? `<div class="card__sub">${escapeHtml(c.subtitle)}</div>` : ''}
          ${c.category ? `<div class="muted">Categoria: ${escapeHtml(c.category)}</div>` : ''}
          ${contHtml}
          <div style="margin-top:12px;">
            <a class="btn" href="./course.html?id=${encodeURIComponent(c.course_id)}">Abrir</a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Favoritos
  list.addEventListener('click', async (ev)=>{
    const btn = ev.target?.closest?.('[data-fav]');
    if(!btn) return;
    ev.preventDefault();

    const course_id = btn.getAttribute('data-fav');
    const isOn = btn.classList.contains('is-on');

    if(isOn){
      const { error } = await sb.from('favorites').delete().eq('course_id', course_id);
      if(!error){ btn.classList.remove('is-on'); }
    }else{
      const { error } = await sb.from('favorites').insert({ course_id });
      if(!error){ btn.classList.add('is-on'); }
    }
  });

  function escapeHtml(str){
    return String(str??'')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }
})();