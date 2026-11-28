/* Disabled until the OAuth provider and both return paths have been verified. */
(() => {
 'use strict';
 let engine;
 const optInKey='aventura-google-closed-test:v1';
 const optIn=new URL(location.href).searchParams.get('google_test');
 try{if(optIn==='1')localStorage.setItem(optInKey,'yes');else if(optIn==='0')localStorage.removeItem(optInKey);}catch{}
 function available(){
  const cfg=globalThis.AVENTURA_PILOT_CONFIG;if(cfg?.googleOAuthVerified!==true)return false;
  if(cfg.googleRollout==='all'||cfg.googleClosedTestBuild===true)return true;
  try{return cfg.googleRollout==='closed-test'&&localStorage.getItem(optInKey)==='yes';}catch{return false;}
 }
 const native=()=>globalThis.Capacitor?.isNativePlatform?.()===true;
 const plugin=name=>globalThis.Capacitor.registerPlugin(name);
 async function client(){await AventuraOnline.cargarSupabase();const c=AventuraSupabase.obtenerCliente();if(!c)throw Error('SESSION_UNAVAILABLE');return c;}
 async function ready(){if(!native())return;const s=await plugin('Prototype').checkAuthConfiguration();if(!s.assetLinksPublished||!s.callbackPublished||s.systemVerified===false)throw Error('CONFIG_REQUIRED');}
 function access(){return engine??=GoogleAccount.create({
  client,storage:localStorage,enabled:available,
  hasSavedIdentity:()=>AventuraSupabase.tieneSesionGuardada(),bootstrap:c=>VersusRoomSupabase.recuperarSesion(c),
  callback:native()?'https://aliasjohel.github.io/aventura-android-auth/callback/':location.origin+location.pathname,
  providerSettings:async()=>{const c=AVENTURA_SUPABASE_CONFIG,r=await fetch(c.url+'/auth/v1/settings',{headers:{apikey:c.publishableKey}});if(!r.ok)throw Error('CONFIG_REQUIRED');return r.json();},
  open:async url=>{await ready();if(native())await plugin('Browser').open({url});else location.assign(url);},
  completed:async()=>{if(native())await plugin('Browser').close().catch(()=>{});else history.replaceState(null,'',location.pathname);location.reload();}
 });}
 globalThis.AccountGoogle=Object.freeze({
  available,
  link:async()=>{await ready();return access().link();},
  login:async options=>{await ready();return access().login(options);},
  handleUrl:url=>access().handleUrl(url),
  finishPending:async()=>new URL(location.href).searchParams.has('av_google_flow')?access().handleUrl(location.href):{status:'ignored'},
  cancel:()=>access().cancel(),
  pending:()=>access().pending()
 });
})();
