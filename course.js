(async()=>{
  const el = document.getElementById("appContent");
  const show = (msg)=>{
    if(!el) return;
    el.style.display="block";
    el.innerHTML = `<h2>${msg}</h2><pre id="debugBox" style="white-space:pre-wrap;background:#111;padding:12px;border-radius:8px;"></pre>`;
  };

  try{
    const ok = await window.ENGTHIVSC.requireLogin('course.html');
    if(!ok) return;

    await window.ENGTHIVSC.setupLogout();
    show("Curso (debug) ✅");

    const sb = await window.ENGTHIVSC.initSupabase();
    if(!sb){
      document.getElementById("debugBox").textContent = "ERRO: Supabase não inicializou. Verifique supabase-config.js.";
      return;
    }

    const params = new URLSearchParams(location.search);
    const course_id = params.get("id") || params.get("course_id");
    if(!course_id){
      document.getElementById("debugBox").textContent = "Faltou parâmetro ?id=COURSE_ID na URL.";
      return;
    }

    const { data, error } = await sb.from("courses").select("*").eq("course_id", course_id).maybeSingle();
    if(error){
      document.getElementById("debugBox").textContent = "Erro ao carregar curso: " + error.message;
      return;
    }
    if(!data){
      document.getElementById("debugBox").textContent = "Curso não encontrado para course_id=" + course_id;
      return;
    }
    document.getElementById("debugBox").textContent = JSON.stringify(data, null, 2);
  }catch(err){
    show("Erro no carregamento ❌");
    const box = document.getElementById("debugBox");
    if(box) box.textContent = (err && (err.stack||err.message)) ? (err.stack||err.message) : String(err);
    console.error(err);
  }
})();