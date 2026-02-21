// dashboard.js — KPIs + continuar de onde parou (last_open)
(async()=>{
  const consoleEl = document.getElementById('console');
  const log = (m)=>{ if(consoleEl){ consoleEl.style.display = m ? 'block' : 'none'; consoleEl.textContent = m||''; } };

  const ok = await window.ENGTHIVSC.requireLogin('dashboard.html');
  if(!ok) return;

  await window.ENGTHIVSC.setupLogout();
  await window.ENGTHIVSC.applyUserUI();

  const app = document.getElementById('appContent');
  if(app) app.style.display = 'block';

  const sb = window.ENGTHIVSC.getSB();
  if(!sb){ log('Supabase não inicializou. Verifique supabase-config.js'); return; }

  const user = await window.ENGTHIVSC.getUser();
  if(!user){ location.href='./login.html'; return; }

  const kDone = document.getElementById('kpiDone');
  const kDoing = document.getElementById('kpiDoing');
  const kFav = document.getElementById('kpiFav');
  const cont = document.getElementById('continueList');

  // favoritos
  const { data: favs } = await sb.from('favorites').select('course_id').eq('user_id', user.id);
  const favSet = new Set((favs||[]).map(f=>String(f.course_id)));
  if (kFav) kFav.textContent = String(favSet.size);

  // last_open
  const { data: lo, error: loErr } = await sb.from('last_open').select('course_id,last_lesson_id,opened_at').eq('user_id', user.id).order('opened_at', {ascending:false}).limit(12);
  if (loErr){ log('Erro last_open: ' + loErr.message); }

  const courseIds = Array.from(new Set((lo||[]).map(r=>String(r.course_id))));
  if (!courseIds.length){
    cont.innerHTML = '<div class="meta">Nenhuma atividade recente ainda.</div>';
    if (kDone) kDone.textContent = '0';
    if (kDoing) kDoing.textContent = '0';
    return;
  }

  const { data: courses } = await sb.from('courses').select('course_id,title,subtitle,category,cover_url').in('course_id', courseIds);
  const byId = new Map((courses||[]).map(c=>[String(c.course_id), c]));

  // progresso
  const lessonCountByCourse = new Map();
  try{
    const { data: lessons } = await sb.from('course_lessons').select('course_id,lesson_id').in('course_id', courseIds);
    (lessons||[]).forEach(l=>{
      const cid = String(l.course_id);
      lessonCountByCourse.set(cid, (lessonCountByCourse.get(cid)||0)+1);
    });
  }catch{}
  const watchedSetByCourse = new Map();
  try{
    const { data: watched } = await sb.from('watched').select('course_id,lesson_id').eq('user_id', user.id).in('course_id', courseIds);
    (watched||[]).forEach(w=>{
      const cid = String(w.course_id);
      if (!watchedSetByCourse.has(cid)) watchedSetByCourse.set(cid, new Set());
      watchedSetByCourse.get(cid).add(String(w.lesson_id));
    });
  }catch{}

  function pct(cid){
    const total = lessonCountByCourse.get(cid)||0;
    if (!total) return 0;
    const done = watchedSetByCourse.get(cid)?.size || 0;
    return Math.round((done/total)*100);
  }

  let doneCount=0, doingCount=0;
  courseIds.forEach(cid=>{
    const p = pct(cid);
    if (p>=100) doneCount++;
    else if (p>0) doingCount++;
  });
  if (kDone) kDone.textContent = String(doneCount);
  if (kDoing) kDoing.textContent = String(doingCount);

  cont.innerHTML = (lo||[]).map(r=>{
    const cid = String(r.course_id);
    const c = byId.get(cid);
    if (!c) return '';
    const p = pct(cid);
    const title = esc(c.title||'Curso');
    const meta = esc(c.category||'');
    const cover = c.cover_url ? `<img class="card__thumb" src="${escAttr(c.cover_url)}" alt="Capa" />` : '';
    const resume = r.last_lesson_id ? `./course.html?id=${encodeURIComponent(cid)}&resume=${encodeURIComponent(r.last_lesson_id)}` : `./course.html?id=${encodeURIComponent(cid)}`;
    const fav = favSet.has(cid);

    return `
      <div class="card">
        ${cover}
        <div class="card__title">${title}</div>
        <div class="card__meta">${meta}${fav ? ' • ★' : ''}</div>
        <div class="progress" style="margin-top:10px;"><div class="progress__bar" style="width:${p}%;"></div></div>
        <div class="meta" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <span>${p}%</span>
          <a class="btn btn--ghost" href="${resume}">Continuar</a>
        </div>
      </div>
    `;
  }).join('') || '<div class="meta">Nenhuma atividade recente.</div>';

  function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
  function escAttr(s){return esc(s).replaceAll('`','');}
})();
