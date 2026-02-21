(function(){
  const $ = (id)=>document.getElementById(id);
  const log = (m)=>{ $("console").textContent = m || ""; };

  let sb;

  function appBase(){
    // se APP_BASE_URL definido, use; senão derive (funciona em GitHub Pages e domínio próprio)
    const b = window.APP_BASE_URL || (location.origin + location.pathname.replace(/\/[^\/]*$/, "/"));
    return b.endsWith("/") ? b : (b + "/");
  }

  function normalizeReturnTo(rt){
    rt = (rt || "index.html").trim();
    rt = rt.replace(/^https?:\/\/[^/]+/i, "");
    rt = rt.replace(/^\/+/, "");
    // evita duplicação do nome do repo
    const repo = (location.pathname.split("/")[1] || "").trim();
    if (repo && rt.startsWith(repo + "/")) rt = rt.slice(repo.length + 1);
    return rt || "index.html";
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
      const rt = normalizeReturnTo(new URLSearchParams(location.search).get("returnTo"));
      location.href = appBase() + rt;
    }
  }

  async function isAllowed(email){
    try{
      const { data, error } = await sb.rpc("is_email_allowed", { p_email: email });
      if (error) return false;
      return !!data;
    }catch(e){
      return false;
    }
  }

  $("btnLogin").addEventListener("click", async ()=>{
    try{
      const email = ($("email").value||"").trim().toLowerCase();
      const password = ($("password").value||"").trim();
      if (!email || !password) return log("Preencha e-mail e senha.");

      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return log("ERRO: " + error.message);

      const rt = normalizeReturnTo(new URLSearchParams(location.search).get("returnTo"));
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