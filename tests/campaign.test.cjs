// Run with: node tests/campaign.test.cjs
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
// If the separate script was unavailable (offline/stale cache/WebView 404),
// startGame() used to throw after hiding the menu, leaving only HUD buttons.
assert.ok(!html.includes('<script src="./campaign.js">'));
const nodes=new Map();
const grad=()=>({addColorStop(){}});
const canvasMethods={createRadialGradient:grad,createLinearGradient:grad,measureText:()=>({width:50})};
const draw=new Proxy(canvasMethods,{get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});
function element(tag='div'){
 return {tagName:tag,style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){},getContext(){return draw},getBoundingClientRect(){return {left:0,top:0,width:800,height:600}},
  append(){},appendChild(){},replaceChildren(){},querySelectorAll(){return []},querySelector(){return null},
  setAttribute(){},closest(){return null},innerHTML:'',textContent:'',width:136,height:136};
}
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},
 createElement:element,querySelectorAll(){return []},documentElement:element('html'),addEventListener(){}};
const store=new Map();
const context=vm.createContext({document,window:{addEventListener(){},location:{}},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))},
 navigator:{},screen:{},performance:{now:()=>1000},requestAnimationFrame(){},
 innerWidth:1000,innerHeight:650,devicePixelRatio:1,setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},
 CanvasRenderingContext2D:function(){},console});
vm.runInContext(inline,context,{timeout:30000});
const run=src=>vm.runInContext(src,context,{timeout:30000});
run('let worldBuilds=0;const originalWorldBuild=buildWorldGround;'+
    'buildWorldGround=()=>{worldBuilds++;return originalWorldBuild();};');
assert.ok(html.includes('data-mode="free"'));
assert.ok(html.includes('data-mode="campaign"'));
assert.equal(run('readCampaignSave()'),null);
// Open-world runs still have their own city, wave system, loot and evacuation.
run("setGameMode('free');startGame();update(.016,1015);render(1015);");
assert.equal(run('gameMode'),'free');
assert.equal(run('$("start").textContent'),'🌍 НАЧАТЬ ОТКРЫТЫЙ МИР');
assert.equal(run('groundIsCampaign'),false);
assert.equal(run('evacHeli!==null'),true);
assert.equal(run('worldBuilds'),0);
assert.ok(html.includes('id="expandedRadar" width="544"'));
run('openMap();');
assert.equal(run('paused'),true);
assert.equal(run('$("mapModal").style.display'),'flex');
run('closeMap();');
assert.equal(run('paused'),false);
run('gameOver();setGameMode("campaign");startGame();campaignSkipDialogue();');
assert.equal(run('gameMode'),'campaign');
assert.equal(run('campaignState'),'investigate');
assert.equal(run('campaignCurrentSite().name'),'Разбитая рация');
assert.equal(run('campaignInspectSite()'),false); // not at the clue yet
run('player.x=campaignCurrentSite().x;player.y=campaignCurrentSite().y;campaignInspectSite();campaignSkipDialogue();');
assert.equal(run('campaignObjectiveIndex'),1);
assert.equal(run('campaignState'),'investigate');
assert.equal(run('saveCampaign()'),true);
const firstSave=store.get('carantin_campaign_v1');
assert.equal(JSON.parse(firstSave).version,2);
// Fresh page VM uses the same localStorage, as a browser reload would.
const freshNodes=new Map();
const freshDoc={...document,getElementById(id){if(!freshNodes.has(id))freshNodes.set(id,element());return freshNodes.get(id)}};
const fresh=vm.createContext({document:freshDoc,window:{addEventListener(){},location:{}},
 localStorage:context.localStorage,navigator:{},screen:{},performance:{now:()=>1000},requestAnimationFrame(){},
 innerWidth:1000,innerHeight:650,devicePixelRatio:1,setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},
 CanvasRenderingContext2D:function(){},console});
