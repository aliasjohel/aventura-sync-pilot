(function iniciarClienteSupabase(raiz) {
  'use strict';
  let cliente=null,googleAdoption=null;
  async function fetchAcotado(input,options={}){
    if(raiz.navigator?.onLine===false)throw new TypeError('Sin conexión; la sesión local se conserva.');
    const controller=new AbortController(),upstream=options.signal||input?.signal;
    const abort=()=>controller.abort();if(upstream?.aborted)abort();else upstream?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,20000);
    try{
      const response=await raiz.fetch(input,{...options,signal:controller.signal});
      const bytes=await response.arrayBuffer(),headers=new Headers(response.headers);
      headers.delete('content-encoding');headers.delete('content-length');
      return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers});
    }finally{clearTimeout(timer);upstream?.removeEventListener('abort',abort);}
  }
  function configuracionDisponible(){const c=raiz.AVENTURA_SUPABASE_CONFIG;return Boolean(c?.url?.startsWith('https://')&&c?.publishableKey?.startsWith('sb_publishable_'));}
  // Same key as Supabase's existing default: preserve v0.2 sessions and PKCE data.
  function claveSesion(){return 'sb-'+new URL(raiz.AVENTURA_SUPABASE_CONFIG.url).hostname.split('.')[0]+'-auth-token';}
  function tieneSesionGuardada(){try{return raiz.localStorage.getItem(claveSesion())!==null||raiz.localStorage.getItem(claveSesion()+':guest-owner')!==null;}catch{return true;}}
  function recordarInvitado(user){if(user?.is_anonymous===true&&user.id)raiz.localStorage.setItem(claveSesion()+':guest-owner',user.id);}
  function leerSesionLocal(){
    if(raiz.navigator?.onLine!==false)return {data:{session:null},error:null};
    try{const s=JSON.parse(raiz.localStorage.getItem(claveSesion())||'null');
      if(!s||typeof s.access_token!=='string'||typeof s.refresh_token!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s.user?.id||''))return {data:{session:null},error:null};
      // Local owner hint only, including expired sessions. Never an online credential
      // or a grant: admission also requires a prior verification marker and snapshots.
      return {data:{session:{user:s.user,expires_at:s.expires_at}},error:null};
    }catch{return {data:{session:null},error:null};}
  }
  const authStorage={getItem:key=>raiz.localStorage.getItem(key),removeItem:key=>raiz.localStorage.removeItem(key),setItem:(key,value)=>{
    if(key===claveSesion()&&googleAdoption){const saved=JSON.parse(raiz.localStorage.getItem(key)||'null');if((saved?.user?.id||null)!==googleAdoption.owner){const e=Error('ACCOUNT_CHANGED');e.code='ACCOUNT_CHANGED';throw e;}}
    raiz.localStorage.setItem(key,value);
  }};
  async function adoptarSesionGoogle(tokens,owner){
    if(googleAdoption)throw Error('BUSY');googleAdoption={owner};try{return await obtenerCliente().auth.setSession(tokens);}finally{googleAdoption=null;}
  }
  function obtenerCliente(){
    if(cliente)return cliente;if(!configuracionDisponible()||typeof raiz.supabase?.createClient!=='function')return null;
    const {url,publishableKey}=raiz.AVENTURA_SUPABASE_CONFIG;
    cliente=raiz.supabase.createClient(url,publishableKey,{
      global:{fetch:fetchAcotado},
      auth:{storage:authStorage,persistSession:true,autoRefreshToken:raiz.navigator?.onLine!==false,storageKey:claveSesion(),
        flowType:'pkce',
        // Our Google return validates its pending owner and flow before exchange.
        detectSessionInUrl: !new URL(raiz.location?.href||'https://local.invalid/').searchParams.has('av_google_flow'),
      },
    });
    return cliente;
  }
  // Candidate OAuth sessions stay in memory under a different SDK/BroadcastChannel key.
  function crearClienteGoogleAislado({flow}){
    const source=claveSesion(),key=source+':google-stage:'+flow,memory=new Map();
    for(let i=0;i<raiz.localStorage.length;i++){
      const name=raiz.localStorage.key(i);if(!name?.startsWith(source+'-'))continue;
      const suffix=name.slice(source.length);
      if(/^-(?:code-verifier|flows-code-verifier|flow-[a-f0-9]{32}-code-verifier)$/.test(suffix))memory.set(key+suffix,raiz.localStorage.getItem(name));
    }
    const store={getItem:name=>memory.get(name)??null,setItem:(name,value)=>memory.set(name,value),removeItem:name=>memory.delete(name)};
    const cfg=raiz.AVENTURA_SUPABASE_CONFIG;
    const staged=raiz.supabase.createClient(cfg.url,cfg.publishableKey,{global:{fetch:fetchAcotado},auth:{storage:store,storageKey:key,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce'}});
    return {client:staged,close:async()=>{await staged.auth.dispose();memory.clear();}};
  }
  function actualizarRenovacion(){if(raiz.navigator?.onLine===false||raiz.document?.visibilityState==='hidden')void cliente?.auth.stopAutoRefresh?.();else void cliente?.auth.startAutoRefresh?.();}
  raiz.addEventListener('offline',actualizarRenovacion);
  raiz.addEventListener('online',actualizarRenovacion);
  raiz.document?.addEventListener('visibilitychange',actualizarRenovacion);
  raiz.AventuraSupabase=Object.freeze({configuracionDisponible,obtenerCliente,leerSesionLocal,tieneSesionGuardada,recordarInvitado,crearClienteGoogleAislado,adoptarSesionGoogle});
})(globalThis);
