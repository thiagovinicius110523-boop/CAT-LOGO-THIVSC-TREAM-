/**
 * app.js — helpers globais ENTHIVSC (MASTER)
 * Tudo via window.ENGTHIVSC (evita conflitos de versões).
 */
(function(){
  let sb = null;
  let cachedProfile = null;

  function basePath(){
    // "/REPO/" em GitHub Pages ou "/" em domínio próprio
    const parts = location.pathname.split("/").filter(Boolean);
    if (location.hostname.endsWith("github.io") && parts.length >= 1) return "/" + parts[0] + "/";
    return "/";
  }

  function appBase(){
    // opcional: override manual
    if (window.APP_BASE_URL) return window.APP_BASE_URL.replace(/\/?$/, "/");
    return location.origin + basePath();
  }

  function rel(url){
    // sempre relativo ao diretório atual (evita 404 por nome de repo)
    url = (url || "").replace(/^\/+/, "");
    return "./" + url;
  }

  async function initSupabase(){
    if (sb) return sb;
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    if (!window.supabase?.createClient) return null;
    sb = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
      { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }
    );
    return sb;
  }

  function getSB(){ return sb; }

  async function getUser(){
    await initSupabase();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user || null;
  }

  async function getProfile(force=false){
    if (cachedProfile && !force) return cachedProfile;
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await sb.from("profiles").select("user_id,username,display_name,avatar_url,role").eq("user_id", user.id).maybeSingle();
    if (error) return null;
    cachedProfile = data || null;
    return cachedProfile;
  }

  async function requireLogin(currentPage){
    const user = await getUser();
    if (!user){
      const rt = encodeURIComponent(currentPage || (location.pathname.split("/").pop() || "index.html"));
      location.href = rel("login.html") + "?returnTo=" + rt;
      return false;
    }
    return true;
  }

  async function isAdmin(){
    const p = await getProfile();
    return p?.role === "admin";
  }

  async function requireAdmin(currentPage){
    const ok = await requireLogin(currentPage);
    if (!ok) return false;
    const admin = await isAdmin();
    if (!admin){
      location.href = rel("index.html");
      return false;
    }
    return true;
  }

  async function setupLogout(btnId="btnLogout"){
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.style.display = "inline-flex";
    btn.addEventListener("click", async ()=>{
      await initSupabase();
      await sb.auth.signOut();
      cachedProfile = null;
      location.href = rel("login.html");
    });
  }

  function safeText(el, txt){
    if (!el) return;
    el.textContent = txt || "";
  }

  async function applyUserUI(){
    // mostra avatar/nome/role e botão admin se aplicável
    const chip = document.getElementById("userChip");
    const img = document.getElementById("userAvatar");
    const nameEl = document.getElementById("userName");
    const roleEl = document.getElementById("userRole");
    const adminBtn = document.getElementById("btnAdmin");

    const p = await getProfile(true);
    if (!p){
      if (chip) chip.style.display = "none";
      if (adminBtn) adminBtn.style.display = "none";
      return;
    }

    if (chip) chip.style.display = "flex";
    const display = p.display_name || p.username || "Usuário";
    safeText(nameEl, display);
    safeText(roleEl, p.role === "admin" ? "admin" : "user");

    if (img){
      img.src = p.avatar_url || "./default-avatar.png";
      img.onerror = ()=>{ img.src = "./default-avatar.png"; };
    }

    if (adminBtn){
      const ok = p.role === "admin";
      adminBtn.style.display = ok ? "inline-flex" : "none";
      if (ok){
        adminBtn.onclick = ()=> location.href = rel("admin.html");
      }
    }
  }

  // Helpers de curso (payload)
    window.ENGTHIVSC = window.ENGTHIVSC || {};
  Object.assign(window.ENGTHIVSC, {
    initSupabase, getSB, getUser, getProfile,
    requireLogin, requireAdmin, isAdmin,
    setupLogout, applyUserUI,
    appBase, rel
  });
})();