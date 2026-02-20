// ================================
// course.js
// Página do curso (B2: só logado)
// ================================

document.addEventListener("DOMContentLoaded", async () => {
  // Exige login
  const user = await requireLogin("course.html");
  if (!user) return;

  setupLogout();

  const sb = getSB();
  const params = new URLSearchParams(location.search);

  // Ajuste: seu projeto costuma usar course_id, então aceito ?id= ou ?course_id=
  const courseId = params.get("course_id") || params.get("id");
  if (!courseId) {
    showError("Curso não informado. Abra a página com ?id=SEU_COURSE_ID");
    return;
  }

  // Carrega o curso
  const { data: course, error: courseErr } = await sb
    .from("courses")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();

  if (courseErr) {
    showError("Erro ao carregar curso: " + courseErr.message);
    return;
  }
  if (!course) {
    showError("Curso não encontrado: " + courseId);
    return;
  }

  // Render básico (ajuste ids conforme seu HTML)
  setText("courseTitle", course.title || "");
  setText("courseSubtitle", course.subtitle || "");
  setText("courseCategory", course.category || "");
  setImage("courseCover", course.cover_url);

  // Carrega módulos
  const { data: modules, error: modErr } = await sb
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  if (modErr) {
    showError("Erro ao carregar módulos: " + modErr.message);
    return;
  }

  renderModules(modules || []);
});

// ---------- helpers ----------
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function setImage(id, url) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!url) {
    el.style.display = "none";
    return;
  }
  el.src = url;
  el.style.display = "";
}

function showError(msg) {
  console.error(msg);
  const box = document.getElementById("errorBox");
  if (box) {
    box.textContent = msg;
    box.style.display = "block";
  } else {
    alert(msg);
  }
}

function renderModules(modules) {
  const list = document.getElementById("modulesList");
  if (!list) return;

  list.innerHTML = "";

  if (!modules.length) {
    list.innerHTML = `<div style="opacity:.8">Nenhum módulo cadastrado.</div>`;
    return;
  }

  for (const m of modules) {
    const item = document.createElement("div");
    item.className = "module-item";
    item.innerHTML = `
      <div class="module-title">${escapeHtml(m.title || "Módulo")}</div>
      <div class="module-sub">${escapeHtml(m.subtitle || "")}</div>
    `;
    list.appendChild(item);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
