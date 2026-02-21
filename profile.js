// profile.js — editar display_name/username e avatar (storage assets/avatars)
(async ()=>{
  const $ = (id)=>document.getElementById(id);
  const log = (m)=>{ const el=$('console'); if(el){ el.style.display=m?'block':'none'; el.textContent=m||''; } };

  await window.ENGTHIVSC.initSupabase();
  await window.ENGTHIVSC_THEME?.applyTheme?.();

  const ok = await window.ENGTHIVSC.requireLogin('profile.html');
  if(!ok) return;

  await window.ENGTHIVSC.setupLogout();
  await window.ENGTHIVSC.applyUserUI();

  $('appContent').style.display='block';

  const sb = window.ENGTHIVSC.getSB();
  const user = await window.ENGTHIVSC.getUser();
  const p = await window.ENGTHIVSC.getProfile(true);

  if(p){
    $('displayName').value = p.display_name || '';
    $('username').value = p.username || '';
    const av = p.avatar_url || './default-avatar.png';
    $('avatarPreview').src = av;
  }

  async function uploadAvatar(file){
    const ext = (file.name.split('.').pop()||'png').toLowerCase();
    const path = `avatars/${user.id}_${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('assets').upload(path, file, { upsert:true, contentType:file.type||undefined });
    if(error) throw error;
    const { data } = sb.storage.from('assets').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  $('btnUploadAvatar').addEventListener('click', async ()=>{
    try{
      const file = $('avatarFile')?.files?.[0];
      if(!file) return alert('Selecione uma imagem.');
      const url = await uploadAvatar(file);
      $('avatarPreview').src = url || './default-avatar.png';
      $('meta').textContent = 'Avatar enviado ✅ (clique Salvar)';
      $('meta').style.color = '';
      $('avatarPreview').setAttribute('data-url', url || '');
    }catch(e){
      log('Erro avatar: ' + (e?.message||e));
    }
  });

  $('btnSave').addEventListener('click', async ()=>{
    const display_name = ($('displayName').value||'').trim() || null;
    const username = ($('username').value||'').trim() || null;
    const avatar_url = $('avatarPreview').getAttribute('data-url') || p?.avatar_url || null;

    const { error } = await sb.from('profiles').upsert({ user_id: user.id, display_name, username, avatar_url });
    if(error){
      $('meta').textContent = 'Erro: ' + error.message;
      return;
    }
    $('meta').textContent = 'Salvo ✅';
    await window.ENGTHIVSC.applyUserUI();
  });
})();