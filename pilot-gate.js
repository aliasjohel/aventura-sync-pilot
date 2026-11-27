/* Owner-verified admission. Guest bootstrap shares the adapter's persistent session lock. */
(() => {
 'use strict';
 const cfg=globalThis.AVENTURA_PILOT_CONFIG,general=cfg?.scope==='verified-accounts';
 let node,client,subscription,generation=0,scheduled,entryBusy=false,entryStatus='',entryEmail='';
 const entryKey='aventura-account-choice:v1:'+cfg.project;
 function entryChoice(){try{return localStorage.getItem(entryKey);}catch{return null;}}
 function chooseEntry(value){localStorage.setItem(entryKey,value);}
 const entryCopy={
  es:{title:'Bienvenido a Aventura de Palabras',intro:'Elegí cómo querés entrar.',email:'Tu correo',create:'Crear cuenta con correo',login:'Ya tengo cuenta',guest:'Continuar como invitado',help:'Como invitado conservás tu jugador en esta aplicación. Si borrás sus datos o cambiás de teléfono, podés perder el acceso a tu progreso. Vinculá un correo para recuperarlo.',sent:'Revisá tu correo y confirmá el enlace. Después volvé aquí. También podés continuar como invitado mientras tanto.',failed:'No pudimos enviar el correo. Revisá la dirección e intentá de nuevo en unos minutos.',offline:'Necesitás conexión para tu primer ingreso o para entrar con correo.',busy:'Enviando…'},
  en:{title:'Welcome to Aventura de Palabras',intro:'Choose how to sign in.',email:'Your email',create:'Create account with email',login:'I already have an account',guest:'Continue as guest',help:'As a guest, your player stays in this app. Clearing its data or changing phones can cost you access to your progress. Link an email to recover it.',sent:'Check your email and confirm the link, then return here. You can also continue as a guest in the meantime.',failed:'Could not send the email. Check the address and try again in a few minutes.',offline:'Your first sign-in and email sign-in require a connection.',busy:'Sending…'},
  'pt-BR':{title:'Boas-vindas a Aventura de Palabras',intro:'Escolha como entrar.',email:'Seu e-mail',create:'Criar conta com e-mail',login:'Já tenho conta',guest:'Continuar como convidado',help:'Como convidado, seu jogador fica neste aplicativo. Apagar os dados ou trocar de celular pode fazer você perder o acesso ao progresso. Vincule um e-mail para recuperá-lo.',sent:'Confira seu e-mail e confirme o link. Depois volte aqui. Você também pode continuar como convidado enquanto isso.',failed:'Não foi possível enviar o e-mail. Confira o endereço e tente novamente em alguns minutos.',offline:'A primeira entrada e a entrada por e-mail precisam de conexão.',busy:'Enviando…'}
 };
 function welcome(){
  const copy=entryCopy[globalThis.I18n?.language]||entryCopy.es;
  show(entryStatus||copy.intro);node.querySelector('h1').textContent=copy.title;
  node.querySelectorAll(':scope > button').forEach(b=>b.hidden=true);
  const form=document.createElement('form');form.id='accountEntry';
  form.style.cssText='display:grid;grid-template-columns:minmax(0,1fr);gap:12px;width:100%;min-width:0;max-width:520px;justify-self:center';
  const label=document.createElement('label');label.textContent=copy.email;
  const email=document.createElement('input');email.type='email';email.required=true;email.autocomplete='email';email.value=entryEmail;email.id='entryEmail';email.oninput=()=>entryEmail=email.value;label.htmlFor=email.id;
  const create=document.createElement('button');create.type='submit';create.textContent=copy.create;
  const login=document.createElement('button');login.type='button';login.textContent=copy.login;
  const guest=document.createElement('button');guest.type='button';guest.textContent=copy.guest;
  const help=document.createElement('p');help.textContent=copy.help;help.style.cssText='font-size:14px;line-height:1.5';
  const send=async registering=>{
   if(entryBusy||!form.reportValidity())return;
   if(!navigator.onLine){entryStatus=copy.offline;welcome();return;}
   entryBusy=true;entryStatus=copy.busy;node.querySelector('p').textContent=entryStatus;
   form.querySelectorAll('button,input').forEach(b=>b.disabled=true);
   try{
    const value=email.value.trim();chooseEntry('email');
    if(registering){
     await globalThis.VersusRoomSupabase.recuperarSesion(client);
     if(globalThis.NativePrototype){await globalThis.NativePrototype.registerEmail(value);}
     else {const r=await client.auth.updateUser({email:value},{emailRedirectTo:location.origin+location.pathname});if(r.error)throw r.error;}
    }else if(globalThis.NativePrototype){await globalThis.NativePrototype.requestEmail(value,{silent:true});}
    else {const r=await client.auth.signInWithOtp({email:value,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});if(r.error)throw r.error;}
    entryStatus=copy.sent;
   }catch(error){diagnose('entry-email',error);entryStatus=copy.failed;}
   finally{entryBusy=false;recheck();}
  };
  form.onsubmit=e=>{e.preventDefault();void send(true);};login.onclick=()=>void send(false);
  guest.onclick=()=>{try{chooseEntry('guest');entryStatus='';void check();}catch{entryStatus=copy.failed;welcome();}};
  for(const e of [email,create,login,guest])e.style.cssText='box-sizing:border-box;width:100%;min-width:0;white-space:normal;min-height:46px;padding:12px;border-radius:10px;font:inherit;transform:none';
  form.append(label,email,create,login,guest,help);node.append(form);guest.focus();
 }
 const cacheKey=uid=>general?'syncAdmission:v2:'+cfg.project+':'+uid:'pilotAdmission:v1:'+cfg.uuid;
 const cached=uid=>{try{return localStorage.getItem(cacheKey(uid))==='previously_verified';}catch{return false;}};
 function remember(uid,allowed){try{if(allowed)localStorage.setItem(cacheKey(uid),'previously_verified');else localStorage.removeItem(cacheKey(uid));}catch{}}
 function show(message){
  globalThis.AVENTURA_SYNC_ADMISSION={confirmed:false,offline:false};
  const app=document.querySelector('.app');if(app)app.inert=true;
  if(!node){
   node=document.createElement('section');node.id='pilotAdmission';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label','Sincronización de cuenta');
   node.style.cssText='position:fixed;inset:0;z-index:2147483000;overflow:auto;background:#10251f;color:white;padding:clamp(16px,4vw,32px);box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);align-content:safe center;gap:16px;font:18px system-ui';
   const title=document.createElement('h1');title.textContent='Aventura de Palabras · Sincronización';const text=document.createElement('p');text.setAttribute('role','status');
   const retry=document.createElement('button');retry.textContent='Comprobar sincronización';retry.onclick=()=>void check();
   const account=document.createElement('button');account.textContent='Ingresar con mi cuenta';account.onclick=()=>{if(globalThis.NativePrototype)globalThis.NativePrototype.showAccount();else window.open(cfg.publicPwa,'_blank','noopener');};
   node.append(title,text,retry,account);document.body.append(node);
  }
  node.querySelector('p').textContent=message;
  node.querySelector('#accountEntry')?.remove();
  node.querySelectorAll(':scope > button').forEach(b=>b.hidden=false);
  node.querySelector('h1').textContent='Aventura de Palabras · Sincronización';
  globalThis.dispatchEvent(new Event('pilot-admission-changed'));
 }
 function admit(uid,offline=false){
  node?.remove();node=null;let notice=document.getElementById('pilotOfflineNotice');
  if(offline){if(!notice){notice=document.createElement('p');notice.id='pilotOfflineNotice';notice.setAttribute('role','status');(document.querySelector('#modalConfiguracion .panel-configuracion')||document.body).prepend(notice);}notice.textContent='Sin conexión: última copia local de esta cuenta. Los avances no están confirmados por Supabase.';}else notice?.remove();
  globalThis.AVENTURA_SYNC_ADMISSION={owner:uid,confirmed:!offline,offline};globalThis.dispatchEvent(new Event('pilot-admission-confirmed'));
  const app=document.querySelector('.app');if(app&&!document.getElementById('introOficial'))app.inert=false;
  globalThis.dispatchEvent(new Event('pilot-admission-changed'));
 }
 function deadline(promise,ms=10000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('ADMISSION_TIMEOUT')),ms);})]).finally(()=>clearTimeout(timer));}
 function diagnose(phase,error){globalThis.AVENTURA_SYNC_DIAGNOSTIC={phase,code:String(error?.code||error?.message==='ADMISSION_TIMEOUT'&&'ADMISSION_TIMEOUT'||'UNAVAILABLE').slice(0,60),status:Number(error?.status)||null,checkedAt:new Date().toISOString()};}
 function recheck(){if(entryBusy)return;generation++;show('Comprobando tu cuenta y la sincronización…');clearTimeout(scheduled);scheduled=setTimeout(()=>void check(),0);}
 async function recuperarCopias(uid){
  if(!globalThis.AccountRuntimeV3?.installed||!globalThis.AdventureAccountV2?.installed)return true;
  globalThis.GameWallet.connect(client,uid);
  await Promise.all([globalThis.AccountRuntimeV3.connect(client,uid),globalThis.AdventureAccountV2.connect(client,uid)]);
  if(navigator.onLine)await Promise.all([globalThis.AccountRuntimeV3.refresh(),globalThis.AdventureAccountV2.refresh()]);
  return globalThis.AccountRuntimeV3.state()?.userId===uid&&globalThis.AdventureAccountV2.state()?.userId===uid&&(!navigator.onLine||globalThis.AccountRuntimeV3.read()?.confirmed);
 }
 async function check(){
  if(entryBusy)return;
  const ticket=++generation;show('Comprobando tu cuenta y la sincronización…');const current=()=>ticket===generation;
  node.querySelector('button').disabled=true;
  try{
   await deadline(globalThis.AventuraOnline.cargarSupabase());if(!current())return;client=globalThis.AventuraSupabase.obtenerCliente();
   if(navigator.onLine&&!subscription&&client.auth.onAuthStateChange)subscription=client.auth.onAuthStateChange(()=>recheck());
   const saved=globalThis.AventuraSupabase.tieneSesionGuardada?.();
   const local=!navigator.onLine&&globalThis.AventuraSupabase.leerSesionLocal?globalThis.AventuraSupabase.leerSesionLocal():await deadline(client.auth.getSession());if(!current())return;
   let session=local.data?.session;
   if(local.error){diagnose('session',local.error);show('No pudimos recuperar tu sesión. Reconectá y reintentá sin borrar datos.');return;}
   if(cfg.accountChoice&&general&&cfg.allowGuests&&session?.user?.is_anonymous!==false&&entryChoice()!=='guest'){
    welcome();return;
   }
   if(!session?.user?.id&&general&&cfg.allowGuests){
    if(saved){show('No pudimos recuperar tu jugador guardado. Reconectá y reintentá sin borrar datos.');return;}
    if(!navigator.onLine){show('Para tu primer ingreso como invitado necesitás conexión a internet. Conectate y tocá «Comprobar sincronización»; no necesitás correo.');return;}
    show('Creando tu jugador invitado. No necesitás correo; esperá un momento…');node.querySelector('button').disabled=true;
    session=await deadline(globalThis.VersusRoomSupabase.recuperarSesion(client),25000);if(!current())return;
   }
   const uid=session?.user?.id;
   if(!uid){show('Ingresá con tu cuenta habitual. Esta candidata no crea cuentas nuevas.');return;}
   if(!general&&uid!==cfg.uuid){show('Esta candidata está limitada a la cuenta autorizada del piloto.');return;}
   if(general&&!cfg.allowGuests&&session.user.is_anonymous===true){remember(uid,false);show('Para recuperar tu progreso entre dispositivos, ingresá con tu cuenta verificada. No se crea un invitado nuevo.');return;}
   if(!navigator.onLine){
    if(!cached(uid)){show('Conectate una vez para verificar esta cuenta y su sincronización antes de usar su copia offline.');return;}
    const recovered=await deadline(recuperarCopias(uid),20000);if(!current())return;
    if(!recovered){show('No hay una copia local completa de esta cuenta. Reconectá para recuperarla sin borrar datos.');return;}
    admit(uid,true);return;
   }
   const verified=await deadline(client.auth.getUser());if(!current())return;const user=verified.data?.user;
   if(verified.error){diagnose('identity',verified.error);if([401,403].includes(verified.error.status))remember(uid,false);show('No pudimos verificar la conexión con tu cuenta. Tus datos se conservan; volvé a comprobar la sincronización.');return;}
   const guest=cfg.allowGuests&&user?.is_anonymous===true;
   if(user?.id!==uid||(general&&!guest&&(user.is_anonymous===true||!(user.email_confirmed_at||user.phone_confirmed_at||user.confirmed_at)))){remember(uid,false);show('No pudimos verificar esta cuenta. Volvé a ingresar con tu cuenta habitual.');return;}
   if(guest)globalThis.AventuraSupabase.recordarInvitado?.(user);
   const result=await deadline(client.rpc('account_state_v3'));if(!current())return;
   const latest=await deadline(client.auth.getSession());if(!current())return;
   if(latest.error){diagnose('session',latest.error);show('No pudimos volver a consultar tu sesión. Reconectá y comprobá la sincronización; tus datos se conservan.');return;}
   if(latest.data?.session?.user?.id!==uid){recheck();return;}
   // A transient read failure is not an account revocation. Keep the prior
   // admission proof and snapshots, but never admit online from this error.
   if(result.error){diagnose('account-read',result.error);show('No pudimos consultar la sincronización. Tus datos se conservan; reconectá y volvé a intentar.');return;}
   const state=result.data;
   if(state?.userId!==uid||state.schemaVersion!==3||!state.enabled||(general&&state.adventureState?.userId!==uid)||!state.adventureState?.adventure?.enabled){remember(uid,false);show('La sincronización está suspendida o todavía no está activada para esta cuenta. Tus datos se conservan.');return;}
   const recovered=await deadline(recuperarCopias(uid),20000);if(!current())return;
   if(!recovered){show('No pudimos recuperar la copia de esta cuenta. Reconectá y volvé a intentar sin borrar datos.');return;}
   remember(uid,true);globalThis.AVENTURA_SYNC_DIAGNOSTIC={phase:'ready',checkedAt:new Date().toISOString()};admit(uid);
  }catch(error){if(current()){diagnose('recovery',error);show('No pudimos comprobar la sincronización. Reconectá y volvé a intentar; no borres tus datos.');}}
  finally{if(current()&&node)node.querySelector('button').disabled=false;}
 }
 function start(){void check();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 for(const event of ['online','offline','focus'])window.addEventListener(event,()=>recheck());
 // Snapshots written by another tab are not an identity change. Rechecking on
 // every snapshot creates a feedback loop because confirmedAt changes per read.
 window.addEventListener('storage',event=>{
  if(event.key===null||event.key==='sb-'+cfg.project+'-auth-token'){
   if(document.hidden){generation++;show('Tu sesión cambió. La verificaremos al volver al juego.');}
   else recheck();
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')recheck();});
})();
