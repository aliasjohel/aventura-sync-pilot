/* Owner-verified admission. Guest bootstrap shares the adapter's persistent session lock. */
(() => {
 'use strict';
 const cfg=globalThis.AVENTURA_PILOT_CONFIG,general=cfg?.scope==='verified-accounts';
 let node,client,subscription,generation=0,scheduled,entryBusy=false,entryStatus='',entryEmail='',forcedEntry=false,entryUser=null;
 const googleCopy={
  es:{start:'Continuar con Google',link:'Vincular mi cuenta con Google',login:'Cambiar de jugador',manage:'Vincular o cambiar cuenta',current:'Volver a mi jugador',saved:'Tu jugador está vinculado a Google. Al cambiar, cada perfil conserva por separado sus monedas, personajes, compras y progreso.',guestSafe:'Vinculá Google a este invitado para conservar el mismo jugador y poder recuperarlo. Antes de cambiar de jugador, necesitás completar esa vinculación.',switch:'Vas a abrir otro jugador de Google. Tu jugador actual conservará sus datos y podrás volver ingresando con su Google vinculado. No se trasladarán ni se fusionarán monedas, compras o progreso. ¿Querés cambiar?',conflict:'Ese Google ya pertenece a otro jugador. Tu sesión actual sigue intacta. Para guardar este invitado, elegí un Google que todavía no tenga otro jugador.',linkFirst:'Primero vinculá Google a este jugador. Un invitado sin vincular no puede cambiar de jugador porque perdería su forma de volver.',cancelled:'Cancelaste el ingreso con Google. Conservás tu jugador actual.',failed:'No pudimos completar Google. Conservás el acceso a tu jugador actual; comprobá la conexión y reintentá.',linked:'Tu cuenta está vinculada a Google y conserva el mismo jugador.',switched:'Ingreso confirmado. Estás usando los datos de este jugador.',pending:'Ya hay un ingreso con Google pendiente. Completalo o cancelalo antes de iniciar otro.',dismiss:'Entendido'},
  en:{start:'Continue with Google',link:'Link my account with Google',login:'Switch player',manage:'Link or switch account',current:'Return to my player',saved:'Your player is linked to Google. Each profile keeps its own coins, characters, purchases and progress when you switch.',guestSafe:'Link Google to this guest to keep and recover the same player. Complete linking before switching players.',switch:'You will open another Google player. Your current player keeps its data and can be recovered with its linked Google account. Coins, purchases and progress will not transfer or merge. Switch player?',conflict:'That Google account already belongs to another player. Your current session is intact. To save this guest, choose a Google account without another player.',linkFirst:'Link Google to this player first. An unlinked guest cannot switch players because it would lose its way back.',cancelled:'Google sign-in cancelled. You keep your current player.',failed:'Google sign-in could not finish. You keep access to your current player; check the connection and retry.',linked:'Your account is linked to Google and keeps the same player.',switched:'Sign-in confirmed. You are using this player’s data.',pending:'A Google sign-in is pending. Finish or cancel it before starting another.',dismiss:'Got it'},
  'pt-BR':{start:'Continuar com Google',link:'Vincular minha conta ao Google',login:'Trocar de jogador',manage:'Vincular ou trocar de conta',current:'Voltar ao meu jogador',saved:'Seu jogador está vinculado ao Google. Cada perfil mantém suas próprias moedas, personagens, compras e progresso ao trocar.',guestSafe:'Vincule Google a este convidado para manter e recuperar o mesmo jogador. Conclua a vinculação antes de trocar de jogador.',switch:'Você abrirá outro jogador do Google. O jogador atual mantém seus dados e pode ser recuperado com seu Google vinculado. Moedas, compras e progresso não serão transferidos ou mesclados. Trocar de jogador?',conflict:'Esse Google já pertence a outro jogador. Sua sessão atual permanece intacta. Para salvar este convidado, escolha um Google sem outro jogador.',linkFirst:'Primeiro vincule Google a este jogador. Um convidado não vinculado não pode trocar de jogador porque perderia o caminho de volta.',cancelled:'Entrada com Google cancelada. Seu jogador atual foi mantido.',failed:'Não foi possível concluir a entrada com Google. Você mantém o acesso ao jogador atual; confira a conexão e tente novamente.',linked:'Sua conta está vinculada ao Google e mantém o mesmo jogador.',switched:'Entrada confirmada. Você está usando os dados deste jogador.',pending:'Existe uma entrada com Google pendente. Conclua ou cancele antes de iniciar outra.',dismiss:'Entendi'}
 };
 const googleWords=()=>googleCopy[globalThis.I18n?.language]||googleCopy.es;
 const googleMessage=code=>{const w=googleWords();return code==='GOOGLE_PROFILE_CONFLICT'?w.conflict:code==='LINK_CURRENT_PLAYER_FIRST'?w.linkFirst:code==='AUTH_CANCELLED'?w.cancelled:code==='linked'?w.linked:code==='switched'?w.switched:w.failed;};
 function googleNotice(code){
  document.getElementById('googleAccountNotice')?.remove();const box=document.createElement('aside');box.id='googleAccountNotice';box.setAttribute('role','status');box.style.cssText='position:fixed;inset:12px 12px auto;z-index:2147483100;max-width:560px;margin:auto;padding:16px;background:#10251f;color:white;border:1px solid #80dbc0;border-radius:12px;font:16px system-ui;box-shadow:0 6px 22px #0008';
  const text=document.createElement('p');text.textContent=googleMessage(code);const close=document.createElement('button');close.type='button';close.textContent=googleWords().dismiss;close.style.cssText='min-height:44px;padding:8px 16px';close.onclick=()=>box.remove();box.append(text,close);document.body.append(box);
 }
 function resumeGoogle(code){entryBusy=false;forcedEntry=false;entryStatus='';try{chooseEntry('guest');}catch{}googleNotice(code);recheck();}
 window.addEventListener('google-account-settled',event=>resumeGoogle(event.detail?.code));
 const entryKey='aventura-account-choice:v1:'+cfg.project;
 function entryChoice(){try{return localStorage.getItem(entryKey);}catch{return null;}}
 function chooseEntry(value){localStorage.setItem(entryKey,value);}
 const entryCopy={
  es:{title:'Bienvenido a Aventura de Palabras',intro:'Elegí cómo querés entrar.',email:'Tu correo',create:'Crear cuenta con correo',login:'Ya tengo cuenta',guest:'Continuar como invitado',help:'Como invitado conservás tu jugador en esta aplicación. Si borrás sus datos o cambiás de teléfono, podés perder el acceso a tu progreso. Vinculá Google a este invitado para poder recuperarlo.',sent:'Revisá tu correo y confirmá el enlace. Después volvé aquí. También podés continuar como invitado mientras tanto.',failed:'No pudimos enviar el correo. Revisá la dirección e intentá de nuevo en unos minutos.',offline:'Necesitás conexión para tu primer ingreso o para entrar con correo.',busy:'Enviando…'},
  en:{title:'Welcome to Aventura de Palabras',intro:'Choose how to sign in.',email:'Your email',create:'Create account with email',login:'I already have an account',guest:'Continue as guest',help:'As a guest, your player stays in this app. Clearing its data or changing phones can cost you access to your progress. Link Google to this guest to recover it.',sent:'Check your email and confirm the link, then return here. You can also continue as a guest in the meantime.',failed:'Could not send the email. Check the address and try again in a few minutes.',offline:'Your first sign-in and email sign-in require a connection.',busy:'Sending…'},
  'pt-BR':{title:'Boas-vindas a Aventura de Palabras',intro:'Escolha como entrar.',email:'Seu e-mail',create:'Criar conta com e-mail',login:'Já tenho conta',guest:'Continuar como convidado',help:'Como convidado, seu jogador fica neste aplicativo. Apagar os dados ou trocar de celular pode fazer você perder o acesso ao progresso. Vincule Google a este convidado para recuperá-lo.',sent:'Confira seu e-mail e confirme o link. Depois volte aqui. Você também pode continuar como convidado enquanto isso.',failed:'Não foi possível enviar o e-mail. Confira o endereço e tente novamente em alguns minutos.',offline:'A primeira entrada e a entrada por e-mail precisam de conexão.',busy:'Enviando…'}
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
  const words=googleWords();
  const guest=document.createElement('button');guest.type='button';guest.textContent=entryUser?words.current:copy.guest;
  const google=document.createElement('button');google.type='button';google.textContent=entryUser?words.link:words.start;google.disabled=globalThis.AccountGoogle?.available?.()!==true;google.hidden=google.disabled;
  const existing=document.createElement('button');existing.type='button';existing.textContent=words.login;const linked=entryUser?.is_anonymous===false&&entryUser?.identities?.some(i=>i.provider==='google'&&i.user_id===entryUser.id);existing.disabled=google.disabled||!linked;existing.hidden=google.hidden||!entryUser;google.hidden=google.hidden||Boolean(linked);
  const googleError=error=>googleMessage(error?.code);
  const cancelGoogle=document.createElement('button');cancelGoogle.type='button';cancelGoogle.textContent=({'es':'Cancelar ingreso con Google','en':'Cancel Google sign-in','pt-BR':'Cancelar entrada com Google'})[globalThis.I18n?.language]||'Cancelar ingreso con Google';cancelGoogle.hidden=!globalThis.AccountGoogle?.pending?.();
  cancelGoogle.onclick=()=>{if(entryBusy)return;globalThis.AccountGoogle?.cancel();resumeGoogle('AUTH_CANCELLED');};
  async function googleAction(switching){
   if(entryBusy||globalThis.AccountGoogle?.available?.()!==true)return;
   if(switching&&!linked){entryStatus=words.linkFirst;welcome();return;}if(switching&&!confirm(words.switch))return;
   entryBusy=true;form.querySelectorAll('button,input').forEach(b=>b.disabled=true);
   try{chooseEntry('google-pending');const result=await (switching?AccountGoogle.login({confirmProfileSwitch:true}):entryUser?AccountGoogle.link():AccountGoogle.login());if(result.status==='already_linked')resumeGoogle('linked');}
   catch(error){if(error?.code==='PENDING')entryStatus=words.pending;else if(error?.code!=='BUSY')resumeGoogle(error?.code);}
   finally{entryBusy=false;recheck();}
  }
  google.onclick=()=>void googleAction(false);existing.onclick=()=>void googleAction(true);
  const help=document.createElement('p');help.textContent=linked?words.saved:entryUser?words.guestSafe:copy.help;help.style.cssText='font-size:14px;line-height:1.5';
  const send=async registering=>{
   if(cfg.emailRegistrationEnabled!==true)return;
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
  guest.onclick=()=>{try{if(globalThis.AccountGoogle?.pending?.())AccountGoogle.cancel();chooseEntry('guest');forcedEntry=false;entryStatus='';void check();}catch{entryStatus=copy.failed;welcome();}};
  for(const e of [email,create,login,google,existing,cancelGoogle,guest])e.style.cssText='box-sizing:border-box;width:100%;min-width:0;white-space:normal;min-height:46px;padding:12px;border-radius:10px;font:inherit;transform:none';
  if(cfg.emailRegistrationEnabled===true)form.append(label,email,create,login);
  form.append(google,existing,cancelGoogle,guest,help);node.append(form);guest.focus();
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
  try{const n=JSON.parse(sessionStorage.getItem('aventura-google-notice:v1')||'null');if(n){sessionStorage.removeItem('aventura-google-notice:v1');if(n.owner===uid)googleNotice(n.code);}}catch{}
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
  if(entryBusy||globalThis.AccountGoogle?.processing?.())return;
  const ticket=++generation;show('Comprobando tu cuenta y la sincronización…');const current=()=>ticket===generation;
  node.querySelector('button').disabled=true;
  try{
   await deadline(globalThis.AventuraOnline.cargarSupabase());if(!current())return;client=globalThis.AventuraSupabase.obtenerCliente();
   try{await globalThis.AccountGoogle?.finishPending();}catch(error){diagnose('google-return',error);forcedEntry=false;entryStatus='';chooseEntry('guest');googleNotice(error?.code);}
   if(navigator.onLine&&!subscription&&client.auth.onAuthStateChange)subscription=client.auth.onAuthStateChange(()=>recheck());
   const saved=globalThis.AventuraSupabase.tieneSesionGuardada?.();
   const local=!navigator.onLine&&globalThis.AventuraSupabase.leerSesionLocal?globalThis.AventuraSupabase.leerSesionLocal():await deadline(client.auth.getSession());if(!current())return;
   let session=local.data?.session;
   entryUser=session?.user||null;
   if(forcedEntry&&session?.user?.id&&navigator.onLine){
    const proof=await deadline(client.auth.getUser());if(!current())return;if(!proof.error&&proof.data?.user?.id===session.user.id)entryUser=proof.data.user;
   }
   if(local.error){diagnose('session',local.error);show('No pudimos recuperar tu sesión. Reconectá y reintentá sin borrar datos.');return;}
   // Existing players are not forced through onboarding after an update.
   if(!forcedEntry&&session?.user?.id&&!entryChoice())chooseEntry('guest');
   if(forcedEntry||cfg.accountChoice&&general&&cfg.allowGuests&&session?.user?.is_anonymous!==false&&entryChoice()!=='guest'){
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
 function requestEntry(){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();forcedEntry=true;entryStatus='';void check();}
 globalThis.PlayerAccountChoice=Object.freeze({open:requestEntry});
 function start(){
  const button=document.createElement('button');button.type='button';button.id='managePlayerAccount';button.textContent=googleWords().manage;button.onclick=requestEntry;
  globalThis.I18n?.subscribe?.(()=>{button.textContent=googleWords().manage;});
  (document.querySelector('#modalConfiguracion .panel-configuracion')||document.body).append(button);
  void check();
 }
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
