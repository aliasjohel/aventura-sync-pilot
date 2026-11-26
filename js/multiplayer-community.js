/* Read-only result presentation and an owner-scoped, persistent likes inbox. */
(() => {
 'use strict';
 const root=globalThis,el=id=>document.getElementById(id);
 const words={
 es:{winner:'GANADOR',loser:'DERROTADO',draw:'EMPATE',series:'SERIE DE REVANCHAS',seriesHelp:'La serie termina al salir o tras 30 minutos sin continuar.',coins:'Monedas',xp:'XP',points:'Puntos',loading:'Consultando al servidor…',failed:'No pudimos consultar los datos. Reintentá cuando vuelva la conexión.',retry:'Reintentar',likes:'Me gusta recibidos',rivals:'Estadísticas por rival',notification:'👍 Tenés {n} Me gusta sin leer',total:'{n} Me gusta en total',sent:'Te dio Me gusta',read:'Marcar como leído',readDone:'Leído',more:'Ver más',empty:'Todavía no hay registros.',stats:'{played} duelos · {wins} victorias · {losses} derrotas · {draws} empates',close:'Cerrar',finished:'DUELO FINALIZADO',won:'¡Ganaste el duelo!',lost:'Victoria de tu rival',tied:'¡Duelo empatado!'},
 en:{winner:'WINNER',loser:'DEFEATED',draw:'DRAW',series:'REMATCH SERIES',seriesHelp:'The series ends when either player leaves or after 30 minutes without continuing.',coins:'Coins',xp:'XP',points:'Points',loading:'Checking with the server…',failed:'Could not load the data. Retry when the connection returns.',retry:'Retry',likes:'Received likes',rivals:'Stats by opponent',notification:'👍 You have {n} unread likes',total:'{n} likes in total',sent:'Sent you a like',read:'Mark as read',readDone:'Read',more:'Show more',empty:'No records yet.',stats:'{played} duels · {wins} wins · {losses} losses · {draws} draws',close:'Close',finished:'DUEL FINISHED',won:'You won the duel!',lost:'Your opponent wins',tied:'Duel drawn!'},
 'pt-BR':{winner:'VENCEDOR',loser:'DERROTADO',draw:'EMPATE',series:'SÉRIE DE REVANCHES',seriesHelp:'A série termina quando alguém sai ou após 30 minutos sem continuar.',coins:'Moedas',xp:'XP',points:'Pontos',loading:'Consultando o servidor…',failed:'Não foi possível consultar os dados. Tente novamente quando a conexão voltar.',retry:'Tentar novamente',likes:'Curtidas recebidas',rivals:'Estatísticas por adversário',notification:'👍 Você tem {n} curtidas não lidas',total:'{n} curtidas no total',sent:'Enviou uma curtida',read:'Marcar como lida',readDone:'Lida',more:'Ver mais',empty:'Ainda não há registros.',stats:'{played} duelos · {wins} vitórias · {losses} derrotas · {draws} empates',close:'Fechar',finished:'DUELO ENCERRADO',won:'Você venceu o duelo!',lost:'Vitória do adversário',tied:'Duelo empatado!'}
 };
 const text=(key,params={})=>Object.entries(params).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),(words[root.I18n?.language]||words.es)[key]);
 const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
 const own=()=>root.CosmeticStore?.read().accountId||null;
 const alias=p=>root.VersusRoom?.aliasVisible(p.alias)||'Aventurero';
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 let result=null,resultGeneration=0,inbox=null,community=null,generation=0,polling=false,lastPoll=0,lastOwner=null;
 function clearResult(){resultGeneration++;result=null;el('duelPodium').hidden=true;el('duelPodium').replaceChildren();el('resultadoRondaVersus').classList.remove('has-duel-podium');el('pantallaVersus').classList.remove('showing-duel-result');}
 function renderResult(){
  const c=result;if(!c||!c.valid()||c.user!==c.adapter.obtenerUsuarioId())return;
  const target=el('duelPodium');target.hidden=false;target.replaceChildren();el('pantallaVersus').classList.add('showing-duel-result');
  if(c.state!=='ready'){
   target.append(node('p',text(c.state==='failed'?'failed':'loading')));
   if(c.state==='failed'){const b=node('button',text('retry'));b.type='button';b.onclick=()=>void fetchResult(c);target.append(b);}return;
  }
  const r=c.receipt,grid=node('div',undefined,'duel-podium-grid');
  for(const p of r.players){
   const card=node('article',undefined,'duel-contender '+(p.draw?'is-draw':p.win?'is-winner':'is-loser'));
   const badge=node('strong',text(p.draw?'draw':p.win?'winner':'loser'),'duel-outcome');
   const identity=node('button',undefined,'duel-profile');identity.type='button';identity.append(root.PlayerAvatar.crear(p),node('span',alias(p),'duel-alias'));identity.onclick=()=>void root.PublicPlayerProfile.abrir(p.id);
   card.append(badge,identity);const rewards=node('dl',undefined,'duel-rewards');
   for(const [key,value]of [['coins',p.coins],['xp',p.xp],['points',p.points]])if(value!==null){const row=node('div');row.append(node('dt',text(key)),node('dd',(value>0?'+':'')+value));rewards.append(row);}
   card.append(rewards);grid.append(card);
  }
  target.append(grid);
  if(r.seriesId){const score=node('div',undefined,'duel-series');score.append(node('small',text('series')),node('strong',r.players.map(p=>p.seriesWins).join(' – ')),node('p',text('seriesHelp')));target.append(score);}
  el('resultadoRondaVersus').classList.add('has-duel-podium');
  el('etiquetaResultadoVersus').textContent=text('finished');
  el('tituloResultadoVersus').textContent=text(r.players[0].draw?'tied':r.players[0].win?'won':'lost');
 }
 async function fetchResult(c){
  if(result!==c||!c.valid())return;c.state='loading';renderResult();
  try{
   const r=await c.adapter.comunidad('result',{matchId:c.matchId});
   if(result!==c||c.generation!==resultGeneration||!c.valid()||c.user!==c.adapter.obtenerUsuarioId())return;
   if(r?.confirmed!==true||r.matchId!==c.matchId||r.userId!==c.user||r.players?.length!==2||r.players[0].id!==c.user||r.players[1].id===c.user||r.players.some(p=>!p.id||typeof p.win!=='boolean'||typeof p.draw!=='boolean'||!integer(p.coins)||!integer(p.xp)||p.points!==null&&!Number.isSafeInteger(p.points)||r.seriesId&&!integer(p.seriesWins)))throw Error('Unconfirmed duel');
   c.receipt=r;c.state='ready';renderResult();
  }catch{if(result===c&&c.valid()){c.state='failed';renderResult();}}
 }
 async function show(matchId,adapter,valid){clearResult();const c=result={matchId,adapter,valid,user:adapter.obtenerUsuarioId(),generation:resultGeneration,state:'loading'};await fetchResult(c);}
 function renderLabels(){
  el('viewReceivedLikes').textContent='👍 '+text('likes');el('viewRivalStats').textContent=text('rivals');
  el('closeCommunity').setAttribute('aria-label',text('close'));el('communityMore').textContent=text('more');el('communityRetry').textContent=text('retry');
  const b=el('likesNotification');b.hidden=!inbox?.unread;b.textContent=inbox?.unread?text('notification',{n:inbox.unread}):'';
 }
 function renderCommunity(){
  renderLabels();const c=community;if(!c)return;
  el('communityTitle').textContent=text(c.kind);el('communityItems').replaceChildren();
  el('communityStatus').textContent=c.state==='failed'||c.readFailed?text('failed'):c.state==='loading'?text('loading'):c.kind==='likes'?text('total',{n:c.total}):'';
  el('communityMore').hidden=!c.hasMore||c.state!=='ready';el('communityRetry').hidden=c.state!=='failed';
  for(const item of c.items){
   const p=c.kind==='likes'?item.sender:item.opponent,row=node('article',undefined,'community-row');
   const profile=node('button',undefined,'community-profile');profile.type='button';profile.append(root.PlayerAvatar.crear(p,{miniatura:true}),node('strong',alias(p)));profile.onclick=()=>void root.PublicPlayerProfile.abrir(p.id);
   const detail=node('div',undefined,'community-detail');
   if(c.kind==='likes'){
    row.dataset.likeId=item.match_id;row.classList.toggle('is-unread',!item.read_at);
    detail.append(node('p',text('sent')),node('small',new Intl.DateTimeFormat(root.I18n?.language||'es',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))));
    const mark=node('button',text(item.read_at?'readDone':'read'),'secundario');mark.type='button';mark.disabled=!!item.read_at||c.marking===item.match_id;
    mark.onclick=async()=>{
     if(c.marking)return;c.marking=item.match_id;c.readFailed=false;renderCommunity();
     try{const r=await root.PlayerProfile.comunidad('read',{matches:[item.match_id]});if(community!==c||c.user!==own()||r.userId!==c.user)return;item.read_at=new Date().toISOString();inbox={...inbox,unread:r.unread};}
     catch{if(community===c)c.readFailed=true;}
     finally{if(community===c){c.marking=null;renderCommunity();}}
    };detail.append(mark);
   }else detail.append(node('p',text('stats',item)));
   row.append(profile,detail);el('communityItems').append(row);
  }
  if(c.state==='ready'&&!c.items.length)el('communityItems').append(node('p',text('empty')));
 }
 async function loadCommunity(append=false){
  const c=community;if(!c||c.loading)return;c.loading=true;c.state='loading';renderCommunity();
  try{const r=await root.PlayerProfile.comunidad(c.kind,{offset:append?c.next:0});
   if(community!==c||c.user!==own()||r.userId!==c.user)return;
   if(!Array.isArray(r.items))throw Error('Invalid page');
   const items=append?[...c.items,...r.items]:r.items;
   const seen=new Set();c.items=items.filter(item=>{const key=c.kind==='likes'?item.match_id:item.opponent.id;if(seen.has(key))return false;seen.add(key);return true;});
   c.next=append?c.next+r.items.length:r.items.length;c.hasMore=r.hasMore;c.total=r.total;c.state='ready';if(c.kind==='likes')inbox=r;
  }catch{if(community===c)c.state='failed';}
  finally{if(community===c){c.loading=false;renderCommunity();}}
 }
 async function open(kind){community={kind,user:own(),items:[],next:0,state:'loading',hasMore:false};if(!el('multiplayerCommunity').open)el('multiplayerCommunity').showModal();el('multiplayerCommunity').scrollTop=0;await loadCommunity();}
 function reset(){generation++;inbox=null;community=null;lastOwner=own();lastPoll=0;clearResult();if(el('multiplayerCommunity').open)el('multiplayerCommunity').close();renderLabels();}
 async function poll(force=false){
  const user=own();if(user!==lastOwner)reset();
  if(!user||document.hidden||navigator.onLine===false||polling||!force&&Date.now()-lastPoll<60000)return;
  polling=true;lastPoll=Date.now();const g=generation;
  try{const r=await root.PlayerProfile.comunidad('likes',{offset:0});if(g!==generation||user!==own()||r.userId!==user)return;inbox=r;renderLabels();}
  catch{/* A failed read never acknowledges notifications. */}finally{polling=false;}
 }
 el('viewReceivedLikes').onclick=()=>void open('likes');el('likesNotification').onclick=()=>void open('likes');el('viewRivalStats').onclick=()=>void open('rivals');
 el('closeCommunity').onclick=()=>el('multiplayerCommunity').close();el('multiplayerCommunity').addEventListener('close',()=>{community=null;});
 el('communityMore').onclick=()=>void loadCommunity(true);el('communityRetry').onclick=()=>void loadCommunity(false);
 root.addEventListener('wallet-session-ended',reset);root.addEventListener('wallet-updated',()=>void poll());root.addEventListener('online',()=>void poll(true));
 root.addEventListener('focus',()=>void poll());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
 root.setInterval(()=>void poll(),60000);
 root.I18n?.subscribe(()=>{renderLabels();renderCommunity();renderResult();});renderLabels();
 root.MultiplayerResults=Object.freeze({show,clear:clearResult});
 root.MultiplayerCommunity=Object.freeze({open,refresh:()=>poll(true)});
 new MutationObserver(()=>{if(result&&el('resultadoRondaVersus').classList.contains('oculto'))clearResult();}).observe(el('resultadoRondaVersus'),{attributes:true,attributeFilter:['class']});
})();
