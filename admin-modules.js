// admin-modules.js — Admin: editar conteúdo (payload.modules) em JSON
(async function(){
  const $ = (id)=>document.getElementById(id);
  const log = (m)=>{ const el=$('console'); if(el){ el.style.display = m?'block':'none'; el.textContent=m||''; } };

  await window.ENGTHIVSC.initSupabase();
  await window.ENGTHIVSC_THEME?.applyTheme?.();

  const ok = await window.ENGTHIVSC.requireAdmin("admin-modules.html");
  if (!ok) return;

  await window.ENGTHIVSC.setupLogout("btnLogoutTop");
  $('adminCoursesContent').style.display = 'block';

  const sb = window.ENGTHIVSC.getSB();

  let courses = [];
  let selected = null;

  async function loadCourses(){
    const { data, error } = await sb.from("courses").select("*").order("updated_at", {ascending:false});
    if (error) return log("Erro: " + error.message);
    courses = data || [];
    renderList();
  }

  function renderList(){
    const el = $('courseList');
    if(!el) return;
    el.innerHTML = courses.map(c=>`
      <button class="listitem ${selected?.course_id===c.course_id?'is-on':''}" data-course="${esc(c.course_id)}">
        <div class="listitem__title">${esc(c.title)}</div>
        <div class="listitem__sub">${esc(c.category||'')}</div>
      </button>
    `).join('') || '<div class="empty">Nenhum curso.</div>';
  }

  function setForm(c){
    selected = c;
    $('courseId').value = c?.course_id || '';
    $('title').value = c?.title || '';
    $('subtitle').value = c?.subtitle || '';
    $('category').value = c?.category || '';
    $('coverUrl').value = c?.cover_url || '';
    const mods = c?.payload?.modules || [];
    $('modulesJson').value = JSON.stringify(mods, null, 2);
  }

  $('courseList').addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-course]');
    if(!btn) return;
    const id = btn.getAttribute('data-course');
    const c = courses.find(x=>x.course_id===id);
    if(c) setForm(c);
    renderList();
  });

  $('btnReload').addEventListener('click', loadCourses);

  $('btnNew').addEventListener('click', ()=>{
    setForm({
      course_id: 'course_' + Date.now(),
      title: 'Novo curso',
      subtitle: '',
      category: '',
      cover_url: '',
      payload: { modules: [] }
    });
    renderList();
  });

  async function uploadToAssets(file, nameHint){
    if(!file) return null;
    const ext = (file.name.split('.').pop()||'png').toLowerCase();
    const path = `covers/${Date.now()}_${(nameHint||'cover')}.${ext}`;
    const { error } = await sb.storage.from('assets').upload(path, file, { upsert:true, contentType:file.type||undefined });
    if(error) throw error;
    const { data } = sb.storage.from('assets').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  $('btnUploadCover').addEventListener('click', async ()=>{
    try{
      const file = $('coverFile')?.files?.[0];
      if(!file) return alert('Selecione uma imagem.');
      const url = await uploadToAssets(file, 'cover');
      $('coverUrl').value = url || '';
      log('Capa enviada ✅ (não esqueça de Salvar)');
    }catch(e){
      log('Erro upload: ' + (e?.message||e));
    }
  });

  $('btnSave').addEventListener('click', async ()=>{
    try{
      const course_id = ($('courseId').value||'').trim();
      if(!course_id) return log('course_id é obrigatório');
      const title = ($('title').value||'').trim();
      if(!title) return log('Título é obrigatório');

      let modules;
      try{
        modules = JSON.parse($('modulesJson').value||'[]');
        if(!Array.isArray(modules)) throw new Error('modules deve ser um array');
      }catch(e){
        return log('JSON inválido em módulos/aulas: ' + e.message);
      }

      // garante ids
      modules = modules.map((m, mi)=>{
        const lessons = (m.lessons||[]).map((l, li)=>{
          const id = (l.id||'').toString().trim() || `m${mi+1}_a${li+1}`;
          return { id, title: l.title||`Aula ${li+1}`, telegram_url: l.telegram_url||'' };
        });
        return { title: m.title||`Módulo ${mi+1}`, lessons };
      });

      const payload = { modules };

      const row = {
        course_id,
        title,
        subtitle: ($('subtitle').value||'').trim() || null,
        category: ($('category').value||'').trim() || null,
        cover_url: ($('coverUrl').value||'').trim() || null,
        payload
      };

      const { error } = await sb.from('courses').upsert(row);
      if(error) return log('Erro ao salvar: ' + error.message);

      log('Salvo ✅');
      await loadCourses();
      const c = courses.find(x=>x.course_id===course_id);
      if(c) setForm(c);
    }catch(e){
      log('Erro: ' + (e?.message||e));
    }
  });

  $('btnDelete').addEventListener('click', async ()=>{
    const course_id = ($('courseId').value||'').trim();
    if(!course_id) return;
    if(!confirm('Excluir curso ' + course_id + '?')) return;
    const { error } = await sb.from('courses').delete().eq('course_id', course_id);
    if(error) return log('Erro: ' + error.message);
    log('Excluído ✅');
    selected = null;
    setForm(null);
    await loadCourses();
  });

  $('btnSaveOrder')?.addEventListener('click', ()=>{
    alert('Ordenação por arrastar não está ativa nesta versão. Ordene ajustando updated_at (salve o curso) ou implementamos drag&drop depois.');
  });

  await loadCourses();
  if(courses[0]) setForm(courses[0]);

  function esc(s){
    return String(s??'')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
})();