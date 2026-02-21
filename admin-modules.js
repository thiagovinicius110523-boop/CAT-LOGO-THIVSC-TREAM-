(async function(){
  await window.ENGTHIVSC.initSupabase();
  await window.ENGTHIVSC_THEME?.applyTheme?.();

  const ok = await window.ENGTHIVSC.requireLogin("admin-modules.html");
  if (!ok) return;

  await window.ENGTHIVSC_PRESENCE?.startPresence?.();

  const isAdmin = await window.ENGTHIVSC.isAdmin();
  if (!isAdmin){
    location.href = "./index.html";
    return;
  }

  const sb = window.ENGTHIVSC.getSB();
  const consoleEl = document.getElementById("console");
  const log = (m)=>{ if (consoleEl) consoleEl.textContent = m||""; };

  document.getElementById("adminCoursesContent").style.display = "";

  // logout
  document.getElementById("btnLogoutTop")?.addEventListener("click", async ()=>{
    await sb.auth.signOut();
    location.href = "./login.html?returnTo=admin-modules.html";
  });

  // elements
  const courseList = document.getElementById("courseList");
  const btnSaveOrder = document.getElementById("btnSaveOrder");
  const btnReload = document.getElementById("btnReload");

  const courseId = document.getElementById("courseId");
  const title = document.getElementById("title");
  const category = document.getElementById("category");
  const subtitle = document.getElementById("subtitle");
  const coverUrl = document.getElementById("coverUrl");
  const coverFile = document.getElementById("coverFile");
  const btnUploadCover = document.getElementById("btnUploadCover");
  const modulesJson = document.getElementById("modulesJson");
  const btnSave = document.getElementById("btnSave");
  const btnDelete = document.getElementById("btnDelete");
  const btnNew = document.getElementById("btnNew");

  let courses = [];
  let draggingId = null;

  async function loadCourses(){
    const { data, error } = await sb.from("courses").select("*").order("created_at", {ascending:false});
    if (error) throw error;
    courses = (data||[]).map(c => ({...c, modules: c.modules || c.course_modules || []}));
  }

  function renderList(){
    courseList.innerHTML = courses.map(c => {
      const cover = c.cover_url ? `<img src="${c.cover_url}" style="width:42px;height:42px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,.08)" />` : `<div style="width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;color:var(--muted);">—</div>`;
      return `<div class="chip chip--action" draggable="true" data-id="${c.course_id}" style="width:100%; justify-content:space-between;">
        <span style="display:flex; gap:10px; align-items:center; min-width:0;">
          ${cover}
          <span style="display:flex; flex-direction:column; min-width:0;">
            <span style="font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.title||c.course_id}</span>
            <span style="font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.category||""}</span>
          </span>
        </span>
        <span style="color:var(--muted); font-size:12px;">↕</span>
      </div>`;
    }).join("");

    // drag events
    courseList.querySelectorAll("[draggable=true]").forEach(el=>{
      el.addEventListener("dragstart", ()=>{ draggingId = el.dataset.id; el.style.opacity="0.6"; });
      el.addEventListener("dragend", ()=>{ draggingId = null; el.style.opacity="1"; });
      el.addEventListener("dragover", (e)=>{ e.preventDefault(); });
      el.addEventListener("drop", (e)=>{
        e.preventDefault();
        const targetId = el.dataset.id;
        if (!draggingId || draggingId === targetId) return;
        const from = courses.findIndex(x=>x.course_id===draggingId);
        const to = courses.findIndex(x=>x.course_id===targetId);
        if (from<0 || to<0) return;
        const [item] = courses.splice(from,1);
        courses.splice(to,0,item);
        renderList();
      });

      el.addEventListener("click", ()=>{
        const id = el.dataset.id;
        const c = courses.find(x=>x.course_id===id);
        if (c) loadEditor(c);
      });
    });
  }

  function loadEditor(c){
    courseId.value = c.course_id || "";
    title.value = c.title || "";
    category.value = c.category || "";
    subtitle.value = c.subtitle || "";
    coverUrl.value = c.cover_url || "";
    modulesJson.value = JSON.stringify(c.modules || [], null, 2);
    log("Editando: " + (c.title || c.course_id));
  }

  btnNew.addEventListener("click", ()=>{
    courseId.value = "";
    title.value = "";
    category.value = "";
    subtitle.value = "";
    coverUrl.value = "";
    modulesJson.value = "[]";
    log("Novo curso: preencha e clique Salvar.");
  });

  btnUploadCover.addEventListener("click", async ()=>{
    try{
      const cid = courseId.value.trim();
      if (!cid) return log("Defina o course_id antes de enviar capa.");
      const f = coverFile.files?.[0];
      if (!f) return log("Selecione um arquivo de imagem.");

      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `covers/${cid}/cover.${ext}`;

      const up = await sb.storage.from("assets").upload(path, f, { upsert:true, contentType:f.type||"image/jpeg", cacheControl:"3600" });
      if (up.error) throw up.error;

      const pub = sb.storage.from("assets").getPublicUrl(path);
      const url = pub?.data?.publicUrl || "";
      coverUrl.value = url;

      // salva no registro
      const { error } = await sb.from("courses").upsert({ course_id: cid, cover_url: url }, { onConflict:"course_id" });
      if (error) throw error;

      await loadCourses();
      renderList();
      log("Capa enviada ✅");
    }catch(err){
      log("ERRO upload capa: " + (err?.message || err));
    }
  });

  btnSave.addEventListener("click", async ()=>{
    try{
      const cid = courseId.value.trim();
      if (!cid) return log("course_id é obrigatório.");

      let mods = [];
      try{ mods = JSON.parse(modulesJson.value || "[]"); }catch{ return log("JSON inválido em módulos/aulas."); }
      if (!Array.isArray(mods)) return log("Módulos deve ser uma lista (array) JSON.");

      const payload = {
        course_id: cid,
        title: title.value.trim(),
        category: category.value.trim(),
        subtitle: subtitle.value.trim(),
        cover_url: coverUrl.value.trim(),
        modules: mods
      };

      const { error } = await sb.from("courses").upsert(payload, { onConflict:"course_id" });
      if (error) throw error;

      await loadCourses();
      renderList();

      // se não existe ordem salva, salva agora
      const order = courses.map(c=>c.course_id);
      await window.ENGTHIVSC.setSiteSetting("course_order", order);

      log("Curso salvo ✅");
    }catch(err){
      log("ERRO salvar: " + (err?.message || err));
    }
  });

  btnDelete.addEventListener("click", async ()=>{
    try{
      const cid = courseId.value.trim();
      if (!cid) return;

      const { error } = await sb.from("courses").delete().eq("course_id", cid);
      if (error) throw error;

      await loadCourses();
      renderList();

      const order = courses.map(c=>c.course_id);
      await window.ENGTHIVSC.setSiteSetting("course_order", order);

      log("Curso excluído ✅");
    }catch(err){
      log("ERRO excluir: " + (err?.message || err));
    }
  });

  btnSaveOrder.addEventListener("click", async ()=>{
    try{
      const order = courses.map(c=>c.course_id);
      await window.ENGTHIVSC.setSiteSetting("course_order", order);
      log("Ordem salva ✅");
    }catch(err){
      log("ERRO salvar ordem: " + (err?.message || err));
    }
  });

  btnReload.addEventListener("click", async ()=>{
    try{
      await loadCourses();
      renderList();
      log("Recarregado ✅");
    }catch(err){
      log("ERRO reload: " + (err?.message || err));
    }
  });

  // init
  try{
    await loadCourses();
    renderList();
    // carrega a ordem salva, se existir
    const order = await window.ENGTHIVSC.getSiteSetting("course_order");
    if (Array.isArray(order) && order.length){
      const map = new Map(courses.map(c=>[c.course_id,c]));
      const ordered = [];
      order.forEach(id=>{ if (map.has(id)) ordered.push(map.get(id)); map.delete(id); });
      // adiciona novos cursos no final
      map.forEach(v=>ordered.push(v));
      courses = ordered;
      renderList();
    }
    log("Pronto ✅");
  }catch(err){
    log("ERRO init: " + (err?.message || err));
  }
})();