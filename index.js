// index.js — versão compatível com app.js (requireLogin global)

document.addEventListener("DOMContentLoaded", async () => {
  // exige login (B2)
  const user = await requireLogin("index.html");
  if (!user) return;

  // mostra botão sair (se existir)
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) btnLogout.style.display = "inline-flex";
  setupLogout("btnLogout");

  // mostra conteúdo
  const app = document.getElementById("appContent");
  if (app) app.style.display = "block";

  // carrega cursos
  const sb = getSB();
  const { data: courses, error } = await sb
    .from("courses")
    .select("course_id,title,subtitle,category,cover_url")
    .order("created_at", { ascending: false });

  if (error) {
    if (app) app.innerHTML = `<p style="color:#ff6b6b">Erro ao carregar cursos: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!courses?.length) {
    if (app) app.innerHTML = `<p style="opacity:.85">Nenhum curso cadastrado ainda.</p>`;
    return;
  }

  // render simples
  if (app) {
    app.innerHTML = `
      <h2>Cursos</h2>
      <div id="coursesList"></div>
    `;

    const list = document.getElementById("coursesList");
    list.innerHTML = courses.map(c => `
      <a class="card" href="./course.html?id=${encodeURIComponent(c.course_id)}" style="display:block;text-decoration:none;margin:10px 0;">
        <div style="font-weight:800">${escapeHtml(c.title || "Curso")}</div>
        ${c.subtitle ? `<div style="opacity:.8;margin-top:6px">${escapeHtml(c.subtitle)}</div>` : ""}
        ${c.category ? `<div style="opacity:.7;margin-top:6px">Categoria: ${escapeHtml(c.category)}</div>` : ""}
      </a>
    `).join("");
  }
});

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
