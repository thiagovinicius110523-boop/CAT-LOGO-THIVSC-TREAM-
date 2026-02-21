(function(){
  const $ = (id)=>document.getElementById(id);
  const log = (m)=>{ $("console").textContent = m || ""; };

  function appBase(){
    const b = window.APP_BASE_URL || (location.origin + location.pathname.replace(/\/[^\/]*$/, "/"));
    return b.endsWith("/") ? b : (b + "/");
  }

  let sb;

  async function init(){
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return log("ERRO: configure supabase-config.js");
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    await window.ENGTHIVSC_THEME?.applyTheme?.();
  }

  $("btnSave").addEventListener("click", async ()=>{
    try{
      const password = ($("password").value||"").trim();
      if (!password) return log("Digite a nova senha.");

      const { error } = await sb.auth.updateUser({ password });
      if (error) return log("ERRO: " + error.message);

      log("Senha atualizada ✅\nAgora faça login.");
      setTimeout(()=> location.href = appBase() + "login.html", 900);
    }catch(err){
      log("ERRO: " + (err?.message||err));
    }
  });

  init();
})();
