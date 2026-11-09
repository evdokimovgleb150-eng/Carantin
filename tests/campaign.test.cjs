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
// The original survival mode still initializes normally, without allocating
// the full-size ground canvas a second time when the user taps Play.
// A second allocation could exhaust mobile WebView memory.
assert.equal(run('groundIsCampaign'),false);
// The original survival mode still initializes normally.
run("setGameMode('free'); startGame();");
assert.equal(run('worldBuilds'),0);
assert.equal(run('gameMode'),'free');
assert.equal(run('evacHeli!==null'),true);
run('update(.016,1015);render(1015);');
const freeObstacleCount=run('obstacles.length');
assert.equal(run('$("locBadge").textContent'),'База');
// The evacuation achievement used to be checked only after running=false.
run('evacHeli.bought=true;victoryEscape();');
assert.equal(run('!!metaStats.unlocked.evac'),true);
run('setGameMode("campaign"); startGame(); campaignSkipDialogue();');
assert.equal(run('worldBuilds'),0);
assert.equal(run('groundIsCampaign'),true);
assert.equal(run('campaignStage'),0);
assert.equal(run('paused'),false);
run('update(.016,1016);render(1016);');
assert.equal(run('evacHeli'),null);
assert.equal(run('campaignBarrels.length'),5);
assert.equal(run('campaignNearbyCheckpoint()'),false);
assert.ok(run('obstacles.length')>freeObstacleCount,'Campaign adds its own arena barriers');
// A distant campaign target may be non-aggro; the ambient spawn cap must not
// recycle it and make the kill objective permanently unreachable.
assert.equal(run(`(()=>{const saved=zombies;
 zombies=[{x:3500,y:1800,aggro:false,campaignTag:0},
  ...Array.from({length:getMaxActiveZombies()-1},()=>({x:2500,y:1800,aggro:true}))];
 const target=zombies[0];const result=spawnZombie('walker',2500,1800);
 const intact=zombies.includes(target);zombies=saved;
 return result===null&&intact;})()`),true);
// Choices change resources, and skipping cannot drop an interactive choice.
assert.equal(run('shieldHp'),35);
// On entering polygon, fight three stages; second ends in a timed holdout.
run('player.x=CAMPAIGN_LOCATIONS[0].arena.x-100;player.y=1800;campaignUpdate(.016,1000);');
assert.equal(run('campaignState'),'combat');
assert.equal(run('campaignPhase'),0);
assert.equal(run('campaignTotal'),5);
run('zombies.slice().forEach(z=>{campaignOnKill(z);zombies.splice(zombies.indexOf(z),1)});campaignCheckWave();');
assert.equal(run('campaignPhase'),1);
run('campaignUpdate(3,1000);');
assert.equal(run('campaignTotal'),7);
run('zombies.slice().forEach(z=>{campaignOnKill(z);zombies.splice(zombies.indexOf(z),1)});campaignCheckWave();');
assert.equal(run('campaignState'),'hold');
assert.equal(run('campaignPhase'),2);
run('campaignUpdate(9,1000);');
assert.equal(run('campaignState'),'combat');
assert.equal(run('zombies.some(z=>z.type===CAMPAIGN_LOCATIONS[0].boss)'),true);
// Barrel explosion applies damage and cannot be triggered twice.
assert.equal(run('campaignBarrels[0].live'),true);
run('campaignHitBarrelsSegment(campaignBarrels[0].x-30,campaignBarrels[0].y,campaignBarrels[0].x+30,campaignBarrels[0].y);');
assert.equal(run('campaignBarrels[0].live'),false);
// Complete the polygon and carry an actual vehicle, bag, money, upgrades,
// mercenaries, turret charges and health to a freshly generated next map.
run('zombies.slice().forEach(z=>{campaignOnKill(z);zombies.splice(zombies.indexOf(z),1)});campaignCheckWave();campaignSkipDialogue();');
assert.equal(run('campaignState'),'ready');
run('money=913;upgrades.damage=2;turretCharges=3;lootBag=[LOOT_TYPES.radio];\n'+
    'mercenaries=[{id:"test",x:1,y:1,hp:90,def:MERC_TYPES.assault}];\n'+
    'const carried=vehicles.find(v=>!v.broken);carried.hp=101;carried.nitro=42;player.inVehicle=carried;\n'+
    'player.x=CAMPAIGN_LOCATIONS[0].checkpoint.x;player.y=CAMPAIGN_LOCATIONS[0].checkpoint.y;\n'+
    'campaignStartTravel();campaignArrive();campaignSkipDialogue();');
assert.equal(run('campaignStage'),1);
assert.equal(run('worldBuilds'),1);
assert.equal(run('money'),913);
assert.equal(run('upgrades.damage'),2);
assert.equal(run('turretCharges'),3);
assert.equal(run('lootBag[0].id'),'radio');
assert.equal(run('mercenaries[0].hp'),90);
assert.equal(run('player.inVehicle.hp'),101);
assert.equal(run('player.inVehicle.nitro'),42);
assert.equal(run('campaignBarrels.length'),5);
assert.equal(run('campaignState'),'approach');
assert.equal(run('paused'),false);
// Finish the remaining three locations, including the two-phase Patriarch.
for(let stage=1;stage<4;stage++){
 run(`player.x=CAMPAIGN_LOCATIONS[${stage}].arena.x-100;player.y=1800;`+
     'if(player.inVehicle){player.inVehicle.x=player.x;player.inVehicle.y=player.y;}' +
     'campaignUpdate(.016,1100);');
 assert.equal(run('campaignPhase'),0);
 for(let phase=0;phase<3;phase++){
  assert.equal(run('campaignPhase'),phase);
  run('zombies.slice().forEach(z=>{campaignOnKill(z);zombies.splice(zombies.indexOf(z),1)});campaignCheckWave();');
  if(phase===0)run('campaignUpdate(3,1200);');
  if(phase===1){assert.equal(run('campaignState'),'hold');run('campaignUpdate(20,1300);');}
 }
 assert.equal(run('campaignState'),'ready');
 run('campaignSkipDialogue();');
 if(stage<3){
  run(`player.x=CAMPAIGN_LOCATIONS[${stage}].checkpoint.x;player.y=1800;`+
      'campaignStartTravel();campaignArrive();campaignSkipDialogue();');
  assert.equal(run('campaignStage'),stage+1);
 }
}
assert.equal(run('storyCompleted'),true);
assert.equal(run('running'),false);
assert.equal(run('campaignStage'),3);
// Starting free survival after a campaign must remove its polygon barriers,
// checkpoint paint and tinted ground rather than retaining the final sector.
run('setGameMode("free"); startGame();');
assert.equal(run('worldBuilds'),4);
assert.equal(run('groundIsCampaign'),false);
assert.equal(run('obstacles.length'),freeObstacleCount);
assert.equal(run('campaignBarrels.length'),0);
assert.equal(run('$("locBadge").textContent'),'База');
assert.equal(run('gameMode'),'free');
run('update(.016,1515);render(1515);');
console.log('CAMPAIGN / SURVIVAL / TRAVEL / HOLDOUT / ACHIEVEMENTS / RESET TESTS PASSED');
