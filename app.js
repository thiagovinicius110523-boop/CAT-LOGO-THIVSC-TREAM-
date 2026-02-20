/**
 * app.js — helpers globais ENTHIVSC
 * Mantém compatibilidade com as funções antigas (requireAuth/setupLogout)
 * e adiciona utilitários usados pelo Admin (initSupabase/getSB/getUser/requireLogin/isAdmin).
 */
(function(){
  let sb = null;

  async function initSupabase(){
    if (sb) return sb;
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    if (!window.supabase?.createClient) return null;
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return sb;
  }

  function getSB(){
    return sb;
  }

  async function getUser(){
    await initSupabase();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user || null;
  }

  async function requireAuth(){
    await initSupabase();
    if (!sb) return { ok: true }; // permite modo "sem supabase"
    const u = await getUser();
    if (!u){
      location.href = "./login.html";
      return { ok: false };
    }
    return { ok: true };
  }

  async function requireLogin(returnTo){
    await initSupabase();
    if (!sb) return true;
    const u = await getUser();
    if (!u){
      const rt = encodeURIComponent(returnTo || "index.html");
      location.href = "./login.html?returnTo=" + rt;
      return false;
    }
    return true;
  }

  async function setupLogout(){
    const b = document.getElementById("btnLogout");
    if (!b) return;
    await initSupabase();
    if (!sb) return;
    const u = await getUser();
    if (u) b.style.display = "inline-flex";
    b.onclick = async ()=>{
      await sb.auth.signOut();
      location.href = "./login.html";
    };
  }

  async function isAdmin(){
    await initSupabase();
    if (!sb) return false;
    const u = await getUser();
    if (!u) return false;

    const { data, error } = await sb
      .from("profiles")
      .select("role")
      .eq("user_id", u.id)
      .maybeSingle();

    if (error) return false;
    return (data?.role === "admin");
  }

  window.ENGTHIVSC = window.ENGTHIVSC || {};
  Object.assign(window.ENGTHIVSC, {
    initSupabase,
    getSB,
    getUser,
    requireAuth,
    requireLogin,
    setupLogout,
    isAdmin
  });
})();
