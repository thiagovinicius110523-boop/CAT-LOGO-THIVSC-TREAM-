// course.js — curso + módulos + aulas (somente logado) + progresso/favoritos/comentários
(async()=>{
  const consoleEl = document.getElementById('console');
  const log = (m)=>{ if(consoleEl){ consoleEl.style.display = m ? 'block' : 'none'; consoleEl.textContent = m||''; } };

  const ok = await window.ENGTHIVSC.requireLogin('course.html');
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

  const user = await window.ENGTHIVSC.getUser();
  if(!user){ location.href='./login.html'; return; }

  const params = new URLSearchParams(location.search);
  const courseId = params.get('course_id') || params.get('id');
  const resumeId = params.get('resume');
  if(!courseId){
    log('Abra esta página com ?id=SEU_COURSE_ID');
    return;
  }

  const { data: course, error: cErr } = await sb
    .from('courses')
    .select('*')
    .eq('course_id', courseId)
    .maybeSingle();

  if(cErr){ log('Erro ao carregar curso: ' + cErr.message); return; }
  if(!course){ log('Curso não encontrado: ' + courseId); return; }

  // topo
  const topMeta = document.getElementById('courseTopMeta');
  if(topMeta) topMeta.textContent = course.category || '—';

  // render conteúdo
  setText('courseTitle', course.title || 'Curso');
  setText('courseSubtitle', course.subtitle || '');
  setText('courseCategory', [course.category, course.subcategory, course.subsubcategory].filter(Boolean).join(' • '));

  const cover = document.getElementById('courseCover');
  if(cover){
    if(course.cover_url){
      cover.src = course.cover_url;
      cover.style.display = 'block';
    }else{
      cover.style.display = 'none';
    }
  }

  // favoritos
  const btnFav = document.getElementById('btnFav');
  let isFav = false;
  try{
    const { data: fav } = await sb.from('favorites').select('course_id').eq('user_id', user.id).eq('course_id', courseId).maybeSingle();
    isFav = !!fav;
  }catch{}
  updateFavBtn();
  btnFav?.addEventListener('click', async ()=>{
    if (isFav){
      const { error } = await sb.from('favorites').delete().eq('user_id', user.id).eq('course_id', courseId);
      if (error) return log('Erro favoritos: ' + error.message);
      isFav = false;
    } else {
      const { error } = await sb.from('favorites').insert({ user_id: user.id, course_id: courseId });
      if (error) return log('Erro favoritos: ' + error.message);
      isFav = true;
    }
    updateFavBtn();
  });

  function updateFavBtn(){
    if(!btnFav) return;
    btnFav.textContent = (isFav ? '★' : '☆') + ' Favorito';
  }

  // carregar módulos e aulas (tabelas). Se não existir, tenta payload.
  let modules = [];
  let lessons = [];

  const { data: mods, error: mErr } = await sb
    .from('course_modules')
    .select('module_id,title,subtitle,order_index,course_id')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });

  if(!mErr && mods) modules = mods;

  // tenta aulas
  try{
    const modIds = modules.map(m=>m.module_id);
    if (modIds.length){
      const { data: ls, error: lErr } = await sb
        .from('course_lessons')
        .select('lesson_id,module_id,title,telegram_url,order_index,course_id')
        .eq('course_id', courseId)
        .in('module_id', modIds)
        .order('order_index', { ascending: true });
      if (!lErr && ls) lessons = ls;
    }
  }catch{}

  // fallback payload
  if(!modules.length && course.payload?.modules){
    modules = course.payload.modules.map((m, idx)=>({
      module_id: m.id || `payload_${idx}`,
      title: m.title || `Módulo ${idx+1}`,
      subtitle: m.subtitle || '',
      order_index: idx
    }));
    lessons = [];
    course.payload.modules.forEach((m, midx)=>{
      (m.lessons||[]).forEach((a, aidx)=>{
        lessons.push({
          lesson_id: a.id || `p_${midx}_${aidx}`,
          module_id: modules[midx].module_id,
          title: a.title || `Aula ${aidx+1}`,
          telegram_url: a.telegram_url || '',
          order_index: aidx
        });
      });
    });
  }

  const list = document.getElementById('modulesList');
  if(!list) return;

  if(!modules.length){
    list.innerHTML = '<div class="meta">Nenhum módulo cadastrado ainda.</div>';
    return;
  }

  // watched
  const watched = new Set();
  try{
    const { data: w } = await sb.from('watched').select('lesson_id').eq('user_id', user.id).eq('course_id', courseId);
    (w||[]).forEach(r=>watched.add(String(r.lesson_id)));
  }catch{}

  // comments map
  const comments = new Map();
  try{
    const { data: cs } = await sb.from('comments').select('lesson_id,content').eq('user_id', user.id).eq('course_id', courseId);
    (cs||[]).forEach(r=>comments.set(String(r.lesson_id), r.content||''));
  }catch{}

  function calcProgress(){
    const total = lessons.length;
    const done = watched.size;
    const pct = total ? Math.round((done/total)*100) : 0;
    const bar = document.getElementById('progressBar');
    const txt = document.getElementById('progressText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = `${pct}% (${done}/${total})`;
  }

  calcProgress();

  // render
  list.innerHTML = modules.map(m=>{
    const mid = String(m.module_id);
    const title = esc(m.title||'Módulo');
    const subtitle = m.subtitle ? `<div class="meta" style="margin-top:6px;">${esc(m.subtitle)}</div>` : '';
    const ls = lessons.filter(a=>String(a.module_id)===mid);

    const lessonsHtml = ls.map(a=>{
      const lid = String(a.lesson_id);
      const done = watched.has(lid);
      const telegram = a.telegram_url ? `<a class="btn btn--ghost" data-telegram="${escAttr(lid)}" href="${escAttr(a.telegram_url)}" target="_blank" rel="noopener">Abrir no Telegram</a>` : '';
      const c = comments.get(lid) || '';
      return `
        <div class="lesson" data-lesson="${escAttr(lid)}" data-openlesson="${escAttr(lid)}">
          <div class="lesson__row">
            <button class="chk" data-toggle="${escAttr(lid)}" aria-label="Marcar assistida">${done ? '✅' : '⬜'}</button>
            <div style="flex:1;">
              <div class="lesson__title">${esc(a.title||'Aula')}</div>
              <div class="meta">ID: ${esc(lid)}</div>
            </div>
            ${telegram}
          </div>
          <div class="lesson__comment">
            <textarea class="input" data-comment="${escAttr(lid)}" rows="2" placeholder="Comentário (privado)">${esc(c)}</textarea>
            <div style="display:flex;gap:10px;margin-top:8px;justify-content:flex-end;">
              <button class="btn btn--ghost" data-savecomment="${escAttr(lid)}">Salvar comentário</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="panel" style="padding:14px;">
        <div style="font-weight:800;">${title}</div>
        ${subtitle}
        <div class="divider"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 12px;">
          <button class="btn btn--ghost" data-markall="${escAttr(mid)}">Marcar todas</button>
          <button class="btn btn--ghost" data-unmarkall="${escAttr(mid)}">Desmarcar todas</button>
        </div>
        ${ls.length ? lessonsHtml : '<div class="meta">Nenhuma aula cadastrada neste módulo.</div>'}
      </div>
    `;
  }).join('');

  // handlers toggle watched
  list.querySelectorAll('[data-toggle]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const lid = btn.getAttribute('data-toggle');
      const has = watched.has(String(lid));
      if (has){
        const { error } = await sb.from('watched').delete().eq('user_id', user.id).eq('course_id', courseId).eq('lesson_id', lid);
        if (error) return log('Erro watched: ' + error.message);
        watched.delete(String(lid));
        btn.textContent = '⬜';
      } else {
        const { error } = await sb.from('watched').insert({ user_id: user.id, course_id: courseId, lesson_id: lid });
        if (error) return log('Erro watched: ' + error.message);
        watched.add(String(lid));
        btn.textContent = '✅';
      }
      calcProgress();
    });
  });

  // handlers save comment
  list.querySelectorAll('[data-savecomment]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const lid = btn.getAttribute('data-savecomment');
      const ta = list.querySelector(`[data-comment="${cssEsc(lid)}"]`);
      const content = (ta?.value||'').trim();

      // upsert: precisa de constraint unique (user_id, course_id, lesson_id) ou faremos delete/insert
      // tentamos upsert; se falhar, fallback
      const payload = { user_id: user.id, course_id: courseId, lesson_id: lid, content };
      let ok = true;
      try{
        const { error } = await sb.from('comments').upsert(payload, { onConflict: 'user_id,course_id,lesson_id' });
        if (error) throw error;
      }catch(err){
        ok = false;
        // fallback: delete then insert
        const { error: delErr } = await sb.from('comments').delete().eq('user_id', user.id).eq('course_id', courseId).eq('lesson_id', lid);
        if (delErr) return log('Erro comment: ' + delErr.message);
        const { error: insErr } = await sb.from('comments').insert(payload);
        if (insErr) return log('Erro comment: ' + insErr.message);
        ok = true;
      }

      if (ok){
        comments.set(String(lid), content);
        log('Comentário salvo ✅');
      }
    });
  });

  
  // marcar/desmarcar todas em um módulo (batch simples)
  list.querySelectorAll('[data-markall]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const mid = btn.getAttribute('data-markall');
      const ls = lessons.filter(a=>String(a.module_id)===String(mid));
      const toAdd = ls.filter(a=>!watched.has(String(a.lesson_id))).map(a=>({ user_id: user.id, course_id: courseId, lesson_id: String(a.lesson_id) }));
      if (!toAdd.length) return;
      const { error } = await sb.from('watched').insert(toAdd);
      if (error) return log('Erro watched: ' + error.message);
      toAdd.forEach(r=>watched.add(String(r.lesson_id)));
      // atualiza checks visíveis
      ls.forEach(a=>{
        const lid = String(a.lesson_id);
        const b = list.querySelector(`[data-toggle="${cssEsc(lid)}"]`);
        if (b) b.textContent = '✅';
      });
      calcProgress();
    });
  });

  list.querySelectorAll('[data-unmarkall]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const mid = btn.getAttribute('data-unmarkall');
      const ls = lessons.filter(a=>String(a.module_id)===String(mid));
      const ids = ls.map(a=>String(a.lesson_id));
      if (!ids.length) return;
      const { error } = await sb.from('watched')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .in('lesson_id', ids);
      if (error) return log('Erro watched: ' + error.message);
      ids.forEach(id=>watched.delete(String(id)));
      ls.forEach(a=>{
        const lid = String(a.lesson_id);
        const b = list.querySelector(`[data-toggle="${cssEsc(lid)}"]`);
        if (b) b.textContent = '⬜';
      });
      calcProgress();
    });
  });

  // ao clicar para abrir aula no Telegram, salva "última aula" para continuar depois
  list.querySelectorAll('[data-telegram]').forEach(a=>{
    a.addEventListener('click', async ()=>{
      const lid = a.getAttribute('data-telegram');
      try{
        await sb.from('last_open').upsert({
          user_id: user.id,
          course_id: courseId,
          last_lesson_id: lid,
          opened_at: new Date().toISOString()
        }, { onConflict: 'user_id,course_id' });
      }catch{}
    });
  });

  // resume: rola até a aula indicada
  if (resumeId){
    const target = list.querySelector(`[data-openlesson="${cssEsc(resumeId)}"]`);
    if (target){
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('lesson--highlight');
      setTimeout(()=>target.classList.remove('lesson--highlight'), 2500);
    }
  }

// last_open best-effort
  try{
    await sb.from('last_open').upsert({ user_id: user.id, course_id: courseId, opened_at: new Date().toISOString() }, { onConflict: 'user_id,course_id' });
  }catch{}

  function setText(id, v){
    const el = document.getElementById(id);
    if (el) el.textContent = v ?? '';
  }

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
  function cssEsc(s){
    return String(s).replaceAll('\\','\\\\').replaceAll('"','\\"');
  }
})();
