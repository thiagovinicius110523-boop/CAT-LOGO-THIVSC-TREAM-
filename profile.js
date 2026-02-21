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

  // IDs obrigatórios (evita erro silencioso e tela vazia)
  const required = ["display_name", "username", "btnSaveProfile", "avatarInput", "avatarPreview"];
  for (const id of required) {
    if (!$(id)) {
      log(`Erro: elemento #${id} não existe no profile.html`);
      return;
    }
  }

  await window.ENGTHIVSC.initSupabase();
  await window.ENGTHIVSC_THEME?.applyTheme?.();

  const sb = window.ENGTHIVSC.getSB();

  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) {
    location.href = "./login.html";
    return;
  }

  const user = userData.user;

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

  // Exibir dados
  $("display_name").value = updatedProfile.display_name || "";
  $("username").value = updatedProfile.username || "";

  const avatarImg = $("avatarPreview");
  avatarImg.src = (updatedProfile.avatar_url ? (updatedProfile.avatar_url + "?t=" + Date.now()) : DEFAULT_AVATAR);

  // Salvar nome / username
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

    // Atualiza UI do topo (avatar/nome)
    window.ENGTHIVSC.applyUserUI?.();

    log("Perfil atualizado com sucesso ✅");
  });

  // Upload avatar
  $("avatarInput").addEventListener("change", async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // validações simples
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

      // Upload com upsert
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

      // URL pública
      const { data: pub } = sb
        .storage
        .from("assets")
        .getPublicUrl(filePath);

      const avatarUrl = pub.publicUrl;

      // Atualizar profile
      const { error: upErr } = await sb
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);

      if (upErr) {
        log("Erro ao salvar avatar no perfil: " + upErr.message);
        return;
      }

      // Atualizar imagem imediatamente (quebra cache)
      avatarImg.src = avatarUrl + "?t=" + Date.now();

      // Atualiza UI do topo (avatar/nome)
      window.ENGTHIVSC.applyUserUI?.();

      log("Avatar atualizado com sucesso ✅");

    } catch (err) {
      log("Erro avatar: " + (err?.message || err));
    }
  });

})();
