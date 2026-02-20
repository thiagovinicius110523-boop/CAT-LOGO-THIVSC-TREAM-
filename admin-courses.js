(async function(){
  await window.ENGTHIVSC.initSupabase();

  const consoleEl = document.getElementById("console");
  const setConsole = (m) => { if (consoleEl) consoleEl.textContent = m || ""; };

  const ok = await window.ENGTHIVSC.requireLogin("admin-courses.html");
  if (!ok) return;

  const sb = window.ENGTHIVSC.getSB();

  const adm = await window.ENGTHIVSC.isAdmin();
  if (!adm){
    setConsole("Acesso negado: apenas admin.");
    location.href = "./index.html";
    return;
  }

  document.getElementById("adminCoursesContent").style.display = "";


  // logout
  document.getElementById("btnLogoutTop")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    const base = location.pathname.replace(/\\/[^\\/]*$/, "/");
    location.href = location.origin + base + "login.html?returnTo=" + encodeURIComponent("admin-courses.html");
  });

  const q = document.getElementById("q");
  const rows = document.getElementById("rows");
  const meta = document.getElementById("meta");
  const saveMeta = document.getElementById("saveMeta");
  const btnReload = document.getElementById("btnReload");
  const btnSaveAll = document.getElementById("btnSaveAll");

  let courses = [];
  const dirty = new Map(); // course_id -> {category, subcategory, subsubcategory}

  async function loadCourses(){
    meta.textContent = "Carregando cursos...";
    const { data, error } = await sb
      .from("courses")
      .select("course_id, title, category, subcategory, subsubcategory")
      .order("title", { ascending: true });

    if (error){
      setConsole("ERRO: " + error.message);
      meta.textContent = "Erro ao carregar.";
      return;
    }
    courses = data || [];
    meta.textContent = `${courses.length} curso(s) carregados.`;
    render();
  }

  function render(){
    const text = (q.value||"").trim().toLowerCase();
    const filtered = !text ? courses : courses.filter(c => (c.title||"").toLowerCase().includes(text));

    rows.innerHTML = filtered.map(c => {
      const d = dirty.get(String(c.course_id));
      const cat = d?.category ?? (c.category||"");
      const sub = d?.subcategory ?? (c.subcategory||"");
      const sub2 = d?.subsubcategory ?? (c.subsubcategory||"");

      return `
        <tr data-id="${c.course_id}">
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.06);">
            <div style="font-weight:800;">${escapeHtml(c.title||"Sem título")}</div>
            <div class="meta">ID: ${c.course_id}</div>
          </td>

          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.06);">
            <input class="input" style="height:38px;" data-field="category" value="${escapeAttr(cat)}" placeholder="Ex: Engenharia Civil" />
          </td>

          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.06);">
            <input class="input" style="height:38px;" data-field="subcategory" value="${escapeAttr(sub)}" placeholder="Ex: Estruturas" />
          </td>

          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.06);">
            <input class="input" style="height:38px;" data-field="subsubcategory" value="${escapeAttr(sub2)}" placeholder="Ex: TQS" />
          </td>

          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.06);">
            <button class="btn btn--ghost" style="height:38px;" data-saveone="1">Salvar</button>
          </td>
        </tr>
      `;
    }).join("");

    rows.querySelectorAll("tr").forEach(tr => {
      const id = tr.getAttribute("data-id");

      tr.querySelectorAll("input[data-field]").forEach(inp => {
        inp.addEventListener("input", () => {
          const field = inp.getAttribute("data-field");
          const v = inp.value.trim();
          const base = dirty.get(id) || {};
          dirty.set(id, { ...base, [field]: v });
          saveMeta.textContent = `${dirty.size} curso(s) com alteração pendente.`;
        });
      });

      tr.querySelector("[data-saveone]")?.addEventListener("click", async () => {
        await saveOne(id);
      });
    });

    saveMeta.textContent = dirty.size ? `${dirty.size} curso(s) com alteração pendente.` : "Nenhuma alteração ainda.";
  }

  async function saveOne(id){
    const payload = dirty.get(id);
    if (!payload){
      setConsole("Nada para salvar neste curso.");
      return;
    }

    setConsole("Salvando curso " + id + "...");
    const { error } = await sb.from("courses").update({
      category: payload.category ?? null,
      subcategory: payload.subcategory ?? null,
      subsubcategory: payload.subsubcategory ?? null
    }).eq("course_id", id);

    if (error){
      setConsole("ERRO: " + error.message);
      return;
    }

    const idx = courses.findIndex(c => String(c.course_id) === String(id));
    if (idx >= 0){
      courses[idx].category = payload.category ?? null;
      courses[idx].subcategory = payload.subcategory ?? null;
      courses[idx].subsubcategory = payload.subsubcategory ?? null;
    }

    dirty.delete(id);
    setConsole("Salvo ✅");
    render();
  }

  btnSaveAll?.addEventListener("click", async () => {
    if (!dirty.size){
      setConsole("Nenhuma alteração para salvar.");
      return;
    }
    setConsole("Salvando tudo...");
    for (const id of Array.from(dirty.keys())){
      await saveOne(id);
    }
    setConsole("Tudo salvo ✅");
  });

  btnReload?.addEventListener("click", loadCourses);
  q?.addEventListener("input", render);

  function escapeHtml(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }
  function escapeAttr(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll('"',"&quot;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  await loadCourses();
})();
