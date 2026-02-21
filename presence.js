/* ENTHIVSC STREAM — PRESENCE v4 (table: presence) */
(function(){
  let sb = null;
  let timer = null;

  async function initSB(){
    if (sb) return sb;
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || !window.supabase?.createClient) return null;
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    return sb;
  }

  async function getUser(){
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  async function ping(){
    try{
      const u = await getUser();
      if (!u) return;

      await sb.from("presence").upsert({
        user_id: u.id,
        last_seen: new Date().toISOString(),
        is_online: true
      }, { onConflict:"user_id" });
    }catch{}
  }

  async function startPresence(){
    await initSB();
    if (!sb) return;
    if (timer) return;

    await ping();
    timer = setInterval(ping, 20000);
    window.addEventListener("beforeunload", async ()=>{ try{ await ping(); }catch{} });
  }

  async function stopPresence(){
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function listOnline(){
    await initSB();
    if (!sb) return [];

    const cutoff = new Date(Date.now() - 2*60*1000).toISOString();
    const { data, error } = await sb
      .from("presence")
      .select("user_id,last_seen,is_online")
      .eq("is_online", true)
      .gte("last_seen", cutoff)
      .order("last_seen", { ascending:false });

    if (error) return [];
    return data || [];
  }

  window.ENGTHIVSC_PRESENCE = { startPresence, stopPresence, listOnline };
})();
