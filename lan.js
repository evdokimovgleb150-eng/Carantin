/* CARANTIN local co-op v1. APK-to-APK only: host owns simulation, guest sends input. */
'use strict';
const LAN_VERSION=1;
let lanLastSnapshot=0,lanLastInput=0,lanInput=null,lanInputAt=0,lanFireCooldown=0;
let lanHostPaused=false,lanGuestReady=false;
const lanBridge=window.CarantinLan;
function lanStatus(text){$('lanStatus').textContent=text;}
function lanBadge(text){$('lanBadge').textContent=text;$('lanBadge').style.display=text?'block':'none';}
function lanLeave(){
 if(lanRole==='solo')return;
 lanRole='solo';lanPeer=null;lanInput=null;lanGuestReady=false;lanHostPaused=false;
 document.body.classList.remove('lanGuest');lanBadge('');
 if(lanBridge)lanBridge.close();
}
function lanExit(){
 lanLeave();
 if(running){$('pauseScreen').style.display='flex';returnToMenu();}
}
function lanOpen(){
 if(!lanBridge){
  lanStatus('Для создания и подключения нужна версия APK 4.4 на двух Android-устройствах. Веб-версия остаётся одиночной.');
  $('lanHost').disabled=true;$('lanJoin').disabled=true;
 }else{
  lanStatus('Создай точку доступа, подключи к ней второй телефон. Оба телефона должны открыть CARANTIN 4.4.');
  $('lanHost').disabled=false;$('lanJoin').disabled=false;
 }
 $('lanModal').style.display='flex';
}
$('overlay').addEventListener('click',e=>{if(e.target.closest('#openLan'))lanOpen();});
$('lanCancel').addEventListener('click',()=>{
 if(lanRole==='guest'&&!lanGuestReady)lanLeave();
 $('lanModal').style.display='none';
});
$('lanHost').addEventListener('click',()=>{
 if(!lanBridge||running)return;
 lanRole='host';lanPeer=null;
 setGameMode('free');startGame();
 lanBridge.host();
 $('lanModal').style.display='none';
 lanBadge('📡 Ожидание второго игрока');
});
$('lanJoin').addEventListener('click',()=>{
 if(!lanBridge||running)return;
 lanRole='guest';lanGuestReady=false;
 lanStatus('Подключение…');
 lanBridge.join($('lanIp').value.trim().replace(/:8765$/,''));
});
// Called from Android on WebView's UI thread. All packets are JSON with a fixed schema.
window.lanReceive=function(kind,text){
 if(kind==='error'){
  if(lanRole==='guest'&&!lanGuestReady){lanRole='solo';lanStatus(text);}
  else lanBadge('📡 '+text);
  return;
 }
 if(kind==='hosting'&&lanRole==='host'){lanBadge('📡 Ведущий: '+text);return;}
 if(kind==='connected'){
  if(lanRole==='host'&&running){
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
 }else if(lanRole==='guest'&&packet.t==='state')lanApplyState(packet);
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
 // Transfer only drawing state; definitions, terrain and game logic live on both APKs.
 const z=zombies.map(o=>({x:o.x,y:o.y,type:o.type,r:o.r,angle:o.angle,
  phase:o.phase,seed:o.seed,hit:o.hit,speed:o.speed,aggro:o.aggro,isWaveBoss:o.isWaveBoss,hp:o.hp,maxHp:o.maxHp}));
 const b=bullets.map(o=>({x:o.x,y:o.y,vx:o.vx,vy:o.vy,sx:o.sx,sy:o.sy,
  color:o.color,kind:o.kind,rocket:o.rocket,bolt:o.bolt,flame:o.flame,angle:o.angle}));
 lanBridge.send(JSON.stringify({v:LAN_VERSION,t:'state',paused:paused||waveChoosing,
  guest:{x:lanPeer.x,y:lanPeer.y,a:lanPeer.angle,hp:lanPeer.hp},
  host:{x:player.x,y:player.y,a:player.angle,hp:health},
  z,b,score,money,wave,waveKills,waveGoal,
  cars:vehicles.map(v=>({id:v.id,x:v.x,y:v.y,angle:v.angle,hp:v.hp,broken:v.broken})),
  loot:lootNodes.filter(n=>n.opened).map(n=>n.id)}));
}
function lanApplyState(s){
 if(!s.guest||!s.host||!Array.isArray(s.z)||!Array.isArray(s.b)||
    s.z.length>600||s.b.length>1000||!Number.isFinite(s.guest.x)||!Number.isFinite(s.guest.y))return;
 if(!lanGuestReady){
  setGameMode('free');startGame();
  lanGuestReady=true;
  $('lanModal').style.display='none';
  document.body.classList.add('lanGuest');
  lanBadge('📡 С другом · открытый мир');
 }
 lanHostPaused=!!s.paused;
 player.x=s.guest.x;player.y=s.guest.y;player.angle=s.guest.a||0;
 lanPeer={x:s.host.x,y:s.host.y,angle:s.host.a||0,hp:s.host.hp||0};
 health=s.guest.hp;score=s.score;money=s.money;
 wave=s.wave;waveKills=s.waveKills;waveGoal=s.waveGoal;
 zombies=s.z.filter(o=>ZOMBIE_TYPES[o.type]&&Number.isFinite(o.x)&&Number.isFinite(o.y))
  .map(o=>({...o,def:ZOMBIE_TYPES[o.type]}));
 bullets=s.b;
 if(Array.isArray(s.cars))for(const v of s.cars){
  const car=vehicles.find(c=>c.id===v.id);
  if(car){car.x=v.x;car.y=v.y;car.angle=v.angle;car.hp=v.hp;car.broken=v.broken;}
 }
 if(Array.isArray(s.loot))for(const n of lootNodes)if(s.loot.includes(n.id))n.opened=true;
 updateUI();
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
