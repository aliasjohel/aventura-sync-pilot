/* Google stays opt-in until the closed rollout is explicitly changed. */
(() => {
 'use strict';
 let engine,nativeListener,closing=false,handling=0;
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
 function clearReturnUrl(){if(!native()&&new URL(location.href).searchParams.has('av_google_flow'))history.replaceState(null,'',location.pathname);}
 function settled(code,status='failed'){globalThis.dispatchEvent(new CustomEvent('google-account-settled',{detail:{code,status}}));}
 async function closeBrowser(){if(!native())return;closing=true;try{await plugin('Browser').close();}catch{}finally{closing=false;}}
 async function returnOriginal(error){if(['BUSY','PENDING'].includes(error?.code))return;try{if(engine?.pending())engine.cancel();}catch{}clearReturnUrl();await closeBrowser();settled(error?.code||error?.message||'GOOGLE_FAILED');}
 function listenNative(){return nativeListener??=plugin('Browser').addListener('browserFinished',()=>{
  if(!closing&&!handling&&engine?.pending()){try{engine.cancel();settled('AUTH_CANCELLED','cancelled');}catch{}}
 });}
 function access(){return engine??=GoogleAccount.create({
  client,storage:localStorage,enabled:available,
  stageClient:args=>AventuraSupabase.crearClienteGoogleAislado(args),
  adoptSession:(_client,tokens,owner)=>AventuraSupabase.adoptarSesionGoogle(tokens,owner),
  hasSavedIdentity:()=>AventuraSupabase.tieneSesionGuardada(),bootstrap:c=>VersusRoomSupabase.recuperarSesion(c),
  callback:native()?'https://aliasjohel.github.io/aventura-android-auth/callback/':location.origin+location.pathname,
  providerSettings:async()=>{const c=AVENTURA_SUPABASE_CONFIG,r=await fetch(c.url+'/auth/v1/settings',{headers:{apikey:c.publishableKey}});if(!r.ok)throw Error('CONFIG_REQUIRED');return r.json();},
  open:async url=>{await ready();if(native()){await listenNative();await plugin('Browser').open({url});}else location.assign(url);},
  completed:async({userId,kind})=>{try{sessionStorage.setItem('aventura-google-notice:v1',JSON.stringify({owner:userId,code:kind==='link'?'linked':'switched'}));}catch{}await closeBrowser();clearReturnUrl();location.reload();}
 });}
 async function handleUrl(url){handling++;try{return await access().handleUrl(url);}catch(e){await returnOriginal(e);throw e;}finally{handling--;}}
 function cancel(){const r=access().cancel();void returnOriginal({code:'AUTH_CANCELLED'});return r;}
 globalThis.AccountGoogle=Object.freeze({
  available,
  link:async()=>{try{await ready();return await access().link();}catch(e){await returnOriginal(e);throw e;}},
  login:async options=>{try{await ready();return await access().login(options);}catch(e){await returnOriginal(e);throw e;}},
  handleUrl,
  finishPending:async()=>new URL(location.href).searchParams.has('av_google_flow')?handleUrl(location.href):{status:'ignored'},
  cancel,pending:()=>access().pending(),processing:()=>engine?.processing()===true
 });
 globalThis.addEventListener?.('pageshow',event=>{
  const back=event.persisted||globalThis.performance?.getEntriesByType('navigation')[0]?.type==='back_forward';
  if(back&&!new URL(location.href).searchParams.has('av_google_flow')&&access().pending()){try{cancel();}catch{}}
 });
})();
