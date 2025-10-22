// HARIBOW TD — minimal ES module implementation
const TILE=32;
const COLS=26, ROWS=18; // 832x576
const CANVAS=document.getElementById('game');
const CTX=CANVAS.getContext('2d');
const ui={wave:document.getElementById('wave'),hp:document.getElementById('hp'),gold:document.getElementById('gold'),start:document.getElementById('startBtn'),type:document.getElementById('towerType')};

// --- Map: simple path winding left->right ---
const grid=new Array(ROWS).fill(0).map(()=>new Array(COLS).fill(0));
const path=[];
(function buildPath(){
  let r=9;
  for(let c=0;c<COLS;c++){
    grid[r][c]=1; path.push([r,c]);
    if(c%6===5){ r+= (Math.random()<.5? -1:1); r=Math.max(2, Math.min(ROWS-3,r)); }
  }
})();

const base={r:path[path.length-1][0], c:path[path.length-1][1], hp:20};
let gold=100, wave=1;
const towers=[], bullets=[], enemies=[];

const TOWER_DEF={
  basic:{cost:50, range:4, rate:40, dmg:10, speed:6},
  slow:{cost:70, range:3.5, rate:50, dmg:6, speed:5, slow:.6, slowTime:60},
  sniper:{cost:90, range:7, rate:70, dmg:20, speed:8}
};

// --- Helpers ---
const toXY=(r,c)=>[c*TILE+TILE/2, r*TILE+TILE/2];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// --- Enemy waves ---
function spawnWave(){
  const count=8+wave*2;
  for(let i=0;i<count;i++){
    enemies.push({pathIdx:0, t: -i*18, hp: 40+wave*8, speed: 1.2+wave*.05, slowT:0});
  }
}

function enemyStep(e){
  e.t += e.speed * (e.slowT>0? (TOWER_DEF.slow.slow):1);
  if(e.slowT>0) e.slowT--;
  const seg=Math.floor(Math.max(0,e.t));
  const idx=Math.min(seg, path.length-2);
  const [r1,c1]=path[idx], [r2,c2]=path[idx+1];
  const [x1,y1]=toXY(r1,c1), [x2,y2]=toXY(r2,c2);
  const tt=e.t-idx;
  e.x=x1+(x2-x1)*tt; e.y=y1+(y2-y1)*tt;
  if(idx>=path.length-2 && tt>1){ base.hp--; ui.hp.textContent=base.hp; e.dead=true; }
}

// --- Towers ---
function tryPlace(r,c,type){
  if(grid[r][c]!==0) return false;
  const def=TOWER_DEF[type];
  if(gold<def.cost) return false;
  gold-=def.cost; ui.gold.textContent=gold;
  const [x,y]=toXY(r,c);
  towers.push({x,y,type, cd:0});
  return true;
}

function towersAct(){
  for(const t of towers){
    if(t.cd>0){ t.cd--; continue;}
    const def=TOWER_DEF[t.type];
    let target=null, best=-1;
    for(const e of enemies){
      if(e.dead) continue;
      const d=Math.hypot(t.x-e.x,t.y-e.y)/TILE;
      if(d<=def.range){
        const prog=e.t;
        if(prog>best){ best=prog; target=e;}
      }
    }
    if(target){
      const ang=Math.atan2(target.y-t.y, target.x-t.x);
      const sp=def.speed;
      bullets.push({x:t.x,y:t.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, dmg:def.dmg, slow:(def.slow||0), slowTime:(def.slowTime||0)});
      t.cd=def.rate;
    }
  }
}

function bulletsStep(){
  for(const b of bullets){
    b.x+=b.vx; b.y+=b.vy;
    for(const e of enemies){
      if(e.dead) continue;
      if(Math.hypot(b.x-e.x,b.y-e.y) < 12){
        e.hp-=b.dmg;
        if(b.slow) e.slowT=Math.max(b.slowTime,e.slowT);
        b.dead=true; if(e.hp<=0){ e.dead=true; gold+=6; ui.gold.textContent=gold;}
        break;
      }
    }
    if(b.x<0||b.y<0||b.x>CANVAS.width||b.y>CANVAS.height) b.dead=true;
  }
}

// --- Input ---
CANVAS.addEventListener('click', (ev)=>{
  const rect=CANVAS.getBoundingClientRect();
  const cx=ev.clientX-rect.left, cy=ev.clientY-rect.top;
  const c=Math.floor(cx/TILE), r=Math.floor(cy/TILE);
  tryPlace(r,c, ui.type.value);
});
window.addEventListener('keydown', (e)=>{
  if(e.key==='r'||e.key==='R'){
    const t=towers.pop(); if(t){ const cost=TOWER_DEF[t.type].cost; gold+=Math.floor(cost/2); ui.gold.textContent=gold;}
  }
});

// --- Draw ---
function draw(){
  CTX.clearRect(0,0,CANVAS.width,CANVAS.height);
  // grid & path
  const cs = getComputedStyle(document.documentElement);
  const colPath = cs.getPropertyValue('--path').trim();
  const colTile = cs.getPropertyValue('--tile').trim();
  const colRange = cs.getPropertyValue('--range').trim();

  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      CTX.fillStyle= grid[r][c]===1? colPath : colTile;
      CTX.fillRect(c*TILE, r*TILE, TILE-1, TILE-1);
    }
  }
  // draw base
  const [bx,by]=toXY(base.r,base.c);
  CTX.fillStyle='#ef4444'; CTX.beginPath(); CTX.arc(bx,by,12,0,Math.PI*2); CTX.fill();

  // towers
  for(const t of towers){
    const def=TOWER_DEF[t.type];
    CTX.fillStyle='#8b5cf6'; CTX.beginPath(); CTX.arc(t.x,t.y,10,0,Math.PI*2); CTX.fill();
    // range
    CTX.fillStyle=colRange;
    CTX.beginPath(); CTX.arc(t.x,t.y,def.range*TILE,0,Math.PI*2); CTX.fill();
  }
  // enemies
  for(const e of enemies){ if(e.dead) continue; CTX.fillStyle='#f59e0b'; CTX.beginPath(); CTX.arc(e.x,e.y,10,0,Math.PI*2); CTX.fill(); }
  // bullets
  CTX.fillStyle='#e5e7eb';
  for(const b of bullets){ if(!b.dead) CTX.fillRect(b.x-2,b.y-2,4,4); }
}

// --- Loop ---
let tick=0;
function loop(){
  tick++;
  if(tick%2===0){ for(const e of enemies){ if(!e.dead) enemyStep(e);} bulletsStep(); towersAct(); }
  // cleanup
  for(let i=enemies.length-1;i>=0;i--) if(enemies[i].dead) enemies.splice(i,1);
  for(let i=bullets.length-1;i>=0;i--) if(bullets[i].dead) bullets.splice(i,1);
  draw();
  requestAnimationFrame(loop);
}

ui.start.addEventListener('click',()=>{ if(base.hp<=0) return; spawnWave(); ui.wave.textContent=++wave; });

// init positions so drawing has something
const [sx,sy]=toXY(path[0][0], path[0][1]);
for(let i=0;i<3;i++){ enemies.push({t:-i*22, hp:20, speed:1.2, x:sx, y:sy, slowT:0}); }
ui.gold.textContent=gold; ui.hp.textContent=base.hp;
loop();
