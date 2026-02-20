// ================================
// app.js
// Inicialização global + auth
// ================================

let SB = null;

function getSB() {
  return SB;
}

async function initSupabase() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error("Supabase config ausente.");
    return null;
  }

  if (!window.supabase?.createClient) {
    console.error("supabase-js não carregou.");
    return null;
  }

  SB = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  return SB;
}

async function requireLogin(currentPage) {
  if (!SB) await initSupabase();

  const { data } = await SB.auth.getUser();

  if (!data?.user) {
    const returnTo =
      currentPage || location.pathname.split("/").pop() || "index.html";

    location.href =
      "./login.html?returnTo=" + encodeURIComponent(returnTo);

    return null;
  }

  return data.user;
}

async function isAdmin() {
  if (!SB) await initSupabase();

  const { data } = await SB.auth.getUser();
  if (!data?.user) return false;

  const { data: profile } = await SB
    .from("profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return profile?.role === "admin";
}

async function requireAdmin(currentPage) {
  const user = await requireLogin(currentPage);
  if (!user) return null;

  const admin = await isAdmin();
  if (!admin) {
    location.href = "./index.html";
    return null;
  }

  return user;
}

function setupLogout(buttonId = "btnLogout") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!SB) await initSupabase();
    await SB.auth.signOut();
    location.href = "./login.html";
  });
}

// Inicializa automaticamente quando carregar
document.addEventListener("DOMContentLoaded", async () => {
  await initSupabase();
});
