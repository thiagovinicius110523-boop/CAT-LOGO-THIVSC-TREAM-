// admin.js — painel admin (whitelist + tema + online)
(async ()=>{
  const $ = (id)=>document.getElementById(id);
  const log = (m)=>{ const el=$('console'); if(el){ el.style.display = m?'block':'none'; el.textContent=m||''; } };

  await window.ENGTHIVSC.initSupabase();
  await window.ENGTHIVSC_THEME?.applyTheme?.();

  const ok = await window.ENGTHIVSC.requireAdmin('admin.html');
  if(!ok) return;

  await window.ENGTHIVSC.setupLogout('btnLogoutTop');
  await window.ENGTHIVSC.setupLogout('btnLogout');
  await window.ENGTHIVSC.applyUserUI();

  const sb = window.ENGTHIVSC.getSB();
  $('adminContent').style.display = 'block';

  // -----------------------------
  // WHITELIST (allowed_emails)
  // -----------------------------
  async function loadAllowed(){
    $('allowedMeta').textContent = 'carregando...';
    const { data, error } = await sb.from('allowed_emails').select('email,created_at').order('created_at', {ascending:false});
    if(error){ $('allowedMeta').textContent = 'Erro'; log(error.message); return; }
    $('allowedMeta').textContent = (data?.length||0) + ' emails';
    $('allowedList').innerHTML = (data||[]).map(r=>`
      <div class="row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700">${esc(r.email)}</div>
          <div class="muted" style="font-size:12px">${new Date(r.created_at).toLocaleString()}</div>
        </div>
        <button class="btn btn--ghost" data-del-email="${esc(r.email)}">Remover</button>
      </div>
    `).join('') || '<div class="empty">Nenhum e-mail cadastrado.</div>';
  }

  $('btnAddEmail').addEventListener('click', async ()=>{
    const email = ($('newEmail').value||'').trim().toLowerCase();
    if(!email) return;
    const { error } = await sb.from('allowed_emails').upsert({ email });
    if(error) return log('Erro: ' + error.message);
    $('newEmail').value='';
    await loadAllowed();
  });

  $('allowedList').addEventListener('click', async (ev)=>{
    const btn = ev.target.closest('[data-del-email]');
    if(!btn) return;
    const email = btn.getAttribute('data-del-email');
    const { error } = await sb.from('allowed_emails').delete().eq('email', email);
    if(error) return log('Erro: ' + error.message);
    await loadAllowed();
  });

  $('btnReload').addEventListener('click', loadAllowed);

  // -----------------------------
  // THEME (site_settings: key=theme)
  // -----------------------------
  async function loadTheme(){
    $('themeMeta').textContent = 'carregando...';
    const { data, error } = await sb.from('site_settings').select('value,updated_at').eq('key','theme').maybeSingle();
    if(error){ $('themeMeta').textContent='Erro'; log(error.message); return; }
    const v = data?.value || {};
    $('accent').value = v.primary || '';
    $('accent2').value = v.accent2 || '';
    $('bg').value = v.bg || '';
    $('text').value = v.text || '';
    $('logoUrl').value = v.logo_url || '';
    $('themeMeta').textContent = data?.updated_at ? ('Atualizado: ' + new Date(data.updated_at).toLocaleString()) : 'ok';
  }

  function themeFromForm(){
    return {
      primary: ($('accent').value||'').trim(),
      accent2: ($('accent2').value||'').trim(),
      bg: ($('bg').value||'').trim(),
      text: ($('text').value||'').trim(),
      logo_url: ($('logoUrl').value||'').trim() || null
    };
  }

  $('btnPreviewTheme').addEventListener('click', ()=>{
    window.ENGTHIVSC_THEME?.applyTheme?.(themeFromForm());
  });

  $('btnSaveTheme').addEventListener('click', async ()=>{
    const value = themeFromForm();
    const { error } = await sb.from('site_settings').upsert({ key:'theme', value });
    if(error) return log('Erro: ' + error.message);
    $('themeMeta').textContent='Salvo ✅';
    window.ENGTHIVSC_THEME?.applyTheme?.(value);
  });

  $('btnResetTheme').addEventListener('click', async ()=>{
    const { data, error } = await sb.from('site_settings').select('value').eq('key','theme').maybeSingle();
    if(error) return log('Erro: ' + error.message);
    window.ENGTHIVSC_THEME?.applyTheme?.(data?.value||{});
  });

  async function uploadToAssets(file, nameHint){
    if(!file) return null;
    const ext = (file.name.split('.').pop()||'png').toLowerCase();
    const path = `theme/${Date.now()}_${(nameHint||'asset')}.${ext}`;
    const { error } = await sb.storage.from('assets').upload(path, file, { upsert:true, contentType:file.type||undefined });
    if(error) throw error;
    const { data } = sb.storage.from('assets').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  $('btnUploadLogo')?.addEventListener('click', async ()=>{
    try{
      const file = $('logoFile')?.files?.[0];
      if(!file) return alert('Selecione um arquivo.');
      const url = await uploadToAssets(file, 'logo');
      $('logoUrl').value = url || '';
      $('themeMeta').textContent = 'Logo enviada ✅';
    }catch(e){
      log('Erro upload logo: ' + (e?.message||e));
    }
  });

  $('btnUploadBgs')?.addEventListener('click', async ()=>{
    try{
      const loginBg = $('loginBgFile')?.files?.[0] || null;
      const appBg = $('appBgFile')?.files?.[0] || null;
      const v = themeFromForm();
      if(loginBg) v.login_bg_url = await uploadToAssets(loginBg, 'login_bg');
      if(appBg) v.app_bg_url = await uploadToAssets(appBg, 'app_bg');
      const { error } = await sb.from('site_settings').upsert({ key:'theme', value: v });
      if(error) throw error;
      $('themeMeta').textContent = 'Fundos enviados ✅';
      window.ENGTHIVSC_THEME?.applyTheme?.(v);
    }catch(e){
      log('Erro upload fundo: ' + (e?.message||e));
    }
  });

  // -----------------------------
  // ONLINE (presence)
  // -----------------------------
  async function loadOnline(){
    $('onlineMeta').textContent = 'carregando...';
    const since = new Date(Date.now() - 5*60*1000).toISOString();
    const { data, error } = await sb.from('presence').select('user_id,page,last_seen').gte('last_seen', since).order('last_seen', {ascending:false});
    if(error){ $('onlineMeta').textContent='Erro'; log(error.message); return; }

    // busca perfis (em paralelo)
    const ids = (data||[]).map(x=>x.user_id);
    let profiles = [];
    if(ids.length){
      const r = await sb.from('profiles').select('user_id,display_name,username,avatar_url,role').in('user_id', ids);
      profiles = r.data || [];
    }
    const pMap = new Map(profiles.map(p=>[p.user_id, p]));
    $('onlineMeta').textContent = (data?.length||0) + ' online (últimos 5 min)';
    $('onlineList').innerHTML = (data||[]).map(r=>{
      const p = pMap.get(r.user_id);
      const name = p?.display_name || p?.username || r.user_id.slice(0,8);
      const avatar = p?.avatar_url || './default-avatar.png';
      return `
        <div class="row">
          <img src="${esc(avatar)}" onerror="this.src='./default-avatar.png'" style="width:34px;height:34px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,.12)" />
          <div style="flex:1;min-width:0">
            <div style="font-weight:700">${esc(name)} <span class="muted" style="font-weight:600">(${esc(p?.role||'user')})</span></div>
            <div class="muted" style="font-size:12px">${esc(r.page||'')} • ${new Date(r.last_seen).toLocaleTimeString()}</div>
          </div>
        </div>
      `;
    }).join('') || '<div class="empty">Ninguém online agora.</div>';
  }

  $('btnReloadOnline').addEventListener('click', loadOnline);

  // boot
  await Promise.all([loadAllowed(), loadTheme(), loadOnline()]);

  function esc(s){
    return String(s??'')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
})();