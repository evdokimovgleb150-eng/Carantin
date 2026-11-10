// Run with: node tests/lan.test.cjs — deterministic two-device protocol smoke test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const lan=fs.readFileSync('lan.js','utf8');
function device(){
 const nodes=new Map(),grad=()=>({addColorStop(){}});
 const draw=new Proxy({createRadialGradient:grad,createLinearGradient:grad,measureText:()=>({width:50})},
  {get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});
 const elem=()=>({style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},
  setAttribute(){},getContext(){return draw},getBoundingClientRect(){return {left:0,top:0,width:800,height:600}},
  append(){},appendChild(){},replaceChildren(){},querySelectorAll(){return []},querySelector(){return null},
  innerHTML:'',textContent:'',width:136,height:136});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,elem());return nodes.get(id)},
  createElement:elem,querySelectorAll(){return []},documentElement:elem(),body:elem(),addEventListener(){}};
 const bridge={send(){},host(){},join(){},close(){}};
 const ctx=vm.createContext({document,window:{CarantinLan:bridge,addEventListener(){},location:{}},
  localStorage:{getItem(){return null},setItem(){}},navigator:{},screen:{},performance:{now:()=>2100},
  requestAnimationFrame(){},innerWidth:1000,innerHeight:650,devicePixelRatio:1,
  setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){},
  CanvasRenderingContext2D:function(){},console});
 vm.runInContext(inline,ctx,{timeout:30000});
 vm.runInContext(lan,ctx,{timeout:30000});
 return {ctx,bridge,run(src){return vm.runInContext(src,ctx,{timeout:30000})}};
}
const host=device(),guest=device();
host.bridge.send=data=>guest.run(`window.lanReceive('data',${JSON.stringify(data)})`);
guest.bridge.send=data=>host.run(`window.lanReceive('data',${JSON.stringify(data)})`);
host.run("lanRole='host';setGameMode('free');startGame();window.lanReceive('connected','ok');");
guest.run("lanRole='guest';window.lanReceive('connected','ok');");
host.run('lanSendSnapshot(2000)');
assert.equal(guest.run('lanGuestReady'),true);
assert.equal(guest.run('gameMode'),'free');
assert.equal(guest.run('running'),true);
assert.equal(guest.run('zombies.length'),host.run('zombies.length'));
const start=host.run('lanPeer.x');
guest.run('touchJoy.x=1;lanGuestTick(.016,2150);');
host.run('lanHostTick(.1,2150)');
assert.ok(host.run('lanPeer.x')>start);
assert.ok(host.run('lanPeer.x')<=start+20); // host caps movement at 195 world units/s
host.run("window.lanReceive('data',JSON.stringify({v:1,t:'input',x:999,y:0,a:0,fire:true}))");
host.run('lanHostTick(.1,2200)');
assert.ok(host.run('lanPeer.x')<=start+40);
// Guest shots originate and do damage only on the authoritative host.
host.run('lanPeer.x=1100;lanPeer.y=650;lanInput={x:0,y:0,a:0,fire:true};lanInputAt=2100;lanFireCooldown=0;lanHostTick(.1,2110);');
assert.equal(host.run('bullets.some(b=>b.color==="#70eaff")'),true);
host.run('lanPeer.inv=0;lanDamagePeer(100);');
assert.equal(host.run('lanPeer.hp'),0);
host.run('lanHostTick(5.1,2200);');
assert.equal(host.run('lanPeer.hp'),100);
host.run('lanSendSnapshot(2300)');
assert.equal(guest.run('Math.round(player.x)'),Math.round(host.run('lanPeer.x')));
assert.equal(guest.run('Math.round(lanPeer.x)'),Math.round(host.run('player.x')));
guest.run('render(2300);renderRadar(2300);');
// A malformed or out-of-version packet cannot rewrite the host world.
const before=host.run('score');
host.run("window.lanReceive('data','{bad json');window.lanReceive('data',JSON.stringify({v:2,t:'state',score:999999}));");
assert.equal(host.run('score'),before);
host.run('lanLeave()');guest.run('lanLeave()');
assert.equal(host.run('lanRole'),'solo');
assert.equal(guest.run('lanRole'),'solo');
console.log('LAN TWO-PLAYER TESTS PASSED');
