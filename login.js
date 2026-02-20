(function(){
  const $ = (id)=>document.getElementById(id);
  const log = (m)=>{ $("console").textContent = m || ""; };

  let sb;

  function appBase(){
    const b = window.APP_BASE_URL || (location.origin + location.pathname.replace(/\/[^\/]*$/, "/"));
    return b.endsWith("/") ? b : (b + "/");
  }

  async function init(){
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY){
      log("ERRO: configure supabase-config.js");
      return;
    }
    if (!window.supabase?.createClient){
      log("ERRO: supabase-js não carregou.");
      return;
    }
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });

    await window.ENGTHIVSC_THEME?.applyTheme?.();

    const { data } = await sb.auth.getUser();
    if (data?.user){
      const rt = new URLSearchParams(location.search).get("returnTo") || "index.html";
      location.href = appBase() + rt;
    }
  }

  async function isAllowed(email){
    const { data, error } = await sb.from("allowed_users").select("email").eq("email", email).maybeSingle();
    if (error) return false;
    return !!data;
  }

  $("btnLogin").addEventListener("click", async ()=>{
    try{
      const email = ($("email").value||"").trim().toLowerCase();
      const password = ($("password").value||"").trim();
      if (!email || !password) return log("Preencha e-mail e senha.");

      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return log("ERRO: " + error.message);

      const rt = new URLSearchParams(location.search).get("returnTo") || "index.html";
      location.href = appBase() + rt;
    }catch(err){
      log("ERRO: " + (err?.message||err));
    }
  });

  $("btnSignup").addEventListener("click", async ()=>{
    try{
      const email = ($("email").value||"").trim().toLowerCase();
      const password = ($("password").value||"").trim();
      if (!email || !password) return log("Preencha e-mail e senha.");

      const allowed = await isAllowed(email);
      if (!allowed) return log("ERRO: e-mail não autorizado.");

      const { error } = await sb.auth.signUp({
        email, password,
        options: { emailRedirectTo: appBase() + "login.html" }
      });
      if (error) return log("ERRO: " + error.message);

      log("Conta criada ✅\nVerifique seu e-mail para confirmar e depois clique em Entrar.");
    }catch(err){
      log("ERRO: " + (err?.message||err));
    }
  });

  $("btnForgot").addEventListener("click", async ()=>{
    try{
      const email = ($("email").value||"").trim().toLowerCase();
      if (!email) return log("Digite seu e-mail.");

      const allowed = await isAllowed(email);
      if (!allowed) return log("ERRO: e-mail não autorizado.");

      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: appBase() + "recover.html"
      });
      if (error) return log("ERRO: " + error.message);

      log("Enviado ✅\nAbra seu e-mail e clique no link para redefinir a senha.");
    }catch(err){
      log("ERRO: " + (err?.message||err));
    }
  });

  init();
})();
