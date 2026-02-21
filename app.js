/**
 * app.js — helpers globais ENTHIVSC
 * Mantém compatibilidade com as funções antigas (requireAuth/setupLogout)
 * e adiciona utilitários usados pelo Admin (initSupabase/getSB/getUser/requireLogin/isAdmin).
 */
(function(){
  let sb = null;
  let cachedProfile = null;

  async function initSupabase(){
    if (sb) return sb;
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    if (!window.supabase?.createClient) return null;
    sb = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
      {
        auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      }
    );
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

  async function getProfile(force=false){
    if (cachedProfile && !force) return cachedProfile;
    await initSupabase();
    if (!sb) return null;
    const u = await getUser();
    if (!u) return null;

    const { data, error } = await sb
      .from('profiles')
      .select('user_id, role, username, display_name, avatar_url, email')
      .eq('user_id', u.id)
      .maybeSingle();

    if (error) return null;
    cachedProfile = data || null;
    return cachedProfile;
  }


  async function getSiteSetting(key){
    await initSupabase();
    if (!sb) return null;
    try{
      const { data, error } = await sb
        .from('site_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) return null;
      return data?.value ?? null;
    }catch(e){
      return null;
    }
  }

  async function setSiteSetting(key, value){
    await initSupabase();
    if (!sb) return { error: new Error("Supabase não inicializou") };
    try{
      const { error } = await sb
        .from('site_settings')
        .upsert({ key, value }, { onConflict: 'key' });
      return { error };
    }catch(e){
      return { error: e };
    }
  }

  function ensureAnnouncementBar(){
    if (document.getElementById('announcementBar')) return document.getElementById('announcementBar');
    const bar = document.createElement('div');
    bar.id = 'announcementBar';
    bar.className = 'announcement-bar';
    bar.style.display = 'none';
    const body = document.body;
    // insere logo após o primeiro header/topbar, se existir
    const hdr = document.querySelector('header.topbar') || document.querySelector('header');
    if (hdr && hdr.parentElement === body){
      hdr.insertAdjacentElement('afterend', bar);
    }else{
      body.insertAdjacentElement('afterbegin', bar);
    }
    return bar;
  }

  async function fetchActiveAnnouncement(){
    await initSupabase();
    if (!sb) return null;
    try{
      const nowIso = new Date().toISOString();
      const { data, error } = await sb
        .from('announcements')
        .select('id,title,message,severity,starts_at,ends_at,is_active')
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order('starts_at', { ascending:false })
        .limit(1);
      if (error) return null;
      return data?.[0] || null;
    }catch(e){
      return null;
    }
  }

  function renderAnnouncement(ann){
    const bar = ensureAnnouncementBar();
    if (!ann){
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    const dismissed = localStorage.getItem('dismiss_announcement_id');
    if (dismissed && dismissed === ann.id){
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    bar.dataset.severity = ann.severity || 'info';
    bar.style.display = 'block';
    bar.innerHTML = `
      <div class="container announcement-bar__inner">
        <div class="announcement-badge">${(ann.severity||'info').toUpperCase()}</div>
        <div style="min-width:0;">
          <div class="announcement-title">${escapeHtml(ann.title || 'Aviso')}</div>
          <div class="announcement-msg">${escapeHtml(ann.message || '')}</div>
        </div>
        <button class="announcement-close" type="button" aria-label="Fechar">×</button>
      </div>
    `;
    bar.querySelector('.announcement-close')?.addEventListener('click', ()=>{
      localStorage.setItem('dismiss_announcement_id', ann.id);
      bar.style.display = 'none';
      bar.innerHTML = '';
    });
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  async function applyTelegramSupport(){
    // não exibe no login/auth
    const p = (location.pathname||'').toLowerCase();
    if (p.endsWith('/login.html') || p.endsWith('/recover.html') || p.endsWith('/auth.html')) return;

    const cfg = await getSiteSetting('support_telegram');
    const url = cfg?.url || cfg?.link || '';
    const enabled = cfg?.enabled !== false; // default true se existir
    const text = cfg?.text || 'Suporte - Clique aqui';

    const existing = document.getElementById('tgSupportBtn');
    if (!enabled || !url){
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const a = document.createElement('a');
    a.id = 'tgSupportBtn';
    a.className = 'telegram-support';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `
      <img class="telegram-support__icon" src="./telegram-logo.svg" alt="Telegram"/>
      <span class="telegram-support__text">${escapeHtml(text)}</span>
    `;
    document.body.appendChild(a);
  }

  async function applyGlobalUI(){
    const ann = await fetchActiveAnnouncement();
    renderAnnouncement(ann);
    await applyTelegramSupport();
  }
  function setText(id, value){
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '';
  }

  function setAvatar(id, url){
    const el = document.getElementById(id);
    if (!el) return;
    el.src = url || './default-avatar.png';
  }

  async function applyUserUI(){
    // mostra chip (avatar + nome) quando logado
    const chip = document.getElementById('userChip');
    const btnAdmin = document.getElementById('btnAdmin');
    const btnProfile = document.getElementById('btnProfile');

    await initSupabase();
    if (!sb) return;
    const u = await getUser();
    if (!u) return;

    const profile = await getProfile();

    if (chip) chip.style.display = 'inline-flex';
    setAvatar('userAvatar', profile?.avatar_url ? (profile.avatar_url + "?t=" + Date.now()) : null);
    setText('userName', profile?.display_name || profile?.username || u.email || 'Usuário');
    setText('userRole', profile?.role ? String(profile.role) : '');

    // botão admin aparece apenas para admin
    if (btnProfile) btnProfile.style.display = "inline-flex";
    const btnDash = document.getElementById('btnDash');
    const btnFavorites = document.getElementById('btnFavorites');
    if (btnDash) btnDash.style.display = 'inline-flex';
    if (btnFavorites) btnFavorites.style.display = 'inline-flex';

    if (btnAdmin){
      const admin = profile?.role === 'admin';
      btnAdmin.style.display = admin ? 'inline-flex' : 'none';
    }

    // aviso global + botão de suporte
    await applyGlobalUI();
  }

    await applyGlobalUI();
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
    getProfile,
    applyUserUI,
    requireAuth,
    requireLogin,
    setupLogout,
    isAdmin
  });

  // Aliases globais (para evitar erro "undefined.requireLogin")
  window.initSupabase = window.initSupabase || initSupabase;
  window.getSB = window.getSB || getSB;
  window.getUser = window.getUser || getUser;
  window.getProfile = window.getProfile || getProfile;
  window.applyUserUI = window.applyUserUI || applyUserUI;
  window.requireLogin = window.requireLogin || (async (p)=>window.ENGTHIVSC.requireLogin(p));
  window.setupLogout = window.setupLogout || (async ()=>window.ENGTHIVSC.setupLogout());
})();
