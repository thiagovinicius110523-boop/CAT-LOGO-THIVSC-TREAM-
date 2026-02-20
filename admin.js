(async function(){
  await window.ENGTHIVSC.initSupabase();
  await window.ENGTHIVSC_THEME?.applyTheme?.();

  const ok = await window.ENGTHIVSC.requireLogin("admin.html");
  if (!ok) return;

  await window.ENGTHIVSC_PRESENCE?.startPresence?.();

  const sb = window.ENGTHIVSC.getSB();
  const consoleEl = document.getElementById("console");
  const log = (m)=>{ if (consoleEl) consoleEl.textContent = m||""; };

  // só admin
  const adm = await window.ENGTHIVSC.isAdmin();
  if (!adm){
    location.href = "./index.html";
    return;
  }

  document.getElementById("adminContent").style.display = "";

  // logout
  async function doLogout(){
    await sb.auth.signOut();
    location.href = "./login.html?returnTo=admin.html";
  }
  document.getElementById("btnLogoutTop")?.addEventListener("click", doLogout);
  document.getElementById("btnLogout")?.addEventListener("click", doLogout);

  // ---------- Whitelist ----------
  const newEmail = document.getElementById("newEmail");
  const btnAddEmail = document.getElementById("btnAddEmail");
  const btnReload = document.getElementById("btnReload");
  const allowedMeta = document.getElementById("allowedMeta");
  const allowedList = document.getElementById("allowedList");

  async function loadAllowed(){
    const { data, error } = await sb.from("allowed_users").select("id,email,created_at").order("created_at", {ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function renderAllowed(){
    const list = await loadAllowed();
    if (allowedMeta) allowedMeta.textContent = `${list.length} autorizado(s)`;
    if (!allowedList) return;

    allowedList.innerHTML = list.map(row => `
      <span class="chip" style="gap:10px;">
        <span>${row.email}</span>
        <button class="pill" data-del="${row.id}">Remover</button>
      </span>
    `).join("");

    allowedList.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        try{
          const id = btn.getAttribute("data-del");
          const { error } = await sb.from("allowed_users").delete().eq("id", id);
          if (error) throw error;
          await renderAllowed();
          log("Removido ✅");
        }catch(err){
          log("ERRO remover: " + (err?.message || err));
        }
      });
    });
  }

  btnAddEmail?.addEventListener("click", async ()=>{
    try{
      const email = (newEmail?.value || "").trim().toLowerCase();
      if (!email) return log("Digite um e-mail.");
      const { error } = await sb.from("allowed_users").insert({ email });
      if (error) throw error;
      newEmail.value = "";
      await renderAllowed();
      log("Adicionado ✅");
    }catch(err){
      log("ERRO add: " + (err?.message || err));
    }
  });

  btnReload?.addEventListener("click", async ()=>{
    try{ await renderAllowed(); log("Recarregado ✅"); }catch(err){ log("ERRO reload: " + (err?.message || err)); }
  });

  // ---------- Theme (site_settings key=theme) ----------
  const logoUrl = document.getElementById("logoUrl");
const accent = document.getElementById("accent");
  const accent2 = document.getElementById("accent2");
  const bg = document.getElementById("bg");
  const text = document.getElementById("text");
  const themeMeta = document.getElementById("themeMeta");
  const btnPreviewTheme = document.getElementById("btnPreviewTheme");
  const btnSaveTheme = document.getElementById("btnSaveTheme");
  const btnResetTheme = document.getElementById("btnResetTheme");

  const logoFile = document.getElementById("logoFile");
    const loginBgFile = document.getElementById("loginBgFile");
  const appBgFile = document.getElementById("appBgFile");
  const btnUploadBgs = document.getElementById("btnUploadBgs");
const btnUploadLogo = document.getElementById("btnUploadLogo");
function readThemeFromForm(){
    return {
      logo_url: (logoUrl?.value || "").trim(),
      bg_app_url: (current.bg_app_url || ""),
            bg_login_url: (current.bg_login_url || ""),
      accent: (accent?.value || "").trim(),
      accent2: (accent2?.value || "").trim(),
      bg: (bg?.value || "").trim(),
      text: (text?.value || "").trim(),
    };
  }

  async function loadTheme(){
    const t = await window.ENGTHIVSC.getSiteSetting("theme");
    const merged = { ...(window.ENGTHIVSC_THEME?.DEFAULT_THEME||{}), ...(t||{}) };
    if (themeMeta) themeMeta.textContent = "Tema: carregado";

    if (logoUrl) logoUrl.value = merged.logo_url || "";    if (accent) accent.value = merged.accent || "";
    if (accent2) accent2.value = merged.accent2 || "";
    if (bg) bg.value = merged.bg || "";
    if (text) text.value = merged.text || "";

    return merged;
  }

  btnPreviewTheme?.addEventListener("click", ()=>{
    const t = { ...(window.ENGTHIVSC_THEME?.DEFAULT_THEME||{}), ...readThemeFromForm() };
    window.ENGTHIVSC_THEME?.applyCSSVars?.(t);
    log("Prévia aplicada (somente nesta aba).");
  });

  btnSaveTheme?.addEventListener("click", async ()=>{
    try{
      const t = { ...(window.ENGTHIVSC_THEME?.DEFAULT_THEME||{}), ...readThemeFromForm() };
      await window.ENGTHIVSC.setSiteSetting("theme", t);
      window.ENGTHIVSC_THEME?.saveLocalTheme?.(t);
      window.ENGTHIVSC_THEME?.applyCSSVars?.(t);
      if (themeMeta) themeMeta.textContent = "Tema: salvo ✅";
      log("Tema salvo ✅");
    }catch(err){
      log("ERRO salvar tema: " + (err?.message || err));
    }
  });

  btnResetTheme?.addEventListener("click", async ()=>{
    try{
      const t = window.ENGTHIVSC_THEME?.DEFAULT_THEME || {};
      await window.ENGTHIVSC.setSiteSetting("theme", t);
      window.ENGTHIVSC_THEME?.saveLocalTheme?.(t);
      window.ENGTHIVSC_THEME?.applyCSSVars?.(t);
      await loadTheme();
      log("Tema resetado ✅");
    }catch(err){
      log("ERRO reset: " + (err?.message || err));
    }
  });

  async function uploadToAssets(path, file){
    const up = await sb.storage.from("assets").upload(path, file, { upsert:true, contentType:file.type||"image/jpeg", cacheControl:"3600" });
    if (up.error) throw up.error;
    const pub = sb.storage.from("assets").getPublicUrl(path);
    return pub?.data?.publicUrl || "";
  }

  btnUploadLogo?.addEventListener("click", async ()=>{
    try{
      const f = logoFile?.files?.[0];
      if (!f) return log("Selecione um arquivo para Logo.");
      const ext = (f.name.split(".").pop() || "png").toLowerCase();
      const url = await uploadToAssets(`theme/logo_1500.${ext}`, f);
      if (logoUrl) logoUrl.value = url;
      log("Logo enviada ✅ (1500x1500 recomendado)");
    }catch(err){
      log("ERRO upload logo: " + (err?.message || err));
    }
  });

  // Upload fundos separados (Login / App)
  btnUploadBgs?.addEventListener("click", async ()=>{
    try{
      const fLogin = loginBgFile?.files?.[0] || null;
      const fApp   = appBgFile?.files?.[0] || null;

      if (!fLogin && !fApp) return log("Selecione pelo menos 1 imagem: Fundo LOGIN ou Fundo APP.");

      // carrega tema atual (para não apagar outros campos)
      const current = (await window.ENGTHIVSC_THEME?.getTheme?.()) || {};

      if (fLogin){
        const ext = (fLogin.name.split(".").pop() || "jpg").toLowerCase();
        const url = await uploadToAssets(`theme/bg_login.${ext}`, fLogin);
        current.bg_login_url = url;
      }
      if (fApp){
        const ext = (fApp.name.split(".").pop() || "jpg").toLowerCase();
        const url = await uploadToAssets(`theme/bg_app.${ext}`, fApp);
        current.bg_app_url = url;
      }

      // salva no site_settings(key='theme')
      await window.ENGTHIVSC_THEME?.saveTheme?.(current);

      log("Fundos enviados ✅ (Login e/ou App).");
      await window.ENGTHIVSC_THEME?.applyTheme?.();
      await renderThemeMeta?.();
    }catch(err){
      log("ERRO upload fundos: " + (err?.message || err));
    }
  });


  
  // ---------- Online users ----------
  const btnReloadOnline = document.getElementById("btnReloadOnline");
  const onlineMeta = document.getElementById("onlineMeta");
  const onlineList = document.getElementById("onlineList");

  async function renderOnline(){
    const rows = await window.ENGTHIVSC_PRESENCE?.listOnline?.() || [];
    if (onlineMeta) onlineMeta.textContent = `${rows.length} online (últimos 2 min)`;

    // tenta buscar perfis (precisa policy admin_select em profiles)
    const ids = rows.map(r=>r.user_id);
    let profiles = [];
    if (ids.length){
      const { data } = await sb.from("profiles").select("*").in("user_id", ids);
      profiles = data || [];
    }
    const map = new Map(profiles.map(p=>[p.user_id,p]));

    if (onlineList){
      onlineList.innerHTML = rows.map(r=>{
        const p = map.get(r.user_id) || {};
        const nm = p.username || p.display_name || r.user_id.slice(0,8);
        const av = p.avatar_url || "./default-avatar.png";
        const when = new Date(r.last_seen).toLocaleString();
        return `<span class="chip" style="gap:10px;">
          <img src="${av}" style="width:34px;height:34px;border-radius:999px;object-fit:cover;border:1px solid rgba(255,255,255,.10)" />
          <span style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-weight:800;">${nm}</span>
            <span style="font-size:12px;color:var(--muted);">${when}</span>
          </span>
        </span>`;
      }).join("");
    }
  }

  btnReloadOnline?.addEventListener("click", async ()=>{
    try{ await renderOnline(); log("Online atualizado ✅"); }catch(err){ log("ERRO online: " + (err?.message||err)); }
  });

  // init
  try{
    await renderAllowed();
    await loadTheme();
    await renderOnline();
    log("Admin pronto ✅");
  }catch(err){
    log("ERRO init: " + (err?.message || err));
  }
})();