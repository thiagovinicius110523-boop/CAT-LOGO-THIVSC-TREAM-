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
  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    await sb.from("profiles").insert({
      user_id: user.id,
      display_name: user.email,
      username: user.email.split("@")[0]
    });
  }

  // Recarregar profile
  const { data: updatedProfile } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Exibir dados
  $("display_name").value = updatedProfile.display_name || "";
  $("username").value = updatedProfile.username || "";

  const avatarImg = $("avatarPreview");

  if (updatedProfile.avatar_url) {
    avatarImg.src = updatedProfile.avatar_url + "?t=" + Date.now();
  } else {
    avatarImg.src = DEFAULT_AVATAR;
  }

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

    log("Perfil atualizado com sucesso ✅");
  });

  // Upload avatar
  $("avatarInput").addEventListener("change", async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      const ext = file.name.split(".").pop().toLowerCase();
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

      // Pegar URL pública
      const { data: pub } = sb
        .storage
        .from("assets")
        .getPublicUrl(filePath);

      const avatarUrl = pub.publicUrl;

      // Atualizar profile
      await sb
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);

      // Atualizar imagem imediatamente (quebra cache)
      avatarImg.src = avatarUrl + "?t=" + Date.now();

      log("Avatar atualizado com sucesso ✅");

    } catch (err) {
      log("Erro avatar: " + (err?.message || err));
    }
  });

})();
