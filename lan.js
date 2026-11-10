/* CARANTIN local co-op v2: host owns the world in both campaign and free mode. */
'use strict';
const LAN_VERSION=2;
let lanLastSnapshot=0,lanLastInput=0,lanInput=null,lanInputAt=0,lanFireCooldown=0;
let lanHostPaused=false,lanGuestReady=false,lanLastUi=0,lanLootKey=null,lanLastMode=null;
let lanLastDialogueKey='',lanLastTravelKey='';
const lanBridge=window.CarantinLan;
function lanStatus(text){$('lanStatus').textContent=text;}
function lanBadge(text){$('lanBadge').textContent=text;$('lanBadge').style.display=text?'block':'none';}
function lanLeave(){
 if(lanRole==='solo')return;
 lanRole='solo';lanPeer=null;lanInput=null;lanGuestReady=false;lanHostPaused=false;
 lanLootKey=null;lanLastMode=null;lanLastDialogueKey='';lanLastTravelKey='';
 document.body.classList.remove('lanGuest','lanCampaign','lanHost');lanBadge('');
 $('dialogueOverlay').style.display='none';$('travelOverlay').style.display='none';
 if(lanBridge)lanBridge.close();
}
function lanExit(){
 lanLeave();
 if(running){$('pauseScreen').style.display='flex';returnToMenu();}
}
function lanOpen(){
 if(!lanBridge){
  lanStatus('Для локальной игры нужна версия APK 4.5 на двух Android-устройствах. Веб-версия остаётся одиночной.');
  $('lanHost').disabled=true;$('lanHostSave').disabled=true;$('lanJoin').disabled=true;
 }else{
  lanStatus('Подключи оба телефона с APK 4.5 к одной точке доступа. Ведущий выбирает сюжет или открытый мир.');
  $('lanHost').disabled=false;$('lanJoin').disabled=false;
 }
 lanModeButtons();
 $('lanModal').style.display='flex';
}
$('overlay').addEventListener('click',e=>{if(e.target.closest('#openLan'))lanOpen();});
$('lanCancel').addEventListener('click',()=>{
 if(lanRole==='guest'&&!lanGuestReady)lanLeave();
 $('lanModal').style.display='none';
});
function lanModeButtons(){
 document.querySelectorAll('.lanMode').forEach(b=>b.classList.toggle('active',b.dataset.mode===gameMode));
 $('lanHostSave').style.display=gameMode==='campaign'&&readCampaignSave()?'block':'none';
}
$('lanModal').addEventListener('click',e=>{
 const b=e.target.closest('.lanMode');
 if(b&&lanRole==='solo'){setGameMode(b.dataset.mode);lanModeButtons();}
});
function lanStartHost(saved=false){
 if(!lanBridge||running)return;
 if(saved&&!(gameMode==='campaign'&&readCampaignSave()))return;
 lanRole='host';lanPeer=null;lanLootKey=null;lanLastMode=null;
 const started=saved?loadCampaign():startGame();
 if(saved&&!started){lanRole='solo';return;}
 document.body.classList.add('lanHost');
 lanBridge.host();
 $('lanModal').style.display='none';
 lanBadge('📡 Ожидание второго игрока');
}
$('lanHost').addEventListener('click',()=>lanStartHost(false));
$('lanHostSave').addEventListener('click',()=>lanStartHost(true));
$('lanJoin').addEventListener('click',()=>{
 if(!lanBridge||running)return;
 lanRole='guest';lanGuestReady=false;
 lanStatus('Подключение…');
 lanBridge.join($('lanIp').value.trim().replace(/:8765$/,''));
});
// Called from Android on WebView's UI thread. All packets are JSON with a fixed schema.
window.lanReceive=function(kind,text){
 if(kind==='error'){
  if(lanRole==='guest'&&!lanGuestReady){lanLeave();lanStatus(text);}
  else if(lanRole==='host'){lanLeave();lanBadge('📡 '+text);}
  else lanBadge('📡 '+text);
  return;
 }
 if(kind==='hosting'&&lanRole==='host'){lanBadge('📡 Ведущий: '+text);return;}
 if(kind==='connected'){
  if(lanRole==='host'&&running){
   lanLootKey=null;lanLastSnapshot=0;lanInput=null;lanFireCooldown=0;
   lanPeer={x:player.x+36,y:player.y+36,r:15,angle:0,hp:100,inv:1,walkPhase:0,moving:false};
   lanBadge('📡 Второй игрок подключён');
  }else if(lanRole==='guest')lanStatus('Соединено. Загружаем мир ведущего…');
  return;
 }
 if(kind==='disconnected'){
  if(lanRole==='host'){lanPeer=null;lanInput=null;lanBadge('📡 Друг вышел · ожидание подключения');}
  else if(lanRole==='guest'){
   lanExit();lanOpen();lanStatus('Ведущий отключился. Подключись снова по его IP.');
  }
  return;
 }
 if(kind!=='data'||lanRole==='solo')return;
 let packet;
 try{packet=JSON.parse(text);}catch(_){return;}
 if(!packet||packet.v!==LAN_VERSION)return;
 if(lanRole==='host'&&packet.t==='input'&&lanPeer){
  // Never trust the client's position, weapon, damage, or world state.
  if(!Number.isFinite(packet.x)||!Number.isFinite(packet.y)||!Number.isFinite(packet.a))return;
  lanInput={x:Math.max(-1,Math.min(1,packet.x)),y:Math.max(-1,Math.min(1,packet.y)),
   a:packet.a,fire:packet.fire===true};
  lanInputAt=performance.now();
 }else if(lanRole==='host'&&packet.t==='interact'&&lanPeer&&
   gameMode==='campaign'&&!paused&&packet.stage===campaignStage&&
   packet.site===campaignObjectiveIndex&&campaignNearbySite(lanPeer)){
  campaignInspectSite(lanPeer);
 }else if(lanRole==='guest'&&packet.t==='state')lanApplyState(packet);
 else if(lanRole==='guest'&&packet.t==='finish'&&gameMode==='campaign'){
  lanLeave();campaignFinish();
 }
};
function lanHostTick(dt,now){
 if(!lanPeer)return;
 const p=lanPeer;
 p.inv=Math.max(0,(p.inv||0)-dt);
 if(p.hp<=0){
  p.respawn=(p.respawn||5)-dt;
  if(p.respawn<=0){p.x=player.x+30;p.y=player.y+30;p.hp=100;p.inv=2;p.respawn=0;}
  return;
 }
 const i=now-lanInputAt<350?lanInput:null;
 let x=i?i.x:0,y=i?i.y:0;
 const mag=Math.hypot(x,y);
 if(mag>1){x/=mag;y/=mag;}
 p.moving=mag>0.08;
 p.x+=x*195*dt;p.y+=y*195*dt;
 resolveObstacles(p,false);
 if(p.moving)p.walkPhase+=dt*9;
 if(i){p.angle=i.a;lanFireCooldown=Math.max(0,lanFireCooldown-dt);
  if(i.fire&&lanFireCooldown<=0&& !isInSafeZone(p.x,p.y,-4)){
   const a=i.a,w=weapons.pistol,mx=p.x+Math.cos(a)*24,my=p.y+Math.sin(a)*24;
   bullets.push({x:mx,y:my,px:mx,py:my,sx:mx,sy:my,
    vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,angle:a,damage:w.damage,
    crit:false,aoe:0,pierce:0,hitSet:null,burn:0,chill:0,flame:false,
    rocket:false,bolt:false,kind:'pistol',life:w.range/w.speed*1.05,color:'#70eaff'});
   lanFireCooldown=Math.max(.18,w.delay);
   alertZombiesBySound(p.x,p.y,250);
  }
 }
}
function lanDamagePeer(damage){
 if(!lanPeer||lanPeer.hp<=0||lanPeer.inv>0)return;
 lanPeer.hp=Math.max(0,lanPeer.hp-damage);lanPeer.inv=.65;
 if(lanPeer.hp<=0){lanPeer.respawn=5;addPopup(lanPeer.x,lanPeer.y-34,'ВОЗРОЖДЕНИЕ: 5 С','#70eaff',14);}
}
function lanSendSnapshot(now){
 if(!running||!lanPeer||now-lanLastSnapshot<100||!lanBridge)return;
 lanLastSnapshot=now;
 // Only transmit the second player's visible surroundings; the host owns all
 // combat, collisions and story progress. Do not serialize the whole city.
 const px=lanPeer.x,py=lanPeer.y,near=o=>Math.abs(o.x-px)<850&&Math.abs(o.y-py)<650;
 const z=zombies.filter(near).map(o=>({x:o.x,y:o.y,type:o.type,r:o.r,angle:o.angle,
  phase:o.phase,seed:o.seed,hit:o.hit,speed:o.speed,aggro:o.aggro,
  color:o.color,boostTimer:o.boostTimer,dashTimer:o.dashTimer,burnTimer:o.burnTimer,
  chillTimer:o.chillTimer,isWaveBoss:o.isWaveBoss,hp:o.hp,maxHp:o.maxHp}));
 const b=bullets.filter(near).map(o=>({x:o.x,y:o.y,vx:o.vx,vy:o.vy,sx:o.sx,sy:o.sy,
  color:o.color,kind:o.kind,rocket:o.rocket,bolt:o.bolt,flame:o.flame,angle:o.angle,life:o.life}));
 // Opened loot rarely changes. Omit it unless a node has been opened or sector changed.
 const opened=lootNodes.filter(n=>n.opened).map(n=>n.id);
 const lootKey=gameMode+':'+campaignStage+':'+opened.join('|');
 const sendLoot=lootKey!==lanLootKey;
 lanLootKey=lootKey;
 const c=gameMode==='campaign'?{
  stage:campaignStage,state:campaignState,objective:campaignObjectiveIndex,
  phase:campaignPhase,kills:campaignKills,total:campaignTotal,hold:Math.ceil(campaignHold),
  barrels:campaignBarrels.map(v=>v.live),
  dialogue:campaignDialogue?{
   who:campaignDialogue.lines[campaignDialogue.index].who,
   role:campaignDialogue.lines[campaignDialogue.index].role,
   text:campaignDialogue.lines[campaignDialogue.index].text,
   index:campaignDialogue.index,total:campaignDialogue.lines.length}:null,
  travel:campaignTravel?{from:campaignTravel.from,to:campaignTravel.to,
   progress:Math.min(1,(now-campaignTravel.start)/6100)}:null
 }:null;
 lanBridge.send(JSON.stringify({v:LAN_VERSION,t:'state',mode:gameMode,diff:currentDifficulty,
  paused:paused||waveChoosing,guest:{x:px,y:py,a:lanPeer.angle,hp:lanPeer.hp},
  host:{x:player.x,y:player.y,a:player.angle,hp:health},
  z,b,score,money,wave,waveKills,waveGoal,c,
  cars:vehicles.filter(near).map(v=>({id:v.id,x:v.x,y:v.y,angle:v.angle,hp:v.hp,broken:v.broken,
   vx:v.vx,vy:v.vy,steer:v.steer,hit:v.hit,ramCd:v.ramCd})),
  ...(sendLoot?{loot:opened}: {})}));
}
function lanApplyCampaign(c){
 if(!c||!Number.isInteger(c.stage)||c.stage<0||c.stage>=CAMPAIGN_LOCATIONS.length||
    !['investigate','approach','combat','hold','ready'].includes(c.state))return;
 if(gameMode!=='campaign')gameMode='campaign';
 const changed=campaignStage!==c.stage||!groundIsCampaign;
 if(changed){campaignLoadLocation(c.stage,null);lanLastUi=0;}
 campaignState=c.state;
 campaignObjectiveIndex=Math.max(0,Math.min(CAMPAIGN_MISSIONS[c.stage].sites.length,c.objective|0));
 campaignPhase=c.phase|0;campaignKills=c.kills|0;campaignTotal=c.total|0;
 campaignHold=c.hold||0;
 if(Array.isArray(c.barrels))for(let i=0;i<campaignBarrels.length;i++)campaignBarrels[i].live=c.barrels[i]!==false;
 const dialogue=$('dialogueOverlay');
 if(c.dialogue&&!paused){
  const d=c.dialogue,key=[d.who,d.index,d.text].join('|');
  if(key!==lanLastDialogueKey){
   lanLastDialogueKey=key;
   $('dlgSpeaker').textContent=d.who;
   $('dlgRole').textContent=d.role;
   $('dlgStep').textContent=`${d.index+1} / ${d.total}`;
   $('dlgText').textContent=d.text+'  ·  Ведущий выбирает ответ';
  }
  dialogue.style.display='flex';
 }else{dialogue.style.display='none';lanLastDialogueKey='';}
 const travel=$('travelOverlay');
 if(c.travel&&!paused){
  const t=c.travel,key=t.from+':'+t.to;
  if(key!==lanLastTravelKey){
   lanLastTravelKey=key;
   $('travelRoute').textContent=`🚗 ${CAMPAIGN_LOCATIONS[t.from].name} → ${CAMPAIGN_LOCATIONS[t.to].name}`;
   $('travelSay').textContent='Переезд ведёт ведущий. Вы прибываете в следующий сектор вместе.';
  }
  $('travelProgFill').style.width=(Math.max(0,Math.min(1,t.progress))*100).toFixed(0)+'%';
  travel.style.display='flex';
 }else{travel.style.display='none';lanLastTravelKey='';}
 return changed;
}
function lanApplyState(s){
 if(!s.guest||!s.host||!Array.isArray(s.z)||!Array.isArray(s.b)||
    !['campaign','free'].includes(s.mode)||s.z.length>600||s.b.length>1000||
    (s.mode==='campaign'&&(!s.c||!Number.isInteger(s.c.stage)||s.c.stage<0||s.c.stage>=CAMPAIGN_LOCATIONS.length||
     !['investigate','approach','combat','hold','ready'].includes(s.c.state)))||
    !Number.isFinite(s.guest.x)||!Number.isFinite(s.guest.y))return;
 if(!lanGuestReady){
  // Start without a second, local dialogue/simulation. The host supplies the
  // authoritative campaign sector and quest text in this first packet.
  setGameMode('free');startGame();
  lanGuestReady=true;
  $('lanModal').style.display='none';
  document.body.classList.add('lanGuest');
  resize(); // guest renders at DPR 1 instead of the costly default DPR 2
 }
 let sectorChanged=false;
 if(s.mode==='campaign'){
  document.body.classList.add('lanCampaign');
  sectorChanged=lanApplyCampaign(s.c);
 }else{
  document.body.classList.remove('lanCampaign');
  if(gameMode==='campaign'){
   gameMode='free';buildWorldGround();initLootState();initVehicles();
   $('dialogueOverlay').style.display='none';$('travelOverlay').style.display='none';
  }
 }
 lanHostPaused=!!s.paused;
 const label=s.guest.hp<=0?'📡 Ожидай возрождения':lanHostPaused?'📡 Ведущий на паузе':
  s.mode==='campaign'?'📖 Совместная кампания':'📡 С другом · открытый мир';
 if($('lanBadge').textContent!==label)lanBadge(label);
 const stageChanged=sectorChanged||s.mode==='campaign'&&lanLastMode!==s.mode;
 const error=Math.hypot(player.x-s.guest.x,player.y-s.guest.y);
 if(error>45||stageChanged){player.x=s.guest.x;player.y=s.guest.y;}
 else {player.x+=(s.guest.x-player.x)*.55;player.y+=(s.guest.y-player.y)*.55;}
 player.angle=s.guest.a||0;
 if(!lanPeer)lanPeer={x:s.host.x,y:s.host.y,angle:s.host.a||0,hp:s.host.hp||0};
 else {lanPeer.x=s.host.x;lanPeer.y=s.host.y;lanPeer.angle=s.host.a||0;lanPeer.hp=s.host.hp||0;}
 health=s.guest.hp;score=s.score;money=s.money;
 wave=s.wave;waveKills=s.waveKills;waveGoal=s.waveGoal;
 zombies=s.z.filter(o=>ZOMBIE_TYPES[o.type]&&Number.isFinite(o.x)&&Number.isFinite(o.y))
  .map(o=>({...o,def:ZOMBIE_TYPES[o.type]}));
 bullets=s.b;
 if(Array.isArray(s.cars)){
  const byId=new Map(vehicles.map(v=>[v.id,v]));
  for(const v of s.cars){
   const car=byId.get(v.id);
   if(car){car.x=v.x;car.y=v.y;car.angle=v.angle;car.hp=v.hp;car.broken=v.broken;
    car.vx=v.vx;car.vy=v.vy;car.steer=v.steer;car.hit=v.hit;car.ramCd=v.ramCd;}
  }
 }
 if(Array.isArray(s.loot)){
  const ids=new Set(s.loot);
  for(const n of lootNodes)n.opened=ids.has(n.id);
 }
 lanLastMode=s.mode;
 const now=performance.now();
 if(now-lanLastUi>250||stageChanged){lanLastUi=now;updateUI();}
}
function lanGuestInteract(){
 if(lanRole!=='guest'||!lanGuestReady||paused||lanHostPaused||gameMode!=='campaign'||
    !campaignNearbySite()||!lanBridge)return;
 lanBridge.send(JSON.stringify({v:LAN_VERSION,t:'interact',stage:campaignStage,site:campaignObjectiveIndex}));
}
function lanGuestTick(dt,now){
 if(!lanGuestReady)return;
 syncJoyInput();
 const aim=getAimState(isInSafeZone(player.x,player.y,-4));
 if(!paused&&!lanHostPaused&&health>0){
  player.moving=Math.hypot(joy.x,joy.y)>0.06;
  player.x+=joy.x*195*dt;player.y+=joy.y*195*dt;
  resolveObstacles(player,false);
  if(player.moving)player.walkPhase+=dt*9;
  if(aim.angle!==null)player.angle=aim.angle;
 }
 if(gameMode==='campaign'){
  const site=!paused&&!lanHostPaused?campaignNearbySite():null,button=$('interactBtn');
  const label=site?'🔎 '+site.name:'';
  if(button.textContent!==label){button.textContent=label;button.style.display=site?'inline-flex':'none';}
 }
 const c=clampCamera(player.x,player.y);
 cam.x+=(c.x-cam.x)*Math.min(1,dt*10);cam.y+=(c.y-cam.y)*Math.min(1,dt*10);
 if(now-lanLastInput>=50&&lanBridge){
  lanLastInput=now;
  lanBridge.send(JSON.stringify({v:LAN_VERSION,t:'input',x:paused||lanHostPaused||health<=0?0:joy.x,
   y:paused||lanHostPaused||health<=0?0:joy.y,a:player.angle,fire:!paused&&!lanHostPaused&&health>0&&aim.fire}));
 }
}
function drawLanPeer(now){
 if(!lanPeer)return;
 const p=lanPeer;
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle||0);
 ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(3,6,18,12,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#246779';ctx.strokeStyle='#8aeaff';ctx.lineWidth=3;
 ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle='#d6ffff';ctx.fillRect(5,-3,20,6);
 ctx.restore();
 ctx.save();ctx.textAlign='center';ctx.font='bold 13px system-ui';
 ctx.fillStyle='#a7f3ff';ctx.fillText(lanRole==='host'?'ДРУГ':'ВЕДУЩИЙ',p.x,p.y-25);ctx.restore();
}
