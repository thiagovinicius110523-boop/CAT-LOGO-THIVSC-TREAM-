const DEFAULT_AVATAR = "./default-avatar.png";

// profile.js — editar display_name/username e avatar
(async () => {

  const $ = (id) => document.getElementById(id);
  const log = (m) => {
    const el = $('console');
    if (el) {
      el.style.display = m ? 'block' : 'none';
      el.textContent = m || '';
    }
  };

  const required = ["display_name", "username", "btnSaveProfile", "avatarInput", "avatarPreview"]; 
  for (const id of required) {
    if (!$(id)) {
      log(`Erro: elemento #${id} não existe no profile.html`);
      return;
    }
  }

  const ok = await window.ENGTHIVSC.requireLogin('profile.html');
  if (!ok) return;

  await window.ENGTHIVSC.setupLogout();
  await window.ENGTHIVSC.applyUserUI();

  const app = document.getElementById('appContent');
  if (app) app.style.display = 'block';

  const sb = window.ENGTHIVSC.getSB();
  if (!sb) {
    log('Supabase não inicializou. Verifique supabase-config.js');
    return;
  }

  const user = await window.ENGTHIVSC.getUser();
  if (!user) {
    location.href = './login.html';
    return;
  }

  // Garantir que profile exista
  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    const { error: insErr } = await sb.from("profiles").insert({
      user_id: user.id,
      display_name: user.email,
      username: user.email.split("@")[0]
    });
    if (insErr) {
      log("Erro ao criar perfil: " + insErr.message);
      return;
    }
  }

  // Recarregar profile
  const { data: updatedProfile, error: readErr } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr || !updatedProfile) {
    log("Erro ao carregar perfil: " + (readErr?.message || "perfil não encontrado"));
    return;
  }

  $("display_name").value = updatedProfile.display_name || "";
  $("username").value = updatedProfile.username || "";

  const avatarImg = $("avatarPreview");
  avatarImg.src = (updatedProfile.avatar_url ? (updatedProfile.avatar_url + "?t=" + Date.now()) : DEFAULT_AVATAR);

  $("btnSaveProfile").addEventListener("click", async () => {
    const display_name = $("display_name").value.trim();
    const username = $("username").value.trim();

    const { error } = await sb
      .from("profiles")
      .update({ display_name, username })
      .eq("user_id", user.id);

    if (error) {
      log("Erro ao salvar perfil: " + error.message);
      return;
    }

    window.ENGTHIVSC.applyUserUI?.();
    log("Perfil atualizado com sucesso ✅");
  });

  $("avatarInput").addEventListener("change", async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const maxMB = 3;
      if (file.size > maxMB * 1024 * 1024) {
        log(`Arquivo muito grande. Máx: ${maxMB}MB`);
        return;
      }

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const allowedExt = ["png", "jpg", "jpeg", "webp"];
      if (!allowedExt.includes(ext)) {
        log("Formato inválido. Use: PNG, JPG, JPEG ou WEBP.");
        return;
      }

      const filePath = `avatars/${user.id}.${ext}`;

      const { error: uploadError } = await sb
        .storage
        .from("assets")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "0"
        });

      if (uploadError) {
        log("Erro avatar: " + uploadError.message);
        return;
      }

      const { data: pub } = sb
        .storage
        .from("assets")
        .getPublicUrl(filePath);

      const avatarUrl = pub.publicUrl;

      const { error: upErr } = await sb
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);

      if (upErr) {
        log("Erro ao salvar avatar no perfil: " + upErr.message);
        return;
      }

      avatarImg.src = avatarUrl + "?t=" + Date.now();
      window.ENGTHIVSC.applyUserUI?.();
      log("Avatar atualizado com sucesso ✅");

    } catch (err) {
      log("Erro avatar: " + (err?.message || err));
    }
  });

})();
