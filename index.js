(async()=>{
  const el = document.getElementById("appContent");
  const show = (msg)=>{
    if(!el) return;
    el.style.display="block";
    el.innerHTML = `<h2>${msg}</h2><pre id="debugBox" style="white-space:pre-wrap;background:#111;padding:12px;border-radius:8px;"></pre>`;
  };

  try{
    // 1) garante login
    const ok = await window.ENGTHIVSC.requireLogin('index.html');
    if(!ok) return;

    // 2) logout
    await window.ENGTHIVSC.setupLogout();

    // 3) mostra conteúdo base (mesmo que o resto falhe)
    show("Logado ✅");

    // 4) opcional: ping no banco para verificar RLS/conexão
    const sb = await window.ENGTHIVSC.initSupabase();
    if(!sb){
      document.getElementById("debugBox").textContent = "ERRO: Supabase não inicializou. Verifique supabase-config.js (URL/ANON KEY).";
      return;
    }

    const { error, count } = await sb.from("courses").select("course_id", { count: "exact", head: true });
    if(error){
      document.getElementById("debugBox").textContent =
        "Falha ao ler courses.\n" +
        "Mensagem: " + error.message + "\n" +
        "Dica: se a policy estiver 'authenticated read', você precisa estar logado (ok) e a policy deve existir.";
      return;
    }
    document.getElementById("debugBox").textContent = `Conexão OK. Cursos cadastrados: ${count ?? "?"}`;
  }catch(err){
    show("Erro no carregamento ❌");
    const box = document.getElementById("debugBox");
    if(box) box.textContent = (err && (err.stack||err.message)) ? (err.stack||err.message) : String(err);
    console.error(err);
  }
})();