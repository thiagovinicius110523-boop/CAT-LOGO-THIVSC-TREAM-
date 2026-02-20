// ================================
// admin.js
// Proteção e utilidades do painel
// ================================

document.addEventListener("DOMContentLoaded", async () => {
  await requireAdmin("admin.html");

  setupLogout();

  console.log("Admin carregado com sucesso.");
});
