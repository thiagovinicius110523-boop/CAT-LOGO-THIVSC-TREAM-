(async function(){
  await window.ENGTHIVSC.initSupabase();
  await window.ENGTHIVSC_THEME?.applyTheme?.();

  const ok = await window.ENGTHIVSC.requireLogin("admin.html");
  if (!ok) return;

  await window.ENGTHIVSC.applyUserUI?.();

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
    // tenta tabela canonical: allowed_emails
    try{
      const { data, error } = await sb.from("allowed_emails").select("email,created_at").order("created_at", {ascending:false});
      if (!error) return data || [];
    }catch{}
    // fallback: allowed_users (projetos antigos)
    const { data, error } = await sb.from("allowed_users").select("email,created_at").order("created_at", {ascending:false});
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
        <button class="pill" data-del="${row.email}">Remover</button>
      </span>
    `).join("");

    allowedList.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        try{
          const id = btn.getAttribute("data-del");
                    let error = null;
          try{
            const r1 = await sb.from("allowed_emails").delete().eq("email", id);
            error = r1.error || null;
            if (!error) {}
          }catch{}
          if (error){
            const r2 = await sb.from("allowed_users").delete().eq("email", id);
            error = r2.error || null;
          }

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
            let error = null;
      try{
        const r1 = await sb.from("allowed_emails").insert({ email });
        error = r1.error || null;
      }catch{}
      if (error){
        const r2 = await sb.from("allowed_users").insert({ email });
        error = r2.error || null;
      }

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
  let currentTheme = {};

function readThemeFromForm(){
    return {
      logo_url: (logoUrl?.value || "").trim(),
      bg_app_url: (currentTheme.bg_app_url || ""),
      bg_login_url: (currentTheme.bg_login_url || ""),
      accent: (accent?.value || "").trim(),
      accent2: (accent2?.value || "").trim(),
      bg: (bg?.value || "").trim(),
      text: (text?.value || "").trim(),
    };
  }

  async function loadTheme(){
    const t = await window.ENGTHIVSC.getSiteSetting("theme");
    const merged = { ...(window.ENGTHIVSC_THEME?.DEFAULT_THEME||{}), ...(t||{}) };
    currentTheme = merged;
    if (themeMeta) themeMeta.textContent = "Tema: carregado";

    if (logoUrl) logoUrl.value = merged.logo_url || "";    if (accent) accent.value = merged.accent || "";
    if (accent2) accent2.value = merged.accent2 || "";
    if (bg) bg.value = merged.bg || "";
    if (text) text.value = merged.text || "";

    return merged;
  }


  // ===== V10 PRIME: presets + aviso global + suporte Telegram =====
  const presetGrid = document.getElementById("presetGrid");

  const THEME_PRESETS = [
    { name:"Neon Dark", theme:{ accent:"#4df2c7", accent2:"#66a8ff", bg:"#0b0f17", text:"#e7eefc" } },
    { name:"Ocean", theme:{ accent:"#22c1ff", accent2:"#7c4dff", bg:"#07131c", text:"#e8f4ff" } },
    { name:"Sunset", theme:{ accent:"#ff5d8f", accent2:"#ffcc66", bg:"#120b14", text:"#fff1f6" } },
    { name:"Minimal Light", theme:{ accent:"#2a6cf6", accent2:"#00a884", bg:"#f5f7fb", text:"#101828" } },
    { name:"Steel", theme:{ accent:"#5eead4", accent2:"#94a3b8", bg:"#0b1220", text:"#e5e7eb" } },
    { name:"Purple Night", theme:{ accent:"#a78bfa", accent2:"#22d3ee", bg:"#0b0720", text:"#f5f3ff" } },
    { name:"Amber", theme:{ accent:"#fbbf24", accent2:"#60a5fa", bg:"#0f0e0b", text:"#fff7ed" } },
    { name:"Forest", theme:{ accent:"#34d399", accent2:"#a3e635", bg:"#07120b", text:"#ecfdf5" } },
  ];

  function applyPreset(p){
    const t = { ...(currentTheme||{}), ...(p.theme||{}) };
    if (accent) accent.value = t.accent || "";
    if (accent2) accent2.value = t.accent2 || "";
    if (bg) bg.value = t.bg || "";
    if (text) text.value = t.text || "";
    currentTheme = t;
    window.ENGTHIVSC_THEME?.applyCSSVars?.(t);
    log("Preset aplicado: " + p.name + " ✅ (clique em Salvar tema)");
  }

  function renderPresets(){
    if (!presetGrid) return;
    presetGrid.innerHTML = THEME_PRESETS.map((p, idx)=>{
      const c1 = p.theme.accent || "#000";
      const c2 = p.theme.accent2 || "#000";
      const c3 = p.theme.bg || "#000";
      const c4 = p.theme.text || "#000";
      return `
        <div class="preset-card" data-idx="${idx}">
          <div class="preset-name">${p.name}</div>
          <div class="preset-swatches">
            <span class="preset-swatch" style="background:${c1}"></span>
            <span class="preset-swatch" style="background:${c2}"></span>
            <span class="preset-swatch" style="background:${c3}"></span>
            <span class="preset-swatch" style="background:${c4}"></span>
          </div>
        </div>
      `;
    }).join("");
    presetGrid.querySelectorAll(".preset-card").forEach(el=>{
      el.addEventListener("click", ()=>{
        const idx = Number(el.dataset.idx||0);
        applyPreset(THEME_PRESETS[idx]);
      });
    });
  }

  // Aviso global (announcements)
  const annTitle = document.getElementById("annTitle");
  const annSeverity = document.getElementById("annSeverity");
  const annMessage = document.getElementById("annMessage");
  const annStarts = document.getElementById("annStarts");
  const annEnds = document.getElementById("annEnds");
  const btnSaveAnnouncement = document.getElementById("btnSaveAnnouncement");
  const btnDisableAnnouncement = document.getElementById("btnDisableAnnouncement");
  let currentAnnId = null;

  function toLocalInputValue(iso){
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function toIsoFromLocal(v){
    if (!v) return null;
    const d = new Date(v);
    return d.toISOString();
  }

  async function loadAnnouncement(){
    try{
      const { data, error } = await sb
        .from("announcements")
        .select("id,title,message,severity,starts_at,ends_at,is_active,created_at")
        .order("created_at", {ascending:false})
        .limit(1);
      if (error) return;
      const a = data?.[0];
      if (!a) return;
      currentAnnId = a.id;
      if (annTitle) annTitle.value = a.title || "";
      if (annSeverity) annSeverity.value = a.severity || "info";
      if (annMessage) annMessage.value = a.message || "";
      if (annStarts) annStarts.value = toLocalInputValue(a.starts_at) || "";
      if (annEnds) annEnds.value = toLocalInputValue(a.ends_at) || "";
    }catch(e){}
  }

  btnSaveAnnouncement?.addEventListener("click", async ()=>{
    try{
      const payload = {
        title: (annTitle?.value || "").trim() || "Aviso",
        message: (annMessage?.value || "").trim() || "",
        severity: (annSeverity?.value || "info").trim(),
        starts_at: toIsoFromLocal(annStarts?.value) || new Date().toISOString(),
        ends_at: toIsoFromLocal(annEnds?.value),
        is_active: true
      };
      let q;
      if (currentAnnId){
        q = sb.from("announcements").update(payload).eq("id", currentAnnId);
      }else{
        q = sb.from("announcements").insert(payload).select("id").single();
      }
      const { data, error } = await q;
      if (error) return log("ERRO aviso: " + error.message);
      if (!currentAnnId && data?.id) currentAnnId = data.id;
      await window.ENGTHIVSC.applyGlobalUI?.();
      log("Aviso salvo ✅");
    }catch(err){
      log("ERRO aviso: " + (err?.message||err));
    }
  });

  btnDisableAnnouncement?.addEventListener("click", async ()=>{
    try{
      if (!currentAnnId) return log("Nenhum aviso para desativar.");
      const { error } = await sb.from("announcements").update({ is_active:false }).eq("id", currentAnnId);
      if (error) return log("ERRO desativar: " + error.message);
      await window.ENGTHIVSC.applyGlobalUI?.();
      log("Aviso desativado ✅");
    }catch(err){
      log("ERRO desativar: " + (err?.message||err));
    }
  });

  // Botão suporte Telegram (site_settings.support_telegram)
  const tgSupportUrl = document.getElementById("tgSupportUrl");
  const tgSupportText = document.getElementById("tgSupportText");
  const tgSupportEnabled = document.getElementById("tgSupportEnabled");
  const btnSaveSupport = document.getElementById("btnSaveSupport");

  async function loadSupport(){
    const cfg = await window.ENGTHIVSC.getSiteSetting?.("support_telegram");
    if (tgSupportUrl) tgSupportUrl.value = cfg?.url || "";
    if (tgSupportText) tgSupportText.value = cfg?.text || "Suporte - Clique aqui";
    if (tgSupportEnabled) tgSupportEnabled.value = String(cfg?.enabled !== false);
  }

  btnSaveSupport?.addEventListener("click", async ()=>{
    try{
      const cfg = {
        url: (tgSupportUrl?.value || "").trim(),
        text: (tgSupportText?.value || "").trim() || "Suporte - Clique aqui",
        enabled: (tgSupportEnabled?.value || "true") === "true"
      };
      const { error } = await window.ENGTHIVSC.setSiteSetting?.("support_telegram", cfg);
      if (error) return log("ERRO suporte: " + error.message);
      await window.ENGTHIVSC.applyGlobalUI?.();
      log("Suporte Telegram salvo ✅");
    }catch(err){
      log("ERRO suporte: " + (err?.message||err));
    }
  });

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
    renderPresets();
    await loadAnnouncement();
    await loadSupport();
    await renderOnline();
    log("Admin pronto ✅");
  }catch(err){
    log("ERRO init: " + (err?.message || err));
  }
})();