// course.js — compatível com seu course.html atual (apenas appContent + btnLogout)

document.addEventListener("DOMContentLoaded", async () => {
  // exige login (B2)
  const user = await requireLogin("course.html");
  if (!user) return;

  // mostra botão sair
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) btnLogout.style.display = "inline-flex";
  setupLogout("btnLogout");

  // mostra o conteúdo da página
  const app = document.getElementById("appContent");
  if (app) app.style.display = "block";

  const sb = getSB();
  const params = new URLSearchParams(location.search);
  const courseId = params.get("course_id") || params.get("id");

  // se não passou id, mostra instrução
  if (!courseId) {
    app.innerHTML = `
      <h2>Conteúdo do Curso</h2>
      <p style="opacity:.85">
        Nenhum curso foi selecionado. Abra esta página com <b>?id=SEU_COURSE_ID</b>.
      </p>
    `;
    return;
  }

  // busca curso
  const { data: course, error: courseErr } = await sb
    .from("courses")
    .select("course_id,title,subtitle,category,cover_url")
    .eq("course_id", courseId)
    .maybeSingle();

  if (courseErr) {
    app.innerHTML = `
      <h2>Conteúdo do Curso</h2>
      <p style="color:#ff6b6b">Erro ao carregar curso: ${escapeHtml(courseErr.message)}</p>
    `;
    return;
  }

  if (!course) {
    app.innerHTML = `
      <h2>Conteúdo do Curso</h2>
      <p style="opacity:.85">Curso não encontrado: <b>${escapeHtml(courseId)}</b></p>
    `;
    return;
  }

  // busca módulos
  const { data: modules, error: modErr } = await sb
    .from("course_modules")
    .select("module_id,title,subtitle,order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  if (modErr) {
    app.innerHTML = `
      <h2>${escapeHtml(course.title || "Curso")}</h2>
      <p style="color:#ff6b6b">Erro ao carregar módulos: ${escapeHtml(modErr.message)}</p>
    `;
    return;
  }

  // render
  app.innerHTML = `
    <h2>${escapeHtml(course.title || "Curso")}</h2>
    ${course.subtitle ? `<p style="opacity:.85">${escapeHtml(course.subtitle)}</p>` : ""}
    ${course.category ? `<p style="opacity:.7">Categoria: ${escapeHtml(course.category)}</p>` : ""}
    ${course.cover_url ? `<img src="${escapeHtml(course.cover_url)}" alt="Capa" style="max-width:100%;border-radius:12px;margin:12px 0;" />` : ""}
    <hr style="opacity:.2;margin:16px 0;" />
    <h3>Módulos</h3>
    <div id="modulesList"></div>
  `;

  const list = document.getElementById("modulesList");

  if (!modules?.length) {
    list.innerHTML = `<p style="opacity:.85">Nenhum módulo cadastrado ainda.</p>`;
    return;
  }

  list.innerHTML = modules.map(m => `
    <div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;margin:10px 0;">
      <div style="font-weight:700">${escapeHtml(m.title || "Módulo")}</div>
      ${m.subtitle ? `<div style="opacity:.8;margin-top:6px">${escapeHtml(m.subtitle)}</div>` : ""}
    </div>
  `).join("");
});

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