vm.runInContext(inline,fresh,{timeout:30000});
const loaded=src=>vm.runInContext(src,fresh,{timeout:30000});
assert.equal(loaded('loadCampaign()'),true);
assert.equal(loaded('campaignState'),'investigate');
assert.equal(loaded('campaignObjectiveIndex'),1);
assert.equal(loaded('campaignCurrentSite().name'),'Маршрутный лист');
loaded('update(.016,1016);render(1016);');
// Pause → Menu requires confirmation but does not erase the campaign slot.
loaded('pauseGame();');
assert.equal(loaded('paused'),true);
assert.equal(loaded('$("pauseScreen").style.display'),'flex');
loaded('returnToMenu();');
assert.equal(loaded('running'),false);
assert.equal(loaded('$("overlay").style.display'),'flex');
assert.equal(store.get('carantin_campaign_v1'),firstSave);
assert.equal(loaded('loadCampaign()'),true);
assert.equal(loaded('campaignObjectiveIndex'),1);
// Old manual saves are accepted and routed into the new investigation.
const legacy={...JSON.parse(firstSave),version:1,state:'approach'};
store.set('carantin_campaign_v1',JSON.stringify(legacy));
assert.equal(loaded('loadCampaign()'),true);
assert.equal(loaded('campaignState'),'investigate');
assert.equal(loaded('campaignObjectiveIndex'),0);
store.set('carantin_campaign_v1',firstSave);
// 12 interactable clues, varied defenses and boss encounters across 4 chapters.
for(let stage=0;stage<4;stage++){
 if(stage>0)assert.equal(run('campaignState'),'investigate');
 const mission=run(`CAMPAIGN_MISSIONS[${stage}]`);
 assert.equal(mission.sites.length,3);
 assert.equal(run(`CAMPAIGN_MISSIONS[${stage}].sites.every(s=>isOnRoad(s.x,s.y)&&!isInSafeZone(s.x,s.y)&&!wallRects.some(w=>circleOverlapsRect(s.x,s.y,32,w)))`),true);
 for(let i=stage===0?1:0;i<3;i++){
  run('player.x=campaignCurrentSite().x;player.y=campaignCurrentSite().y;');
  assert.equal(run('campaignNearbySite()!==null'),true);
  assert.equal(run('campaignInspectSite()'),true);
  run('campaignSkipDialogue();');
  assert.equal(run('campaignObjectiveIndex'),i+1);
 }
 assert.equal(run('campaignState'),'approach');
 run(`player.x=CAMPAIGN_LOCATIONS[${stage}].arena.x;player.y=CAMPAIGN_LOCATIONS[${stage}].arena.y;campaignUpdate(.016,1100);`);
 assert.equal(run('campaignState'),'combat');
 assert.equal(run('campaignTotal')>0,true);
 if(stage===0){
  run('zombies[0].hp=2;campaignBarrels[0].live=false;money=275;lootBag=[LOOT_TYPES.radio];player.inVehicle=vehicles[0];');
  assert.equal(run('saveCampaign()'),true);
  assert.equal(loaded('loadCampaign()'),true);
  assert.equal(loaded('campaignState'),'combat');
  assert.equal(loaded('zombies[0].hp'),2);
  assert.equal(loaded('campaignObjectiveIndex'),3);
  assert.equal(loaded('player.inVehicle===vehicles[0]'),true);
  assert.equal(loaded('campaignBarrels[0].live'),false);
  assert.equal(loaded('lootBag[0].id'),'radio');
  run('player.inVehicle=null;');
 }
 for(let phase=0;phase<mission.phases;phase++){
  assert.equal(run('campaignPhase'),phase);
  run('zombies.slice().filter(z=>z.campaignTag===campaignStage).forEach(z=>{campaignOnKill(z);zombies.splice(zombies.indexOf(z),1)});campaignCheckWave();');
  if(phase===mission.phases-1)break;
  run('campaignSkipDialogue();');
  if(run('campaignState')==='hold'){
   const hold=run('campaignHold');
   assert.ok(hold>=26,'defense is long enough to matter');
   run('player.x=SAFE_ZONE.x;player.y=SAFE_ZONE.y;campaignUpdate(2,1200);');
   assert.equal(run('campaignHold'),hold,'upload pauses when away from the objective');
   run(`player.x=CAMPAIGN_LOCATIONS[${stage}].arena.x;player.y=CAMPAIGN_LOCATIONS[${stage}].arena.y;campaignUpdate(${hold+1},1200);`);
   assert.equal(run('campaignState'),'combat');
   if(stage===1){
    assert.equal(run('saveCampaign()'),true);
    assert.equal(loaded('loadCampaign()'),true);
    assert.equal(loaded('campaignStage'),1);
    assert.equal(loaded('campaignPhase'),1);
   }
  }else run('campaignUpdate(8,1200);');
  assert.equal(run('campaignState'),'combat');
 }
 assert.equal(run('campaignState'),'ready');
 run('campaignSkipDialogue();');
 if(stage<3){
  run(`player.inVehicle=vehicles[0];player.x=CAMPAIGN_LOCATIONS[${stage}].checkpoint.x;player.y=CAMPAIGN_LOCATIONS[${stage}].checkpoint.y;`+
      'campaignStartTravel();campaignArrive();campaignSkipDialogue();');
  assert.equal(run('campaignStage'),stage+1);
  assert.equal(run('groundIsCampaign'),true);
  assert.equal(run('vehicles.filter(v=>v.id===player.inVehicle.id).length'),1);
 }
}
assert.equal(run('storyCompleted'),true);
assert.equal(run('running'),false);
// Returning from campaign to open world removes campaign-only ground effects.
run('setGameMode("free");startGame();update(.016,1515);render(1515);');
assert.equal(run('groundIsCampaign'),false);
assert.equal(run('worldBuilds'),4);
assert.equal(run('gameMode'),'free');
assert.equal(run('evacHeli!==null'),true);
// Existing campaign save can still load while the open-world run is active.
assert.equal(run('loadCampaign()'),true);
assert.equal(run('gameMode'),'campaign');
assert.equal(run('campaignStage'),1);
store.set('carantin_campaign_v1','{not json');
assert.equal(run('loadCampaign()'),false);
console.log('STORY MISSIONS / OPEN WORLD / SAVE MIGRATION TESTS PASSED');
