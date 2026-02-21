/* ENTHIVSC STREAM — Theme v4 (site_settings) */
(function(){
  const DEFAULT_THEME = {
    // cores base (CSS vars)
    accent: "#4df2c7",
    accent2:"#66a8ff",
    bg:"#0b0f17",
    text:"#e7eefc",
    muted:"#9db0d0",

    // layout (css vars)
    radius:"18px",
    radius2:"14px",
    btn_h:"42px",
    btn_radius:"14px",
    icon_size:"40px",
    avatar_size:"44px",
    brand_mark_size:"42px",

    // imagens
    logo_url:"",
    bg_login_url:"",
    bg_app_url:"",
  };

  function applyCSSVars(t){
    const root = document.documentElement;
    const set = (k,v)=>{ if (v!==undefined && v!==null && v!=="") root.style.setProperty(`--${k}`, String(v)); };

    set("accent", t.accent);
    set("accent2", t.accent2);
    set("bg", t.bg);
    set("text", t.text);
    set("muted", t.muted);

    set("radius", t.radius);
    set("radius2", t.radius2);
    set("btn_h", t.btn_h);
    set("btn_radius", t.btn_radius);
    set("icon_size", t.icon_size);
    set("avatar_size", t.avatar_size);
    set("brand_mark_size", t.brand_mark_size);

    // imagens
    if (t.logo_url){
      document.querySelectorAll(".brand__mark").forEach(el=>{
        // vira imagem se for url
        el.style.backgroundImage = `url("${t.logo_url}")`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
        el.textContent = "";
      });
    }else{
      document.querySelectorAll(".brand__mark").forEach(el=>{
        el.style.backgroundImage = "";
        if (!el.textContent) el.textContent = "E";
      });
    }

    const isLogin = document.body?.classList?.contains("page-login") || location.pathname.endsWith("login.html") || location.pathname.endsWith("recover.html");
    const bgUrl = isLogin ? t.bg_login_url : t.bg_app_url;
    if (bgUrl){
      document.body.style.backgroundImage = `url("${bgUrl}")`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.backgroundRepeat = "no-repeat";
    }else{
      // mantém background do style.css
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundAttachment = "";
      document.body.style.backgroundRepeat = "";
    }
  }

  async function fetchThemeFromSupabase(){
    try{
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || !window.supabase?.createClient) return null;

      const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
        auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      });

      // tenta ler tema (precisa de policy permitindo SELECT público, ou ao menos logged-in)
      const { data, error } = await sb.from("site_settings").select("value").eq("key","theme").maybeSingle();
      if (error) return null;

      return data?.value || null;
    }catch{
      return null;
    }
  }

  function loadLocalTheme(){
    try{
      const raw = localStorage.getItem("engthivsc_theme_v4");
      if (!raw) return null;
      return JSON.parse(raw);
    }catch{ return null; }
  }

  function saveLocalTheme(t){
    try{ localStorage.setItem("engthivsc_theme_v4", JSON.stringify(t||{})); }catch{}
  }

  async function applyTheme(){
    // 1) tenta Supabase; 2) cai no localStorage; 3) default
    const remote = await fetchThemeFromSupabase();
    const local = loadLocalTheme();
    const theme = { ...DEFAULT_THEME, ...(local||{}), ...(remote||{}) };

    // salva local para o login usar mesmo sem policy pública
    saveLocalTheme(theme);

    applyCSSVars(theme);
    return theme;
  }

  window.ENGTHIVSC_THEME = {
    DEFAULT_THEME,
    applyTheme,
    applyCSSVars,
    loadLocalTheme,
    saveLocalTheme
  };
})();
