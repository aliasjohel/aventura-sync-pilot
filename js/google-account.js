/* Shared PWA / Android OAuth. Google results are verified in an isolated client before adoption. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoogleAccount=api;})(globalThis,()=>{
 'use strict';
 const KEY='aventura-google-pending:v1';
 function create({client,stageClient,adoptSession=(c,tokens)=>c.auth.setSession(tokens),storage,enabled=()=>false,providerSettings,bootstrap,hasSavedIdentity=()=>false,callback,open,completed=()=>{},now=()=>Date.now(),random=()=>crypto.randomUUID()}){
  const base=new URL(callback);let busy=false,committing=false;
  const fail=code=>{const e=Error(code);e.code=code;throw e;};
  const exclusive=async fn=>{if(busy)fail('BUSY');busy=true;try{return await fn();}finally{busy=false;}};
  function pending(){let p;try{p=JSON.parse(storage.getItem(KEY)||'null');}catch{fail('STORAGE_UNAVAILABLE');}if(p&&(now()-p.at>900000||now()<p.at)){storage.removeItem(KEY);return null;}return p;}
  function clear(p){if(pending()?.flow===p.flow)storage.removeItem(KEY);}
  function current(p){if(pending()?.flow!==p.flow)fail('AUTH_CANCELLED');}
  async function configured(){if(!enabled())fail('GOOGLE_NOT_VERIFIED');if(typeof stageClient!=='function')fail('CONFIG_REQUIRED');if((await providerSettings()).external?.google!==true)fail('GOOGLE_DISABLED');}
  async function session(c){const r=await c.auth.getSession();if(r.error)fail('SESSION_UNAVAILABLE');return r.data?.session;}
  async function verified(c,s){const r=await c.auth.getUser();if(r.error||!r.data?.user?.id||r.data.user.id!==s?.user?.id)fail('SESSION_UNAVAILABLE');return r.data.user;}
  async function googleIdentity(c,uid){const r=await c.auth.getUserIdentities();if(r.error)fail('IDENTITY_UNAVAILABLE');return r.data?.identities?.some(i=>i.provider==='google'&&i.user_id===uid)===true;}
  function begin(kind,owner){if(pending())fail('PENDING');const p={version:2,kind,owner:owner||null,flow:random(),at:now()};storage.setItem(KEY,JSON.stringify(p));if(pending()?.flow!==p.flow)fail('STORAGE_UNAVAILABLE');return p;}
  function redirect(p){const u=new URL(base);u.searchParams.set('flow',p.flow);u.searchParams.set('av_google_flow',p.flow);return u.href;}
  function oauthUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!['accounts.google.com','hlixavucxdxevbbhlxkc.supabase.co'].includes(u.hostname))fail('OAUTH_URL_INVALID');return u.href;}
  function conflict(error){return ['identity_already_exists','identity_already_linked','email_exists'].includes(error?.code);}
  async function link(){return exclusive(async()=>{
   await configured();const c=await client();let s=await session(c);
   if(!s){if(hasSavedIdentity())fail('SAVED_PLAYER_UNAVAILABLE');s=await bootstrap(c);}
   const u=await verified(c,s);if(await googleIdentity(c,u.id))return {status:'already_linked',userId:u.id};
   const p=begin('link',u.id);
   try{const r=await c.auth.linkIdentity({provider:'google',options:{redirectTo:redirect(p),scopes:'openid email profile',skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
    if(r.error)fail(conflict(r.error)?'GOOGLE_PROFILE_CONFLICT':'GOOGLE_FAILED');if(!r.data?.url)fail('GOOGLE_FAILED');current(p);await open(oauthUrl(r.data.url));return {status:'opened',userId:u.id};
   }catch(e){clear(p);throw e;}
  });}
  async function login({confirmProfileSwitch=false}={}){return exclusive(async()=>{
   await configured();const c=await client(),s=await session(c);
   if(s&&!confirmProfileSwitch)fail('PROFILE_SWITCH_REQUIRES_CONFIRMATION');
   if(!s&&hasSavedIdentity())fail('SAVED_PLAYER_UNAVAILABLE');
   if(s){const u=await verified(c,s);if(u.is_anonymous!==false||!await googleIdentity(c,u.id))fail('LINK_CURRENT_PLAYER_FIRST');}
   const p=begin('login',s?.user?.id);
   try{const r=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect(p),scopes:'openid email profile',skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});if(r.error||!r.data?.url)fail('GOOGLE_FAILED');current(p);await open(oauthUrl(r.data.url));return {status:'opened'};}catch(e){clear(p);throw e;}
  });}
  async function handleUrl(value){
   let url;try{url=new URL(value);}catch{return {status:'ignored'};}
   const fragment=new URLSearchParams(url.hash.slice(1));
   const fragmentError=Boolean(url.hash)&&[...fragment.keys()].every(k=>['error','error_code','error_description'].includes(k)||k==='sb'&&fragment.get(k)===''&&fragment.getAll(k).length===1)&&(fragment.has('error')||fragment.has('error_code'));
   const p=pending();if(!p||url.origin!==base.origin||url.pathname!==base.pathname||url.username||url.password||url.hash&&!fragmentError||url.searchParams.getAll('av_google_flow').length!==1||url.searchParams.get('av_google_flow')!==p.flow)return {status:'ignored'};
   return exclusive(async()=>{
    let isolated;
    try{
     await configured();current(p);
     if(fragmentError||url.searchParams.has('error')||url.searchParams.has('error_code'))fail(conflict({code:fragmentError?fragment.get('error_code'):url.searchParams.get('error_code')})?'GOOGLE_PROFILE_CONFLICT':'AUTH_CANCELLED');
     const codes=url.searchParams.getAll('code'),flowId=url.searchParams.get('sb_flow_id');if(codes.length!==1||!codes[0]||codes[0].length>2048||flowId&&!/^[a-f0-9]{32}$/i.test(flowId))fail('CALLBACK_INVALID');
     const c=await client(),previous=await session(c);
     // Every callback is tied to the initiating player, including account switches.
     if((previous?.user?.id||null)!==p.owner)fail('ACCOUNT_CHANGED');
     isolated=await stageClient({flow:p.flow,flowId});const candidate=isolated?.client;
     if(!candidate||candidate===c)fail('CONFIG_REQUIRED');current(p);
     const r=await candidate.auth.exchangeCodeForSession(codes[0],flowId?{flowId}:undefined);if(r.error)fail(conflict(r.error)?'GOOGLE_PROFILE_CONFLICT':'LINK_EXPIRED');current(p);
     const proposed=await session(candidate),u=await verified(candidate,proposed);
     if(u.is_anonymous!==false||p.kind==='link'&&u.id!==p.owner)fail('ACCOUNT_MISMATCH');
     if(!await googleIdentity(candidate,u.id))fail('IDENTITY_UNAVAILABLE');
     // No primary SDK auth event or game hydration occurs before these checks.
     current(p);if(((await session(c))?.user?.id||null)!==p.owner)fail('ACCOUNT_CHANGED');
     committing=true;
     const adopted=await adoptSession(c,{access_token:proposed.access_token,refresh_token:proposed.refresh_token},p.owner);if(adopted.error)fail('SESSION_UNAVAILABLE');
     clear(p);await completed({userId:u.id,kind:p.kind});return {status:'authenticated',userId:u.id};
    }catch(e){clear(p);throw e;}finally{committing=false;try{await isolated?.close?.();}catch{}}
   });
  }
  function cancel(){if(committing)fail('BUSY');const p=pending();if(p)clear(p);return {status:'cancelled'};}
  return Object.freeze({link,login,handleUrl,pending:()=>Boolean(pending()),processing:()=>busy,cancel});
 }
 return Object.freeze({create});
});
