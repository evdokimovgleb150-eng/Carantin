/* CARANTIN 4.0 — story campaign; the original free-survival city remains untouched. */
let gameMode='campaign';
let campaignStage=0, campaignPhase=0, campaignState='approach';
let campaignBarrels=[], campaignKills=0, campaignTotal=0, campaignHold=0, campaignWaveDelay=0;
let campaignDialogue=null, campaignTypeTimer=null, campaignTravel=null;
const CAMPAIGN_LOCATIONS=[
 {name:'Ржавый периметр',tag:'ПЕРИМЕТР · 01',district:'suburb',color:'#8ce8ac',tint:'rgba(35,84,56,0.17)',arena:{x:2660,y:1800,r:225},checkpoint:{x:3310,y:1800},pool:['walker','runner','cop','hound'],boss:'brute',speaker:'ШРАМ',role:'КОМАНДИР',accent:'#ffcf69',
  intro:[{who:'ШРАМ',role:'КОМАНДИР',text:'Сектор один. Дорога к источнику штамма начинается здесь. Подойди к освещённому полигону — мы удержим периметр.'},{who:'ВЕКТОР',role:'ОРУЖЕЙНИК',text:'На арене стоят красные бочки. Попади в них, когда заражённые сблизятся: взрыв разнесёт всю группу.'},{who:'ШРАМ',role:'КОМАНДИР',text:'Какую тактику выбираешь?',choices:[{text:'Взять бронепластины',tag:'+35 🛡️',effect:'shield'},{text:'Запросить боевые припасы',tag:'+1 🤖 турель',effect:'turret'}]}],
  radio:[['ШРАМ','Периметр взят. КПП открывает дорогу к химическому комбинату.'],['ВЕКТОР','Проверяю мотор и боезапас. Оружие и добыча остаются с нами.'],['ДОК','У шоссе токсичный туман. Фильтры наготове.']]},
 {name:'Химический комбинат',tag:'ХИМКОМБИНАТ · 02',district:'chem',color:'#b7ff62',tint:'rgba(104,125,22,0.20)',arena:{x:2700,y:1800,r:230},checkpoint:{x:3300,y:1800},pool:['hazmat','spitter','acidic','chemist'],boss:'glowing',speaker:'ДОК',role:'ПОЛЕВОЙ МЕДИК',accent:'#73ffe1',
  intro:[{who:'ДОК',role:'ПОЛЕВОЙ МЕДИК',text:'Реакторы ХИМ-КОМБИНАТА питают гнездо. Три рубежа: первая атака, удержание площадки и прорыв к центральной цистерне.'},{who:'ШРАМ',role:'КОМАНДИР',text:'Прожекторы обозначают границу полигона. Держись внутри, пока идёт штурм.'},{who:'ДОК',role:'ПОЛЕВОЙ МЕДИК',text:'Кого поддержать в первую очередь?',choices:[{text:'Восстановить здоровье отряда',tag:'+40 ❤️',effect:'heal'},{text:'Усилить защитный контур',tag:'+45 🛡️',effect:'shield'}]}],
  radio:[['ДОК','Образцы в герметичных контейнерах. Медгородок ждёт наш сигнал.'],['ШРАМ','Проход через КПП открыт. Не сбрасывай скорость на шоссе.'],['ВЕКТОР','Бочки взрываются от выстрелов — и здесь это работает.']]},
 {name:'Госпиталь «Маяк»',tag:'ГОСПИТАЛЬ · 03',district:'hospital',color:'#88e8ff',tint:'rgba(30,98,125,0.19)',arena:{x:2660,y:1800,r:225},checkpoint:{x:3300,y:1800},pool:['patient','nurse','medic','surgeon'],boss:'necromancer',speaker:'АНГЕЛ',role:'МЕДИК ОТРЯДА',accent:'#81eaff',
  intro:[{who:'АНГЕЛ',role:'МЕДИК ОТРЯДА',text:'Сигнал «Маяка» пропал после последней смены. Нам придётся отстоять операционный полигон и уничтожить реаниматора.'},{who:'ДОК',role:'ПОЛЕВОЙ МЕДИК',text:'Удерживайте зону десять секунд во второй фазе. Только потом откроется доступ к боссу.'},{who:'ШРАМ',role:'КОМАНДИР',text:'Последняя подготовка перед Цитаделью?',choices:[{text:'Полевое лечение',tag:'+45 ❤️',effect:'heal'},{text:'Снарядить турель',tag:'+1 🤖 турель',effect:'turret'}]}],
  radio:[['АНГЕЛ','Пациенты больше не представляют угрозы. Выходим на магистраль.'],['ШРАМ','Цитадель впереди. Там держат нулевой образец.'],['ВЕКТОР','Зарядил всё, что было. Теперь только вперёд.']]},
 {name:'Цитадель Ноль',tag:'ЦИТАДЕЛЬ · 04',district:'military',color:'#ffad73',tint:'rgba(122,46,35,0.22)',arena:{x:2670,y:1800,r:230},checkpoint:null,pool:['soldier','commando','cyborg','juggernaut'],boss:'patriarch',speaker:'ШРАМ',role:'КОМАНДИР',accent:'#ffb96a',
  intro:[{who:'ШРАМ',role:'КОМАНДИР',text:'Цитадель Ноль. За воротами — первоисточник заражения. Три этапа, а затем Патриарх-0. Назад пути нет.'},{who:'ВЕКТОР',role:'ОРУЖЕЙНИК',text:'Взрывные бочки по флангам. Во второй фазе босса следи за кислотными залпами.'},{who:'ШРАМ',role:'КОМАНДИР',text:'Последний приказ отряду?',choices:[{text:'Прикрыть бойцов',tag:'+55 🛡️',effect:'shield'},{text:'Полная огневая мощь',tag:'+1 🤖 турель',effect:'turret'}]}],
  radio:[]}
];
function setGameMode(mode){
 if(running)return;
 gameMode=mode==='free'?'free':'campaign';
 document.querySelectorAll('.modeBtn').forEach(b=>b.classList.toggle('active',b.dataset.mode===gameMode));
}
function campaignReset(){
 campaignStage=0;campaignPhase=0;campaignState='approach';campaignKills=0;campaignTotal=0;
 campaignHold=0;campaignWaveDelay=0;campaignBarrels=[];campaignTravel=null;campaignDialogue=null;
 if(campaignTypeTimer)clearInterval(campaignTypeTimer);
 campaignTypeTimer=null;
 if($('polygonBanner'))$('polygonBanner').style.display='none';
 if($('locBadge'))$('locBadge').textContent='Сектор 1';
 if($('evacBadge'))$('evacBadge').style.display='';
}
function campaignStart(){
 campaignLoadLocation(0,null);
 campaignShowDialogue(CAMPAIGN_LOCATIONS[0].intro);
}
function campaignTheme(loc){
 const g=groundCtx,a=loc.arena;
 g.save();g.fillStyle=loc.tint;g.fillRect(30,30,WORLD_W-60,WORLD_H-60);
 // Each loaded sector has its own field installations and material palette.
 // These buildings, reactor vats, hospital tents or bastions are unique to this map.
 for(let i=0;i<6;i++){
  const px=a.x-310+(i%3)*310,py=a.y+(i<3?-315:315);
  g.save();g.translate(px,py);
  if(campaignStage===0){
   g.fillStyle='#4c3c30';g.strokeStyle='#9b7451';
   g.beginPath();g.roundRect(-32,-21,64,42,5);g.fill();g.stroke();
   g.fillStyle='#da8f55';g.fillRect(-26,-14,24,9);g.fillRect(9,-14,16,9);
   g.strokeStyle='#e7ba70';g.lineWidth=3;g.beginPath();g.moveTo(-32,0);g.lineTo(32,0);g.stroke();
  }else if(campaignStage===1){
   g.fillStyle='#354832';g.strokeStyle='#c8fa5b';g.lineWidth=3;
   g.beginPath();g.arc(0,0,24,0,Math.PI*2);g.fill();g.stroke();
   g.fillStyle='#a6f15b';g.beginPath();g.arc(0,0,8,0,Math.PI*2);g.fill();
   g.fillStyle='#8b9d42';g.fillRect(-32,-6,64,12);
  }else if(campaignStage===2){
   g.fillStyle='#486268';g.strokeStyle='#b5f3f5';g.lineWidth=2;
   g.beginPath();g.roundRect(-32,-23,64,46,8);g.fill();g.stroke();
   g.fillStyle='#f0f4ec';g.fillRect(-3,-16,6,32);g.fillRect(-16,-3,32,6);
  }else{
   g.fillStyle='#353a34';g.strokeStyle='#ffb178';g.lineWidth=3;
   g.beginPath();g.moveTo(-33,-24);g.lineTo(27,-24);g.lineTo(35,18);g.lineTo(-30,24);g.closePath();g.fill();g.stroke();
   g.fillStyle='#e48564';g.fillRect(-18,-5,36,10);
   g.fillStyle='#191e20';g.fillRect(-28,-29,56,7);
  }
  g.restore();
  if(i===0||i===5)beacons.push({x:px,y:py,kind:'amber',phase:i});
 }
 // A separate road surface and tactical route are generated on every map load.
 g.strokeStyle='rgba(115,160,162,0.22)';g.lineWidth=100;
 g.beginPath();g.moveTo(SAFE_ZONE.x+250,1800);g.lineTo(3370,1800);g.stroke();
 g.strokeStyle=loc.color;g.globalAlpha=.33;g.lineWidth=3;g.setLineDash([22,22]);
 g.beginPath();g.moveTo(SAFE_ZONE.x+260,1800);g.lineTo(3380,1800);g.stroke();g.setLineDash([]);g.globalAlpha=1;
 // An octagonal live-fire polygon with an open west-side vehicle entrance.
 const points=[];
 for(let i=0;i<8;i++){
  const t=Math.PI*i/4+Math.PI/8;
  points.push({x:a.x+Math.cos(t)*a.r,y:a.y+Math.sin(t)*a.r});
 }
 g.fillStyle='rgba(10,16,18,0.52)';g.strokeStyle=loc.color;g.lineWidth=6;
 g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();g.stroke();
 g.strokeStyle='rgba(250,212,110,0.66)';g.lineWidth=3;g.setLineDash([14,9]);
 g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.stroke();g.setLineDash([]);
 // Low cover stops projectiles at the perimeter. The western approach is open.
 for(let i=0;i<8;i++){
  if(i===3||i===4)continue;
  const p=points[i],q=points[(i+1)%8],angle=Math.atan2(q.y-p.y,q.x-p.x);
  for(let t=.18;t<=.82;t+=.32)drawBarrier(g,p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,angle,42,true);
 }
 for(let i=0;i<4;i++){
  const ang=i*Math.PI/2+Math.PI/4;
  const px=a.x+Math.cos(ang)*(a.r+15),py=a.y+Math.sin(ang)*(a.r+15);
  lamps.push({x:px,y:py,phase:i*.8});beacons.push({x:px,y:py,kind:i%2?'amber':'cyan',phase:i});
  g.fillStyle='#1d2b2e';g.fillRect(px-6,py-6,12,12);
  g.fillStyle=loc.color;g.beginPath();g.arc(px,py,4,0,Math.PI*2);g.fill();
 }
 g.textAlign='center';g.font='900 22px system-ui,sans-serif';g.fillStyle=loc.color;
 g.fillText('ПОЛИГОН '+(campaignStage+1).toString().padStart(2,'0'),a.x,a.y-35);
 g.font='800 13px monospace';g.fillText(loc.tag,a.x,a.y-15);
 // Concentric target rings and painted lane guides.
 for(let i=0;i<3;i++){
  const tx=a.x+Math.cos(i*2.1)*115,ty=a.y+Math.sin(i*2.1)*115;
  g.strokeStyle='rgba(255,110,94,0.48)';g.lineWidth=2;
  for(const r of [8,17,26]){g.beginPath();g.arc(tx,ty,r,0,Math.PI*2);g.stroke();}
  g.fillStyle='#e95349';g.beginPath();g.arc(tx,ty,4,0,Math.PI*2);g.fill();
 }
 const cp=loc.checkpoint;
 if(cp){
  g.fillStyle='rgba(15,35,37,0.92)';g.fillRect(cp.x-70,cp.y-57,140,114);
  g.strokeStyle=loc.color;g.lineWidth=4;g.strokeRect(cp.x-70,cp.y-57,140,114);
  g.fillStyle=loc.color;g.font='900 21px system-ui';g.fillText('КПП →',cp.x,cp.y-18);
  g.fillStyle='#e5e6c8';g.font='800 11px monospace';g.fillText('ПЕРЕХОД В СЕКТОР '+(campaignStage+2),cp.x,cp.y+7);
  beacons.push({x:cp.x-62,y:cp.y-50,kind:'amber',phase:0},{x:cp.x+62,y:cp.y-50,kind:'amber',phase:2});
 }
 g.restore();
 campaignBarrels=[];
 for(const [dx,dy] of [[-115,-115],[115,-115],[-105,115],[110,110],[20,80]]){
  const x=a.x+dx,y=a.y+dy;
  campaignBarrels.push({x,y,live:true});
 }
}
function campaignLoadLocation(index,carry){
 campaignStage=index;campaignPhase=0;campaignState='approach';campaignKills=0;campaignTotal=0;
 campaignHold=0;campaignWaveDelay=0;
 const bag=lootBag.slice();
 // Fresh, independent sector map and enemies; carried inventory and character progression are not reset.
 buildWorldGround();initLootState();lootBag=bag;initVehicles();
 campaignTheme(CAMPAIGN_LOCATIONS[index]);
 zombies=[];bullets=[];enemyProjectiles=[];hazardZones=[];turrets=[];particles=[];popups=[];decals=[];
 nearbyNpc=null;nearbyLootNode=null;nearbyDoor=null;nearbyVehicle=null;
 activeExpedition=null;
 const a=CAMPAIGN_LOCATIONS[index].arena;
 const spawn={x:a.x-a.r-138,y:a.y};
 if(carry){
  const v=carry.vehicle;
  vehicles=vehicles.filter(it=>it!==v);
  v.x=spawn.x;v.y=spawn.y;v.vx=0;v.vy=0;v.steer=0;v.angle=0;v.nitroActive=0;
  vehicles.push(v);player.inVehicle=v;
  player.x=v.x;player.y=v.y;
 }else{
  player.x=SAFE_ZONE.x;player.y=SAFE_ZONE.y+115;player.inVehicle=null;
 }
 for(const m of mercenaries){
  m.x=player.x+(Math.random()-.5)*45;m.y=player.y+34;
  m.inVehicle=player.inVehicle;
 }
 const c=clampCamera(player.x,player.y);cam.x=c.x;cam.y=c.y;
 wave=index+1;waveKills=0;waveGoal=999;spawnTimer=999;
 evacHeli=null;nearbyHeli=false;
 $('locBadge').textContent=CAMPAIGN_LOCATIONS[index].tag;
 $('polygonBanner').style.display='block';
 updateUI();updateActiveItemsUI();updateSquadAndMissionUI();
}
function campaignNearbyCheckpoint(){
 if(gameMode!=='campaign'||!player||campaignState!=='ready')return false;
 const cp=CAMPAIGN_LOCATIONS[campaignStage].checkpoint;
 return !!(cp&&Math.hypot(player.x-cp.x,player.y-cp.y)<105);
}
function campaignThreatText(){
 if(campaignState==='ready')return '✅ ПОЛИГОН ЗАЧИЩЕН';
 if(campaignState==='approach')return '🎯 НАЙДИ ПОЛИГОН';
 if(campaignState==='combat')return `🎯 ЭТАП ${campaignPhase+1}/3 · ${campaignKills}/${campaignTotal}`;
 if(campaignState==='hold')return `⏱ УДЕРЖИВАЙ ${Math.ceil(campaignHold)}с`;
 return '📡 СВЯЗЬ С ОТРЯДОМ';
}
function campaignUpdateHud(){
 const loc=CAMPAIGN_LOCATIONS[campaignStage],a=loc.arena;
 const banner=$('polygonBanner'),mb=$('missionBar');
 if(!running){if(mb)mb.style.display='none';return;}
 banner.style.display='block';banner.className=campaignState==='ready'?'ready':campaignState==='combat'||campaignState==='hold'?'active':'';
 const dist=Math.round(Math.hypot(player.x-a.x,player.y-a.y));
 banner.textContent=campaignState==='ready'?(loc.checkpoint?'✅ ПОЛИГОН ЗАЧИЩЕН · ЕЗЖАЙ К КПП':'🏆 ЦИТАДЕЛЬ ОСВОБОЖДЕНА'):
  campaignState==='approach'?`🎯 ${loc.name} · ПОЛИГОН ${dist}м`:
  campaignState==='hold'?`⏱ УДЕРЖАНИЕ ПОЛИГОНА · ${Math.ceil(campaignHold)}с`:
  `⚔️ ${loc.name} · ЭТАП ${campaignPhase+1}/3 · ${campaignKills}/${campaignTotal}`;
 if(mb){mb.style.display='block';
  const dest=campaignState==='ready'?loc.checkpoint:a;
  const bearing=dest?Math.atan2(dest.y-player.y,dest.x-player.x):0;
  const arrows=['→','↘','↓','↙','←','↖','↑','↗'];
  const arrow=arrows[(Math.round(bearing/(Math.PI/4))+8)%8];
  mb.textContent=campaignState==='ready'?(dest?`🚗 ${arrow} КПП ${Math.round(Math.hypot(dest.x-player.x,dest.y-player.y))}м · Переезд на машине`:'🏆 Патриарх-0 уничтожен · Кампания завершена!'):
   `📖 ${campaignStage+1}/4 · ${arrow} ${loc.name} · ${dist}м · ${campaignThreatText()}`;
 }
}
function campaignUpdate(dt,now){
 if(campaignState==='approach'){
  const a=CAMPAIGN_LOCATIONS[campaignStage].arena;
  if(Math.hypot(player.x-a.x,player.y-a.y)<a.r+28){
   campaignState='combat';campaignPhase=0;campaignStartWave();
  }
 }else if(campaignState==='hold'){
  const a=CAMPAIGN_LOCATIONS[campaignStage].arena;
  if(Math.hypot(player.x-a.x,player.y-a.y)<a.r+12)campaignHold=Math.max(0,campaignHold-dt);
  if(campaignHold<=0){campaignState='combat';campaignStartWave();}
 }else if(campaignState==='combat'&&campaignWaveDelay>0){
  campaignWaveDelay-=dt;
  if(campaignWaveDelay<=0)campaignStartWave();
 }
 // Crossing the highway checkpoint while driving launches the journey automatically.
 if(player.inVehicle&&campaignNearbyCheckpoint())campaignStartTravel();
 if(player.inVehicle){
  for(const b of campaignBarrels){
   if(b.live&&Math.hypot(b.x-player.x,b.y-player.y)<35&&Math.hypot(player.inVehicle.vx,player.inVehicle.vy)>95){campaignExplodeBarrel(b);}
  }
 }
}
function campaignStartWave(){
 const loc=CAMPAIGN_LOCATIONS[campaignStage],a=loc.arena;
 campaignKills=0;campaignTotal=campaignPhase===0?5+campaignStage*2:campaignPhase===1?7+campaignStage*2:5+campaignStage;
 campaignState='combat';campaignWaveDelay=0;campaignHold=0;
 const typePool=loc.pool;
 for(let i=0;i<campaignTotal;i++){
  const angle=i*2.399+campaignPhase*.9;
  const r=72+(i%3)*30;
  const type=campaignPhase===2&&i===0?loc.boss:typePool[(i+campaignPhase)%typePool.length];
  const z=spawnZombie(type,a.x+Math.cos(angle)*r,a.y+Math.sin(angle)*r,{aggro:true,bypassCap:true});
  if(z){z.campaignTag=campaignStage;z.aggroTimer=999;z.lastSeenX=player.x;z.lastSeenY=player.y;
   if(type===loc.boss&&campaignPhase===2){z.isWaveBoss=true;z.isStoryBoss=type==='patriarch';z.hp*=type==='patriarch'?1.8:1.35;z.maxHp=z.hp;}
  }
 }
 addPopup(player.x,player.y-50,`⚔️ ${loc.tag} · ЭТАП ${campaignPhase+1}/3`,'#ffe486',16);
 SFX.wave();updateUI();
}
function campaignOnKill(z){
 if(z.campaignTag!==campaignStage||campaignState!=='combat')return;
 campaignKills++;
}
function campaignCheckWave(){
 if(campaignState!=='combat'||campaignWaveDelay>0||campaignKills<campaignTotal)return;
 if(zombies.some(z=>z.campaignTag===campaignStage&&z.hp>0))return;
 if(campaignPhase===2){
  campaignState='ready';money+=150+campaignStage*85;
  health=Math.min(maxHealth,health+45);shieldHp+=25;
  addPopup(player.x,player.y-40,`✅ ПОЛИГОН ЗАЧИЩЕН! +${150+campaignStage*85} 🪙`,'#8cffaa',15);
  updateUI();SFX.story();
  if(campaignStage===CAMPAIGN_LOCATIONS.length-1){
   campaignShowDialogue([
    {who:'ШРАМ',role:'КОМАНДИР',text:'Патриарх-0 уничтожен. Источник штамма погас — город впервые за долгое время встречает рассвет.'},
    {who:'ДОК',role:'ПОЛЕВОЙ МЕДИК',text:'Все четыре сектора под контролем. Операция «Карантин» завершена. Отряд возвращается домой.'}
   ],campaignFinish);
  }else{
   const next=CAMPAIGN_LOCATIONS[campaignStage+1];
   campaignShowDialogue([{who:CAMPAIGN_LOCATIONS[campaignStage].speaker,role:CAMPAIGN_LOCATIONS[campaignStage].role,
    text:`Полигон взят. Выезжай на КПП на восточном шоссе и прорывайся в сектор «${next.name}». Всё снаряжение и твоя машина остаются с тобой.`}]);
  }
 }else{
  campaignPhase++;
  // Between waves the player can reposition; the next stage begins in two seconds.
  campaignWaveDelay=2.5;
  addPopup(player.x,player.y-40,`✓ ЭТАП ${campaignPhase}/3 · СЛЕДУЮЩАЯ АТАКА!`,'#a8ffba',14);
  if(campaignPhase===2){
   campaignState='hold';campaignHold=8+campaignStage;
   // A timed holdout before the boss stage.
   addPopup(player.x,player.y-55,`⏱ УДЕРЖИ ПОЛИГОН ${campaignHold}с`,'#ffe184',14);
  }
  updateUI();
 }
}
function campaignHitBarrelsSegment(x1,y1,x2,y2,aoe=0){
 if(gameMode!=='campaign')return false;
 for(const barrel of campaignBarrels){
  if(barrel.live&&distToSegment(barrel.x,barrel.y,x1,y1,x2,y2)<13+Math.min(aoe,24)){
   campaignExplodeBarrel(barrel);return true;
  }
 }
 return false;
}
function campaignDetonateNearbyBarrels(x,y,r){
 for(const b of campaignBarrels){
  if(b.live&&Math.hypot(b.x-x,b.y-y)<r+12)campaignExplodeBarrel(b);
 }
}
function campaignExplodeBarrel(barrel){
 if(!barrel||!barrel.live)return;
 barrel.live=false;
 const r=112;
 SFX.explosion();shake=Math.max(shake,9);
 particles.push({x:barrel.x,y:barrel.y,vx:0,vy:0,life:.35,max:.35,color:'#ff982e',size:r,kind:'ring',rot:0,vrot:0});
 addParticles(barrel.x,barrel.y,'#ffbd58',22,220,'spark');
 addPopup(barrel.x,barrel.y-28,'💥 ВЗРЫВНАЯ БОЧКА!','#ffcf78',14);
 for(const z of zombies){
  const dist=Math.hypot(z.x-barrel.x,z.y-barrel.y);
  if(dist<r+z.r)applyDamageToZombie(z,10*(1-dist/(r+z.r)) + 6,Math.atan2(z.y-barrel.y,z.x-barrel.x));
 }
 if(player&&!player.inVehicle&&Math.hypot(player.x-barrel.x,player.y-barrel.y)<65)damagePlayer(10,barrel.x,barrel.y);
 for(const other of campaignBarrels){
  if(other.live&&Math.hypot(other.x-barrel.x,other.y-barrel.y)<r*.85)campaignExplodeBarrel(other);
 }
}
function campaignDrawWorld(now){
 const loc=CAMPAIGN_LOCATIONS[campaignStage],a=loc.arena;
 ctx.save();
 const pulse=.48+.25*Math.sin(now*.005);
 ctx.strokeStyle=loc.color;ctx.globalAlpha=pulse;ctx.lineWidth=3;
 ctx.setLineDash([12,10]);ctx.beginPath();ctx.arc(a.x,a.y,a.r-24,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
 for(const b of campaignBarrels){
  if(!b.live)continue;
  ctx.fillStyle='rgba(255,75,35,0.2)';ctx.beginPath();ctx.arc(b.x,b.y,18+Math.sin(now*.006)*2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#a52d20';ctx.strokeStyle='#ffab44';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(b.x,b.y,11,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffe6a4';ctx.font='900 12px system-ui';ctx.textAlign='center';ctx.fillText('!',b.x,b.y+4);
 }
 const cp=loc.checkpoint;
 if(cp&&campaignState==='ready'){
  ctx.strokeStyle='#86ffa0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cp.x,cp.y,60+Math.sin(now*.006)*6,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#b5ffb8';ctx.font='900 13px system-ui';ctx.textAlign='center';ctx.fillText('🚗 КПП ОТКРЫТ',cp.x,cp.y-72);
 }
 ctx.restore();
}
function campaignDrawRadar(g,sx,sy,now){
 const loc=CAMPAIGN_LOCATIONS[campaignStage],a=loc.arena;
 g.strokeStyle=loc.color;g.lineWidth=2;
 g.beginPath();g.arc(a.x*sx,a.y*sy,Math.max(6,a.r*sx),0,Math.PI*2);g.stroke();
 g.fillStyle=loc.color;g.fillRect(a.x*sx-2,a.y*sy-2,4,4);
 if(loc.checkpoint&&campaignState==='ready'){
  const cp=loc.checkpoint;g.fillStyle='#c4ff9a';g.fillRect(cp.x*sx-3,cp.y*sy-3,6,6);
 }
}
function campaignRenderPda(box){
 for(let i=0;i<CAMPAIGN_LOCATIONS.length;i++){
  const l=CAMPAIGN_LOCATIONS[i],card=document.createElement('div');
  card.className='storyCard'+(i<campaignStage?' done':i===campaignStage?' active':'');
  const head=document.createElement('div');head.className='storyHead';
  const title=document.createElement('span');title.textContent=`${i+1}. ${l.name}`;
  const badge=document.createElement('span');badge.className='storyBadge '+(i<campaignStage?'done':i===campaignStage?'active':'lock');
  badge.textContent=i<campaignStage?'ПРОЙДЕН ✓':i===campaignStage?campaignThreatText():'ЗАКРЫТО';
  head.append(title,badge);card.appendChild(head);
  const body=document.createElement('div');body.className='storyBody';
  body.textContent=i===campaignStage?`Три этапа зачистки, босс «${ZOMBIE_TYPES[l.boss].name}». ${campaignState==='ready'?'Сядь в машину и проезжай КПП.':'Войди в отмеченный полигон, стреляй по взрывным бочкам.'}`:i<campaignStage?'Полигон освобождён. Маршрут открыт.':'Въезд через предыдущий КПП.';
  card.appendChild(body);box.appendChild(card);
 }
}
function campaignDrawPortrait(who,role){
 const c=$('dlgPortrait'),g=c.getContext('2d');g.clearRect(0,0,84,84);
 const colors={ШРАМ:'#e5a448',ВЕКТОР:'#e3a05b',ДОК:'#69d8cf',АНГЕЛ:'#82ebff'};
 const col=colors[who]||'#a8edc4';
 g.fillStyle='#102326';g.fillRect(0,0,84,84);
 const halo=g.createRadialGradient(42,42,5,42,42,46);halo.addColorStop(0,col+'88');halo.addColorStop(1,'#0b151800');
 g.fillStyle=halo;g.fillRect(0,0,84,84);
 g.fillStyle='#1f3033';g.beginPath();g.moveTo(7,84);g.lineTo(18,57);g.lineTo(42,50);g.lineTo(66,57);g.lineTo(77,84);g.closePath();g.fill();
 g.fillStyle=col;g.fillRect(18,58,7,16);g.fillRect(59,58,7,16);
 g.fillStyle='#3c4c47';g.beginPath();g.ellipse(42,36,20,25,0,0,Math.PI*2);g.fill();
 g.fillStyle='#131f24';g.beginPath();g.roundRect(22,31,40,14,5);g.fill();
 g.fillStyle=col;g.fillRect(28,36,28,4);
 g.fillStyle='#a9eac5';g.font='900 10px monospace';g.textAlign='center';g.fillText(who,42,77);
}
function campaignShowDialogue(lines,onDone){
 if(!running)return;
 campaignDialogue={lines,index:0,onDone,full:false};
 paused=true;stopAllControls();$('dialogueOverlay').style.display='flex';
 campaignShowLine();
}
function campaignShowLine(){
 const d=campaignDialogue;if(!d)return;
 if(campaignTypeTimer)clearInterval(campaignTypeTimer);
 const line=d.lines[d.index];d.full=false;
 $('dlgSpeaker').textContent=line.who==='ШРАМ'?'Командир «Шрам»':line.who==='ДОК'?'Полевой медик «Док»':line.who==='ВЕКТОР'?'Оружейник «Вектор»':line.who==='АНГЕЛ'?'Медик «Ангел»':line.who;
 $('dlgRole').textContent=line.role;$('dlgStep').textContent=`${d.index+1} / ${d.lines.length}`;
 campaignDrawPortrait(line.who,line.role);
 $('dlgText').textContent='';$('dlgChoices').replaceChildren();$('dlgNext').style.display='inline-flex';
 let pos=0;
 campaignTypeTimer=setInterval(()=>{
  if(!campaignDialogue){clearInterval(campaignTypeTimer);return;}
  pos=Math.min(line.text.length,pos+2);
  $('dlgText').textContent=line.text.slice(0,pos);
  if(pos===line.text.length){clearInterval(campaignTypeTimer);campaignTypeTimer=null;d.full=true;campaignShowChoices(line);}
 },25);
}
function campaignShowChoices(line){
 if(!line.choices)return;
 $('dlgNext').style.display='none';
 for(const choice of line.choices){
  const b=document.createElement('button');b.type='button';b.className='dlgChoiceBtn';
  const label=document.createElement('span');label.textContent=choice.text;
  const tag=document.createElement('span');tag.className='dlgChoiceTag';tag.textContent=choice.tag;
  b.append(label,tag);b.addEventListener('click',()=>{campaignApplyChoice(choice);campaignAdvanceDialogue(true);});
  $('dlgChoices').appendChild(b);
 }
}
function campaignApplyChoice(choice){
 if(!choice||!player)return;
 if(choice.effect==='shield'){shieldHp+=campaignStage===3?55:choice.tag.includes('45')?45:35;SFX.heal();}
 else if(choice.effect==='heal'){health=Math.min(maxHealth,health+(choice.tag.includes('45')?45:40));SFX.heal();}
 else if(choice.effect==='turret'){turretCharges++;SFX.turret();}
 addPopup(player.x,player.y-34,choice.tag,'#a8ffd4',14);updateUI();
}
function campaignAdvanceDialogue(chosen=false){
 const d=campaignDialogue;if(!d)return;
 const line=d.lines[d.index];
 if(!d.full){
  if(campaignTypeTimer)clearInterval(campaignTypeTimer);
  campaignTypeTimer=null;d.full=true;$('dlgText').textContent=line.text;campaignShowChoices(line);return;
 }
 if(line.choices&&!chosen){campaignApplyChoice(line.choices[0]);}
 d.index++;
 if(d.index>=d.lines.length){
  const done=d.onDone;campaignDialogue=null;$('dialogueOverlay').style.display='none';
  paused=false;last=performance.now();if(done)done();
 }else campaignShowLine();
}
function campaignSkipDialogue(){
 const d=campaignDialogue;if(!d)return;
 if(campaignTypeTimer)clearInterval(campaignTypeTimer);
 for(let i=d.index;i<d.lines.length;i++)if(d.lines[i].choices)campaignApplyChoice(d.lines[i].choices[0]);
 const done=d.onDone;campaignDialogue=null;$('dialogueOverlay').style.display='none';
 paused=false;last=performance.now();if(done)done();
}
function campaignStartTravel(){
 if(!campaignNearbyCheckpoint()||campaignTravel)return false;
 if(!player.inVehicle||player.inVehicle.broken){
  addPopup(player.x,player.y-40,'🚗 На КПП нужен исправный автомобиль!','#ffe58e',14);return false;
 }
 const loc=CAMPAIGN_LOCATIONS[campaignStage],next=CAMPAIGN_LOCATIONS[campaignStage+1];
 campaignTravel={from:campaignStage,to:campaignStage+1,vehicle:player.inVehicle,start:performance.now(),radioIndex:0};
 paused=true;stopAllControls();
 $('travelOverlay').style.display='flex';$('travelRoute').textContent=`🚗 ${loc.name.toUpperCase()}  ──▶  ${next.name.toUpperCase()}`;
 campaignRadioLine();SFX.carEnter();requestAnimationFrame(campaignTravelFrame);
 return true;
}
function campaignRadioLine(){
 if(!campaignTravel)return;
 const lines=CAMPAIGN_LOCATIONS[campaignTravel.from].radio;
 const [who,text]=lines[campaignTravel.radioIndex%lines.length];
 $('travelSpeaker').textContent=`📻 ${who} · РАДИОКАНАЛ ОТРЯДА`;$('travelSay').textContent=text;
}
function campaignNextRadio(){if(!campaignTravel)return;campaignTravel.radioIndex++;campaignRadioLine();SFX.loot();}
function campaignTravelFrame(t){
 if(!campaignTravel)return;
 const progress=Math.min(1,(t-campaignTravel.start)/6100);
 $('travelProgFill').style.width=(progress*100).toFixed(1)+'%';
 const c=$('travelCanvas'),g=c.getContext('2d'),w=c.width,h=c.height;
 const loc=CAMPAIGN_LOCATIONS[campaignTravel.to];
 g.fillStyle='#0a171c';g.fillRect(0,0,w,h);
 const sky=g.createLinearGradient(0,0,0,104);sky.addColorStop(0,'#0c2032');sky.addColorStop(1,loc.tint.replace('0.','0.'));g.fillStyle=sky;g.fillRect(0,0,w,104);
 g.fillStyle='rgba(110,205,240,0.16)';g.beginPath();g.arc(w*.7,43,28,0,Math.PI*2);g.fill();
 for(let i=0;i<15;i++){
  const x=(i*97-t*.08)%(w+120);const bx=(x+w+120)%(w+120)-50;
  g.fillStyle=i%2?'#162b32':'#13262a';g.fillRect(bx,82-(i%3)*10,42,40+(i%3)*10);
  g.fillStyle='rgba(255,222,115,0.35)';g.fillRect(bx+8,86-(i%3)*9,4,4);
 }
 g.fillStyle='#1a2527';g.beginPath();g.moveTo(0,h);g.lineTo(225,104);g.lineTo(435,104);g.lineTo(w,h);g.fill();
 g.strokeStyle='#f5d175';g.lineWidth=3;g.setLineDash([18,20]);g.beginPath();g.moveTo(w/2,h);g.lineTo(w/2,106);g.stroke();g.setLineDash([]);
 // Roadside fencing, headlamps and moving road perspective.
 g.strokeStyle='#5f8991';g.lineWidth=3;
 for(let i=0;i<7;i++){
  const fy=108+((i*37+t*.10)%78),spread=(fy-100)*2.6;
  g.beginPath();g.moveTo(w/2-spread,fy);g.lineTo(w/2-spread-20,fy-5);g.moveTo(w/2+spread,fy);g.lineTo(w/2+spread+20,fy-5);g.stroke();
 }
 g.fillStyle='#27404a';g.beginPath();g.roundRect(w/2-45,h-49,90,40,9);g.fill();
 g.fillStyle='#9cdcff';g.fillRect(w/2-23,h-43,46,13);
 g.fillStyle='#ff634c';g.fillRect(w/2-42,h-24,14,7);g.fillRect(w/2+28,h-24,14,7);
 g.fillStyle='#d9ecdf';g.font='900 13px system-ui';g.textAlign='left';g.fillText(`КПП ${campaignTravel.from+1}  →  СЕКТОР ${campaignTravel.to+1}`,15,24);
 if(campaignTravel.radioIndex<2&&progress>.36*(campaignTravel.radioIndex+1))campaignNextRadio();
 if(progress>=1){campaignArrive();return;}
 requestAnimationFrame(campaignTravelFrame);
}
function campaignArrive(){
 const tr=campaignTravel;if(!tr)return;
 campaignTravel=null;$('travelOverlay').style.display='none';
 campaignLoadLocation(tr.to,{vehicle:tr.vehicle});
 paused=false;last=performance.now();
 campaignShowDialogue(CAMPAIGN_LOCATIONS[tr.to].intro);
}
function campaignFinish(){
 storyCompleted=true;running=false;paused=false;stopAllControls();
 $('polygonBanner').style.display='none';$('bossBanner').style.display='none';
 const box=document.createElement('div');box.className='box';
 const strip=document.createElement('div');strip.className='hazardStrip';box.appendChild(strip);
 const body=document.createElement('div');body.className='boxBody';
 body.innerHTML=`<h1 style="color:#9bffb4">🏆 РАССВЕТ НАД КАРАНТИНОМ</h1><div class="titleSlash"></div><p>Патриарх-0 повержен. Все четыре полигона зачищены, отряд возвращается домой.</p><div class="statsSummary"><div class="sumCard"><div class="k">СЕКТОРОВ</div><div class="v">4 / 4</div></div><div class="sumCard"><div class="k">ПОБЕД</div><div class="v">${kills}</div></div><div class="sumCard"><div class="k">ОЧКОВ</div><div class="v">${score}</div></div></div>`;
 box.appendChild(body);
 const footer=document.createElement('div');footer.className='boxFooter';
 const replay=document.createElement('button');replay.type='button';replay.className='mainbtn';replay.id='restart';replay.textContent='🔄 НОВАЯ КАМПАНИЯ';footer.appendChild(replay);
 const free=document.createElement('button');free.type='button';free.className='mainbtn secondary';free.textContent='♾️ СВОБОДНАЯ ЗАЧИСТКА';
 free.addEventListener('click',()=>{setGameMode('free');startGame();});footer.appendChild(free);
 box.appendChild(footer);$('overlay').replaceChildren(box);$('overlay').style.display='flex';
 if(score>bestScore){bestScore=score;try{localStorage.setItem('carantin_best',String(bestScore));}catch(_){}}
 SFX.ach();
}
$('dlgNext').addEventListener('click',()=>campaignAdvanceDialogue());
$('dlgSkip').addEventListener('click',campaignSkipDialogue);
$('travelRadioNext').addEventListener('click',campaignNextRadio);
$('travelArrive').addEventListener('click',campaignArrive);
