// course.js — exibe módulos/aulas via courses.payload + watched + last_open + comentários
(async ()=>{
  const consoleEl = document.getElementById('console');
  const log = (m)=>{ if(consoleEl){ consoleEl.style.display = m ? 'block':'none'; consoleEl.textContent = m||''; } };

  await window.ENGTHIVSC.initSupabase();
  const ok = await window.ENGTHIVSC.requireLogin('course.html');
  if(!ok) return;

  await window.ENGTHIVSC.setupLogout();
  await window.ENGTHIVSC.applyUserUI();

  const app = document.getElementById('appContent');
  if(app) app.style.display = 'block';

  const sb = window.ENGTHIVSC.getSB();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const focusLesson = params.get('lesson');

  if(!id){ log('Curso inválido (sem id).'); return; }

  const { data: course, error } = await sb.from('courses').select('*').eq('course_id', id).maybeSingle();
  if(error){ log('Erro ao carregar curso: ' + error.message); return; }
  if(!course){ log('Curso não encontrado.'); return; }

  // watched + comments do usuário
  const lessonIds = [];
  const modules = (course.payload && course.payload.modules) ? course.payload.modules : [];
  for(const m of modules){
    for(const l of (m.lessons||[])){
      if(l?.id) lessonIds.push(String(l.id));
    }
  }

  const [{ data: watched }, { data: comments }] = await Promise.all([
    lessonIds.length ? sb.from('watched').select('lesson_id,watched').in('lesson_id', lessonIds) : Promise.resolve({data:[]}),
    lessonIds.length ? sb.from('comments').select('lesson_id,text,updated_at').in('lesson_id', lessonIds) : Promise.resolve({data:[]}),
  ]);
  const watchedSet = new Set((watched||[]).filter(x=>x.watched).map(x=>x.lesson_id));
  const commentMap = new Map((comments||[]).map(x=>[x.lesson_id, x]));

  // Render
  const titleEl = document.getElementById('courseTitle');
  const subEl = document.getElementById('courseSubtitle');
  const coverEl = document.getElementById('courseCover');
  const modulesEl = document.getElementById('modules');

  if(titleEl) titleEl.textContent = course.title;
  if(subEl) subEl.textContent = course.subtitle || '';
  if(coverEl){
    if(course.cover_url){
      coverEl.innerHTML = `<img src="${esc(course.cover_url)}" alt="Capa" />`;
    }else{
      coverEl.innerHTML = '';
    }
  }

  if(!modulesEl) return;

  if(!modules.length){
    modulesEl.innerHTML = '<div class="empty">Sem módulos cadastrados ainda.</div>';
    return;
  }

  modulesEl.innerHTML = modules.map((m, mi)=>{
    const lessons = (m.lessons||[]);
    const lessonsHtml = lessons.map((l, li)=>{
      const lid = String(l.id || `m${mi+1}_a${li+1}`);
      const isWatched = watchedSet.has(lid);
      const cm = commentMap.get(lid);
      return `
        <div class="lesson" id="lesson_${escId(lid)}" data-lesson="${esc(lid)}" data-url="${esc(l.telegram_url||'')}">
          <div class="lesson__meta">
            <div style="font-weight:700">${esc(l.title || ('Aula ' + (li+1)))}</div>
            <div class="muted" style="font-size:12px">${esc(lid)}</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <span class="badge ${isWatched?'is-on':''}" data-badge="${esc(lid)}">${isWatched?'Assistida':'Não assistida'}</span>
              <button class="btn btn--ghost" data-open="${esc(lid)}">Abrir no Telegram</button>
            </div>
            <div style="margin-top:10px">
              <textarea class="input" rows="2" style="width:100%" placeholder="Comentário (visível só para você)" data-comment="${esc(lid)}">${cm?esc(cm.text):''}</textarea>
              <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
                <button class="btn" data-savecomment="${esc(lid)}">Salvar comentário</button>
                <span class="muted" style="font-size:12px" data-cstatus="${esc(lid)}"></span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="module">
        <div style="font-weight:900;font-size:16px">${esc(m.title || ('Módulo ' + (mi+1)))}</div>
        ${m.description ? `<div class="muted" style="margin-top:6px">${esc(m.description)}</div>` : ''}
        ${lessonsHtml}
      </div>
    `;
  }).join('');

  // handlers
  modulesEl.addEventListener('click', async (ev)=>{
    const openBtn = ev.target.closest('[data-open]');
    if(openBtn){
      const lid = openBtn.getAttribute('data-open');
      const row = modulesEl.querySelector(`[data-lesson="${cssEsc(lid)}"]`);
      const url = row?.getAttribute('data-url') || '';
      if(!url){ alert('Sem link do Telegram nesta aula.'); return; }

      // marca watched + last_open
      await sb.from('watched').upsert({ lesson_id: lid, watched: true });
      await sb.from('last_open').upsert({ course_id: id, lesson_id: lid });

      watchedSet.add(lid);
      const badge = modulesEl.querySelector(`[data-badge="${cssEsc(lid)}"]`);
      if(badge){
        badge.classList.add('is-on');
        badge.textContent = 'Assistida';
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const saveBtn = ev.target.closest('[data-savecomment]');
    if(saveBtn){
      const lid = saveBtn.getAttribute('data-savecomment');
      const ta = modulesEl.querySelector(`[data-comment="${cssEsc(lid)}"]`);
      const status = modulesEl.querySelector(`[data-cstatus="${cssEsc(lid)}"]`);
      const txt = (ta?.value||'').trim();
      const { error } = await sb.from('comments').upsert({ lesson_id: lid, text: txt });
      if(status){
        status.textContent = error ? ('Erro: ' + error.message) : 'Salvo ✅';
        setTimeout(()=>{ status.textContent=''; }, 2000);
      }
      return;
    }
  });

  // foco
  if(focusLesson){
    const el = document.getElementById('lesson_' + escId(focusLesson));
    if(el){
      el.scrollIntoView({ behavior:'smooth', block:'center' });
      el.style.outline = '2px solid rgba(77,242,199,.65)';
      setTimeout(()=>{ el.style.outline=''; }, 2000);
    }
  }

  function esc(s){
    return String(s??'')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
  function escId(s){ return String(s??'').replace(/[^a-zA-Z0-9_\-]/g,'_'); }
  function cssEsc(s){ return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/"/g,'\\"'); }
})();