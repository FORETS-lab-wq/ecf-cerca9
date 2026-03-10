// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
let W=0, H=0;
let tool='select', drawColor='#1c1c1e', fillColor='rgba(58,58,60,.15)', strokeSz=2;
let showGrid=false;
let stepCounter=1; // numérotation procédurale
let isDrawing=false, sx=0, sy=0, lx=0, ly=0, curPath=[];
let elements=[], drawings=[];
let selEl=null, dragOX=0, dragOY=0, dragging=false;
let undoStack=[], redoStack=[];

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
function init(){
  resize();
  window.addEventListener('resize', ()=>{ resize(); redraw(); });
  setupEvents();
  loadScene('inter4');
}
function resize(){
  const w=document.getElementById('cWrap');
  W=w.clientWidth; H=w.clientHeight;
  canvas.width=W; canvas.height=H;
  redraw();
}

// ═══════════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════
const isMob=()=>window.innerWidth<680;
function toggleSb(){
  const sb=document.getElementById('sb');
  if(isMob()){
    const open=sb.classList.toggle('open');
    document.getElementById('sbOv').classList.toggle('show',open);
  } else {
    sb.classList.toggle('hidden');
    setTimeout(()=>{ resize(); },230);
  }
}
function closeSb(){
  document.getElementById('sb').classList.remove('open');
  document.getElementById('sbOv').classList.remove('show');
}
function sbTab(n){
  ['tools','elems','scenes'].forEach(t=>{
    document.getElementById('sbt-'+t).classList.toggle('on',t===n);
    document.getElementById('sbp-'+t).classList.toggle('on',t===n);
  });
  if(isMob()){ document.getElementById('sb').classList.add('open'); document.getElementById('sbOv').classList.add('show'); }
}

// ═══════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════
function setTool(t){
  tool=t;
  if(t!=='select'){selEl=null;updateSelHud();}
  // Reset step counter when switching TO number tool
  if(t==='number') stepCounter=1;
  document.querySelectorAll('.tb').forEach(b=>b.classList.remove('on'));
  const el=document.getElementById('tool-'+t);
  if(el)el.classList.add('on');
  canvas.style.cursor={select:'default',erase:'cell',text:'text',number:'crosshair'}[t]||'crosshair';
  redraw();
  if(isMob())closeSb();
}
function setColor(el){drawColor=el.dataset.c;document.querySelectorAll('#cGrid .cd').forEach(d=>d.classList.remove('on'));el.classList.add('on');}
function setFill(el){fillColor=el.dataset.f;document.querySelectorAll('#fGrid .cd').forEach(d=>d.classList.remove('on'));el.classList.add('on');}
function setSz(el){strokeSz=+el.dataset.s;document.querySelectorAll('.so').forEach(s=>s.classList.remove('on'));el.classList.add('on');}

// ═══════════════════════════════════════════════════════
// UNDO / REDO
// ═══════════════════════════════════════════════════════
function snap(){return{d:JSON.parse(JSON.stringify(drawings)),e:JSON.parse(JSON.stringify(elements))};}
function saveState(){undoStack.push(snap());if(undoStack.length>60)undoStack.shift();redoStack=[];}
function undo(){if(!undoStack.length)return toast('Rien à annuler');redoStack.push(snap());const s=undoStack.pop();drawings=s.d;elements=s.e;selEl=null;updateSelHud();redraw();}
function redo(){if(!redoStack.length)return toast('Rien à rétablir');undoStack.push(snap());const s=redoStack.pop();drawings=s.d;elements=s.e;selEl=null;updateSelHud();redraw();}

// ═══════════════════════════════════════════════════════
// SELECTION HUD
// ═══════════════════════════════════════════════════════
function updateSelHud(){document.getElementById('selHud').classList.toggle('show',!!selEl);}
function delSel(){if(!selEl)return;saveState();elements=elements.filter(e=>e!==selEl);selEl=null;updateSelHud();redraw();}
function rotSel(){if(!selEl)return;saveState();selEl.rot=(selEl.rot||0)+Math.PI/4;redraw();}
function dupSel(){if(!selEl)return;saveState();const c=JSON.parse(JSON.stringify(selEl));c.x+=32;c.y+=32;elements.push(c);selEl=c;redraw();}

// ═══════════════════════════════════════════════════════
// POINTER EVENTS
// ═══════════════════════════════════════════════════════
let viewScale=1,viewOffX=0,viewOffY=0,pinchDist0=0,pinchScale0=1;
function getPos(e){const r=canvas.getBoundingClientRect();const s=e.touches?e.touches[0]:e.changedTouches?e.changedTouches[0]:e;return{x:(s.clientX-r.left-viewOffX)/viewScale,y:(s.clientY-r.top-viewOffY)/viewScale};}
function setupEvents(){
  canvas.addEventListener('mousedown', onDown); canvas.addEventListener('touchstart', onDown,{passive:false});
  canvas.addEventListener('mousemove', onMove); canvas.addEventListener('touchmove',  onMove,{passive:false});
  canvas.addEventListener('mouseup',   onUp);   canvas.addEventListener('touchend',   onUp);
  canvas.addEventListener('mouseleave',onUp);
  canvas.addEventListener('dblclick',()=>{if(tool==='select'&&selEl)rotSel();});
  // Pinch to zoom (tactile)
  canvas.addEventListener('touchstart',e=>{
    if(e.touches.length===2){pinchDist0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);pinchScale0=viewScale;}
  },{passive:true});
  canvas.addEventListener('touchmove',e=>{
    if(e.touches.length===2){e.preventDefault();const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);viewScale=Math.min(4,Math.max(0.3,pinchScale0*(d/pinchDist0)));redraw();}
  },{passive:false});
  // Molette souris (desktop)
  canvas.addEventListener('wheel',e=>{e.preventDefault();viewScale=Math.min(4,Math.max(0.3,viewScale*(e.deltaY<0?1.12:0.9)));redraw();},{passive:false});
  // Bouton reset zoom
  document.getElementById('zoomReset')?.addEventListener('click',()=>{viewScale=1;viewOffX=0;viewOffY=0;redraw();});
}
function onDown(e){
  e.preventDefault();
  const p=getPos(e); isDrawing=true; dragging=false; sx=p.x; sy=p.y; lx=p.x; ly=p.y;
  if(tool==='select'){
    let hit=null;
    for(let i=elements.length-1;i>=0;i--){const el=elements[i],s=(el.sz||50)*.62;if(Math.abs(el.x-p.x)<s&&Math.abs(el.y-p.y)<s){hit=el;break;}}
    if(hit!==selEl){selEl=hit;updateSelHud();redraw();}
    if(selEl){dragOX=p.x-selEl.x;dragOY=p.y-selEl.y;dragging=true;}
    return;
  }
  if(tool==='pen'){saveState();curPath=[{x:p.x,y:p.y}];return;}
  if(tool==='erase'){saveState();eraseAt(p.x,p.y);return;}
  if(tool==='number'){
    saveState();
    drawings.push({t:'step',x:p.x,y:p.y,n:stepCounter,color:drawColor});
    stepCounter++;
    redraw();return;
  }
  // text handled in onUp to avoid prompt blocking draw pipeline
}
function onMove(e){
  e.preventDefault();if(!isDrawing)return;
  const p=getPos(e);
  if(tool==='select'&&dragging&&selEl){selEl.x=p.x-dragOX;selEl.y=p.y-dragOY;redraw();return;}
  if(tool==='pen'){curPath.push({x:p.x,y:p.y});ctx.strokeStyle=drawColor;ctx.lineWidth=strokeSz;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.stroke();lx=p.x;ly=p.y;return;}
  if(tool==='erase'){eraseAt(p.x,p.y);return;}
  redraw();preview(p.x,p.y);
}
function onUp(e){
  if(!isDrawing)return;isDrawing=false;dragging=false;
  const src=e.changedTouches?e.changedTouches[0]:e;
  const r=canvas.getBoundingClientRect();
  const p={x:src.clientX-r.left,y:src.clientY-r.top};
  if(tool==='select'||tool==='number')return;
  if(tool==='text'){
    // small movement threshold = deliberate click, not drag
    if(Math.hypot(p.x-sx,p.y-sy)<12){
      saveState();
      const txt=prompt('Entrez votre texte :','');
      if(txt&&txt.trim()){drawings.push({t:'text',x:sx,y:sy,txt:txt.trim(),color:drawColor,sz:strokeSz});}
      redraw();
    }
    return;
  }
  if(tool==='pen'){if(curPath.length>1)drawings.push({t:'pen',path:curPath,color:drawColor,sz:strokeSz});curPath=[];redraw();return;}
  if(Math.hypot(p.x-sx,p.y-sy)<4)return;
  saveState();
  if(tool==='road')       drawings.push({t:'road',x1:sx,y1:sy,x2:p.x,y2:p.y,lanes:Math.max(1,Math.round(strokeSz/2))});
  else if(tool==='roadcurve') drawings.push({t:'roadcurve',x1:sx,y1:sy,x2:p.x,y2:p.y,lanes:Math.max(1,Math.round(strokeSz/2))});
  else if(tool==='arrow')     drawings.push({t:'arrow',x1:sx,y1:sy,x2:p.x,y2:p.y,color:drawColor,sz:strokeSz,dash:false});
  else if(tool==='dasharrow') drawings.push({t:'arrow',x1:sx,y1:sy,x2:p.x,y2:p.y,color:drawColor,sz:strokeSz,dash:true});
  else if(tool==='zone')      drawings.push({t:'rect',x:Math.min(sx,p.x),y:Math.min(sy,p.y),w:Math.abs(p.x-sx),h:Math.abs(p.y-sy),color:drawColor,fill:fillColor,sz:strokeSz});
  else if(tool==='circle')    drawings.push({t:'circle',x:sx,y:sy,r:Math.hypot(p.x-sx,p.y-sy),color:drawColor,fill:fillColor,sz:strokeSz});
  redraw();
}

// ═══════════════════════════════════════════════════════
// PREVIEW
// ═══════════════════════════════════════════════════════
function preview(mx,my){
  ctx.save();ctx.globalAlpha=.6;
  const l=Math.max(1,Math.round(strokeSz/2));
  if(tool==='road')           drawRoad(sx,sy,mx,my,l);
  else if(tool==='roadcurve') drawRoadCurve(sx,sy,mx,my,l);
  else if(tool==='arrow')     drawArrow(sx,sy,mx,my,drawColor,strokeSz,false);
  else if(tool==='dasharrow') drawArrow(sx,sy,mx,my,drawColor,strokeSz,true);
  else if(tool==='zone'){
    const rx=Math.min(sx,mx),ry=Math.min(sy,my),rw=Math.abs(mx-sx),rh=Math.abs(my-sy);
    if(fillColor!=='none'){ctx.fillStyle=fillColor;ctx.fillRect(rx,ry,rw,rh);}
    ctx.strokeStyle=drawColor;ctx.lineWidth=strokeSz;ctx.setLineDash([6,4]);ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);
  } else if(tool==='circle'){
    const r=Math.hypot(mx-sx,my-sy);
    if(fillColor!=='none'){ctx.fillStyle=fillColor;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=drawColor;ctx.lineWidth=strokeSz;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════
// ERASE
// ═══════════════════════════════════════════════════════
function eraseAt(x,y){
  const r=strokeSz*10;
  elements=elements.filter(el=>Math.hypot(el.x-x,el.y-y)>(el.sz||50)*.5+r*.3);
  drawings=drawings.filter(d=>{
    if(d.t==='pen')return!d.path.some(p=>Math.hypot(p.x-x,p.y-y)<r);
    if(d.t==='text')return Math.hypot(d.x-x,d.y-y)>r+24;
    if(d.t==='step')return Math.hypot(d.x-x,d.y-y)>r+20;
    if(['road','roadcurve','arrow'].includes(d.t))return!segNear(d.x1,d.y1,d.x2,d.y2,x,y,r);
    if(d.t==='rect')return!(x>d.x-r&&x<d.x+d.w+r&&y>d.y-r&&y<d.y+d.h+r);
    if(d.t==='circle')return Math.abs(Math.hypot(d.x-x,d.y-y)-d.r)>r;
    return true;
  });
  redraw();
}
function segNear(x1,y1,x2,y2,px,py,r){const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;let t=l2?((px-x1)*dx+(py-y1)*dy)/l2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(x1+t*dx),py-(y1+t*dy))<r;}

// ═══════════════════════════════════════════════════════
// ROAD PRIMITIVES
// ═══════════════════════════════════════════════════════
// ── helpers ──────────────────────────────────────────
function roadGrad(x1,y1,x2,y2,lw){
  // perpendicular gradient for road edges
  const ang=Math.atan2(y2-y1,x2-x1);
  const nx=Math.sin(ang)*lw/2, ny=-Math.cos(ang)*lw/2;
  const gx=(x1+x2)/2, gy=(y1+y2)/2;
  const g=ctx.createLinearGradient(gx-nx,gy-ny,gx+nx,gy+ny);
  g.addColorStop(0,'#4a4a4c');
  g.addColorStop(.06,'#2e2e30');
  g.addColorStop(.5,'#3a3a3c');
  g.addColorStop(.94,'#2e2e30');
  g.addColorStop(1,'#4a4a4c');
  return g;
}
function drawRoad(x1,y1,x2,y2,lanes){
  const lw=lanes*60+14, ang=Math.atan2(y2-y1,x2-x1);
  const ox=Math.sin(ang), oy=-Math.cos(ang);
  ctx.save(); ctx.lineCap='square';
  // ① trottoir / accotement (beige clair)
  ctx.strokeStyle='#c8bfb0'; ctx.lineWidth=lw+28;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  // ② sous-couche ombre (bord sombre)
  ctx.strokeStyle='#1a1a1b'; ctx.lineWidth=lw+6;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  // ③ chaussée avec dégradé
  ctx.strokeStyle=roadGrad(x1,y1,x2,y2,lw); ctx.lineWidth=lw;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  // ④ bordures blanches (lignes de rives)
  const edgeOff=lw/2-3;
  ctx.strokeStyle='rgba(240,235,220,.9)'; ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x1+ox*edgeOff,y1+oy*edgeOff);ctx.lineTo(x2+ox*edgeOff,y2+oy*edgeOff);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x1-ox*edgeOff,y1-oy*edgeOff);ctx.lineTo(x2-ox*edgeOff,y2-oy*edgeOff);ctx.stroke();
  // ⑤ marquages centraux
  if(lanes===1){
    // axe pointillé blanc simple
    ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2; ctx.setLineDash([22,16]);
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke(); ctx.setLineDash([]);
  } else {
    // ligne centrale jaune continue (séparation sens)
    ctx.strokeStyle='#f5c800'; ctx.lineWidth=3.5; ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    // lignes de voies blanches pointillées
    for(let l=1;l<lanes;l++){
      if(l===lanes/2) continue; // skip center (already drawn)
      const off=(l/lanes-.5)*lw;
      ctx.strokeStyle='rgba(255,255,255,.65)'; ctx.lineWidth=2.2; ctx.setLineDash([20,18]);
      ctx.beginPath();
      ctx.moveTo(x1+ox*off*2,y1+oy*off*2);
      ctx.lineTo(x2+ox*off*2,y2+oy*off*2);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  ctx.restore();
}
function drawRoadCurve(x1,y1,x2,y2,lanes){
  const mx=(x1+x2)/2,my=(y1+y2)/2,cpx=mx-(y2-y1)*.42,cpy=my+(x2-x1)*.42,lw=lanes*60+14;
  ctx.save(); ctx.lineCap='round';
  const path=()=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(cpx,cpy,x2,y2);};
  ctx.strokeStyle='#c8bfb0'; ctx.lineWidth=lw+28; path(); ctx.stroke();
  ctx.strokeStyle='#1a1a1b'; ctx.lineWidth=lw+6;  path(); ctx.stroke();
  ctx.strokeStyle='#3a3a3c'; ctx.lineWidth=lw;    path(); ctx.stroke();
  ctx.strokeStyle='rgba(240,235,220,.9)'; ctx.lineWidth=3; path(); ctx.stroke();
  if(lanes>=2){
    ctx.strokeStyle='#f5c800'; ctx.lineWidth=3.5; ctx.setLineDash([]);
    path(); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}
function drawArrow(x1,y1,x2,y2,color,sz,dash){
  const ang=Math.atan2(y2-y1,x2-x1),hl=16+sz*3.5;
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=sz+1;ctx.lineCap='round';
  if(dash)ctx.setLineDash([12,9]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2-Math.cos(ang)*hl,y2-Math.sin(ang)*hl);ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-Math.cos(ang-.42)*hl,y2-Math.sin(ang-.42)*hl);ctx.lineTo(x2-Math.cos(ang)*hl*.52,y2-Math.sin(ang)*hl*.52);ctx.lineTo(x2-Math.cos(ang+.42)*hl,y2-Math.sin(ang+.42)*hl);ctx.closePath();ctx.fill();
}

// ═══════════════════════════════════════════════════════
// ELEMENT PLACEMENT
// ═══════════════════════════════════════════════════════
function placeEl(icon,label){
  saveState();
  const el={icon,label,x:W/2+(Math.random()-.5)*120,y:H/2+(Math.random()-.5)*90,sz:52,rot:0};
  elements.push(el);selEl=el;updateSelHud();setTool('select');redraw();
  toast(label+' ajouté');if(isMob())closeSb();
}
function placeS(type){
  saveState();
  const label=SLBLS[type]||type;
  const el={special:type,label,x:W/2+(Math.random()-.5)*120,y:H/2+(Math.random()-.5)*90,sz:62,rot:0};
  elements.push(el);selEl=el;updateSelHud();setTool('select');redraw();
  toast(label+' ajouté');if(isMob())closeSb();
}
const SLBLS={
  sign_prio_route:'Route prioritaire',sign_cede:'Cédez',sign_stop:'STOP',sign_prio_droite:'Priorité à droite',
  sign_st_andre:'Priorité à droite',sign_sens_unique:'Sens unique',feu_tricolore:'Feu tricolore',
  passage_pieton:'Passage piéton',
  sign_gira:'Giratoire',sign_cede_gira:"Cédez à l'entrée",
  park_ok:'Stationnement ✓',park_no:'Stationnement ✗',park_handicap:'PMR',park_payant:'Payant',
  meca_moteur:'Moteur',meca_boite:'Boîte',meca_embrayage:'Embrayage',meca_frein:'Frein',
  meca_pneu:'Roue',meca_batterie:'Batterie',meca_angle_mort:'Angle mort'
};

// ═══════════════════════════════════════════════════════
// REDRAW
// ═══════════════════════════════════════════════════════
function redraw(){
  ctx.clearRect(0,0,W,H);
  // Fond canvas : asphalte clair hors route, léger grain
  const bgG=ctx.createLinearGradient(0,0,0,H);
  bgG.addColorStop(0,'#e8e4dc');bgG.addColorStop(1,'#ddd8ce');
  ctx.fillStyle=bgG;ctx.fillRect(0,0,W,H);
  // Les scènes (chain/clutch etc.) dessinent en absolu → pas de transform
  const hasScene=drawings.some(d=>d.t&&d.t.startsWith('scene_'));
  if(hasScene){
    drawings.forEach(renderD);
    elements.forEach(renderEl);
    if(selEl)drawSel(selEl);
  } else {
    // Appliquer zoom/pan pour les schémas routiers
    ctx.save();
    ctx.setTransform(viewScale,0,0,viewScale,viewOffX,viewOffY);
    if(showGrid)drawGrid();
    drawings.forEach(renderD);
    elements.forEach(renderEl);
    if(selEl)drawSel(selEl);
    ctx.restore();
  }
}
function drawIntersectionBox(x,y,hw){
  // Revêtement de carrefour avec texture asphalte améliorée
  const ig=ctx.createRadialGradient(x-hw*.2,y-hw*.2,hw*.1,x,y,hw*1.6);
  ig.addColorStop(0,'#484848');ig.addColorStop(.5,'#3c3c3e');ig.addColorStop(1,'#2e2e30');
  ctx.fillStyle=ig;ctx.fillRect(x-hw,y-hw,hw*2,hw*2);
  // Marquage de stop — ligne d'arrêt blanche sur chaque branche
  ctx.strokeStyle='rgba(240,235,220,.8)';ctx.lineWidth=4;ctx.setLineDash([]);
  [[x-hw,y-hw,x+hw,y-hw],[x-hw,y+hw,x+hw,y+hw],[x-hw,y-hw,x-hw,y+hw],[x+hw,y-hw,x+hw,y+hw]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  });
  // Léger vignettage aux coins
  const cg=ctx.createRadialGradient(x,y,hw*.5,x,y,hw*1.5);
  cg.addColorStop(0,'rgba(0,0,0,0)');cg.addColorStop(1,'rgba(0,0,0,.18)');
  ctx.fillStyle=cg;ctx.fillRect(x-hw,y-hw,hw*2,hw*2);
}

function renderD(d){
  ctx.save();
  if(d.t==='scene_inter'){
    // Re-draw intersection fill square
    drawIntersectionBox(d.x,d.y,d.hw);
    if(d.hilite){ctx.fillStyle='rgba(240,128,0,.12)';ctx.fillRect(d.x-d.hw,d.y+d.hw,d.hw*2,d.h2);ctx.strokeStyle='#f08000';ctx.lineWidth=2.5;ctx.setLineDash([6,4]);ctx.strokeRect(d.x-d.hw,d.y+d.hw,d.hw*2,d.h2-1);ctx.setLineDash([]);}
  }
  else if(d.t==='scene_inter_T'){
    drawIntersectionBox(d.x,d.y-d.hw/2,d.hw*.6);
  }
  else if(d.t==='scene_gira'){
    drawGira(d.cx,d.cy,d.rInner,d.laneW,d.laneCount);
    if(d.laneCount===3){
      const {cx,cy,rInner:R,laneW:lw}=d;
      [R+lw*.5,R+lw*1.5,R+lw*2.5].forEach((rv,i)=>{
        ctx.fillStyle='rgba(255,255,255,.88)';ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(cx+rv,cy,15,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#333';ctx.font='700 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('V'+(i+1),cx+rv,cy);
      });
      ctx.fillStyle='#555';ctx.font='600 9px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
      ctx.fillText('V1=intérieure  V2=médiane  V3=extérieure',cx-R-lw*3,cy+R+lw*3+14);
    }
  }
  else if(d.t==='scene_chain'){
    drawChain(d.cx,d.cy);
  }
  else if(d.t==='scene_car_schema'){
    drawCarSchema(d.cx,d.cy);
  }
  else if(d.t==='scene_clutch'){
    drawClutch(d.cx,d.cy,d.state);
  }
  else if(d.t==='scene_clutch3'){
    drawClutch3(d.cx,d.cy);
  }
  else if(d.t==='pen'){ctx.strokeStyle=d.color;ctx.lineWidth=d.sz;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(d.path[0].x,d.path[0].y);d.path.forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();}
  else if(d.t==='road')       drawRoad(d.x1,d.y1,d.x2,d.y2,d.lanes);
  else if(d.t==='roadcurve')  drawRoadCurve(d.x1,d.y1,d.x2,d.y2,d.lanes);
  else if(d.t==='arrow')      drawArrow(d.x1,d.y1,d.x2,d.y2,d.color,d.sz,d.dash);
  else if(d.t==='rect'){
    if(d.fill&&d.fill!=='none'){ctx.fillStyle=d.fill;ctx.fillRect(d.x,d.y,d.w,d.h);}
    if(d.sz>0){ctx.strokeStyle=d.color;ctx.lineWidth=d.sz;ctx.strokeRect(d.x,d.y,d.w,d.h);}
  }
  else if(d.t==='circle'){
    if(d.fill&&d.fill!=='none'){ctx.fillStyle=d.fill;ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=d.color;ctx.lineWidth=d.sz;ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.stroke();
  }
  else if(d.t==='text'){ctx.font=`bold ${(d.sz||14)}px -apple-system,sans-serif`;ctx.fillStyle=d.color||'#1c1c1e';ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(d.text||d.txt||'',d.x,d.y);}
  else if(d.t==='step'){
    // Numéro procédural : cercle coloré + chiffre blanc
    const r=18+strokeSz*1.5;
    ctx.fillStyle=d.color;
    ctx.beginPath();ctx.arc(d.x,d.y,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(d.x,d.y,r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`bold ${r*1.1}px -apple-system,sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(d.n),d.x,d.y+1);
  }
  ctx.restore();
}
function renderEl(el){
  ctx.save();ctx.translate(el.x,el.y);if(el.rot)ctx.rotate(el.rot);
  if(el.special)drawSpecial(el);
  else{ctx.font=`${el.sz||52}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(el.icon,0,0);}
  if(el.label){ctx.font=`600 11px -apple-system,sans-serif`;ctx.fillStyle='rgba(20,20,22,.82)';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(el.label,0,(el.sz||52)*.52+2);}
  ctx.restore();
}
function drawSel(el){
  const s=(el.sz||52)*.64+10;
  ctx.save();ctx.translate(el.x,el.y);if(el.rot)ctx.rotate(el.rot);
  ctx.strokeStyle='#0a7aff';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.strokeRect(-s,-s,s*2,s*2);ctx.setLineDash([]);
  ctx.fillStyle='#0a7aff';ctx.beginPath();ctx.arc(0,-s-14,7,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════
// SPECIAL ELEMENTS
// ═══════════════════════════════════════════════════════
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
function diamond(r){ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r,0);ctx.lineTo(0,r);ctx.lineTo(-r,0);ctx.closePath();}
function drawSpecial(el){
  const s=el.sz||62,t=el.special;
  if(t==='sign_prio_route'){ctx.fillStyle='#f5c800';ctx.strokeStyle='#2a2a2a';ctx.lineWidth=3;diamond(s*.44);ctx.fill();ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;diamond(s*.28);ctx.stroke();}
  else if(t==='sign_cede'){ctx.fillStyle='#fff';ctx.strokeStyle='#cc0000';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(0,s*.46);ctx.lineTo(-s*.44,-s*.36);ctx.lineTo(s*.44,-s*.36);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#cc0000';ctx.font=`bold ${s*.38}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('▽',0,s*.04);}
  else if(t==='sign_stop'){const r=s*.43;ctx.fillStyle='#cc0000';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/8;ctx.lineTo(r*Math.cos(a),r*Math.sin(a));}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font=`bold ${s*.26}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('STOP',0,1);}
  else if(t==='sign_prio_droite'){ctx.fillStyle='rgba(10,122,255,.1)';ctx.strokeStyle='#0a7aff';ctx.lineWidth=2;rr(ctx,-s*.42,-s*.42,s*.84,s*.84,8);ctx.fill();ctx.stroke();const hl=14+s*.06;ctx.strokeStyle='#0a7aff';ctx.fillStyle='#0a7aff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-s*.32,0);ctx.lineTo(s*.16,0);ctx.stroke();ctx.beginPath();ctx.moveTo(s*.32,0);ctx.lineTo(s*.32-hl*Math.cos(-.4),-hl*Math.sin(-.4));ctx.lineTo(s*.32-hl*.52,0);ctx.lineTo(s*.32-hl*Math.cos(.4),-hl*Math.sin(.4));ctx.closePath();ctx.fill();ctx.strokeStyle='#cc0000';ctx.fillStyle='#cc0000';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(0,s*.22);ctx.lineTo(0,0);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(0,-s*.28);ctx.lineTo(-8,-s*.14);ctx.lineTo(8,-s*.14);ctx.closePath();ctx.fill();}
  else if(t==='sign_st_andre'){
    // Triangle blanc bordure rouge + croix de Saint-André NOIRE à l'intérieur
    const h=s*.86, hw=s*.5;
    ctx.fillStyle='#fff';ctx.strokeStyle='#cc0000';ctx.lineWidth=3.5;
    ctx.beginPath();ctx.moveTo(0,-h*.62);ctx.lineTo(-hw,h*.38);ctx.lineTo(hw,h*.38);ctx.closePath();
    ctx.fill();ctx.stroke();
    // Croix de Saint-André (X) NOIRE à l'intérieur du triangle
    const cx2=0,cy2=h*.04,arm=h*.3;
    ctx.strokeStyle='#1a1a1a';ctx.lineWidth=s*.09;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(cx2-arm,cy2-arm*.7);ctx.lineTo(cx2+arm,cy2+arm*.7);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx2+arm,cy2-arm*.7);ctx.lineTo(cx2-arm,cy2+arm*.7);ctx.stroke();
  }
  else if(t==='sign_sens_unique'){
    // Panneau sens unique : rectangle bleu avec flèche blanche
    const w=s*.9,h=s*.55;
    ctx.fillStyle='#0a50c8';ctx.strokeStyle='#fff';ctx.lineWidth=3;
    rr(ctx,-w/2,-h/2,w,h,8);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';
    // Flèche vers la droite
    const aw=w*.55,ah=h*.45;
    ctx.beginPath();ctx.moveTo(-aw/2,ah*.4);ctx.lineTo(aw*.15,ah*.4);ctx.lineTo(aw*.15,ah*.75);
    ctx.lineTo(aw/2,0);ctx.lineTo(aw*.15,-ah*.75);ctx.lineTo(aw*.15,-ah*.4);ctx.lineTo(-aw/2,-ah*.4);ctx.closePath();ctx.fill();
  }
  
  else if(t==='feu_tricolore'){
    // Boîtier feu tricolore : rectangle sombre + 3 cercles colorés
    const fw=s*.34, fh=s*.95, cr=s*.13;
    ctx.fillStyle='#1a1a1c';ctx.strokeStyle='#555';ctx.lineWidth=2;
    rr(ctx,-fw/2,-fh/2,fw,fh,8);ctx.fill();ctx.stroke();
    // Visière sur chaque feu
    const fcolors=['#cc0000','#e68000','#22aa22'];
    const fy=[-fh*.32, 0, fh*.32];
    fcolors.forEach((col,i)=>{
      // Halo
      ctx.fillStyle=col+'44';ctx.beginPath();ctx.arc(0,fy[i],cr*1.2,0,Math.PI*2);ctx.fill();
      // Cercle principal
      const fg=ctx.createRadialGradient(-cr*.3,fy[i]-cr*.3,cr*.1,0,fy[i],cr);
      fg.addColorStop(0,col+'ff');fg.addColorStop(1,col+'99');
      ctx.fillStyle=fg;ctx.beginPath();ctx.arc(0,fy[i],cr,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,fy[i],cr,0,Math.PI*2);ctx.stroke();
    });
    // Pied
    ctx.fillStyle='#555';ctx.fillRect(-s*.04,fh/2,s*.08,s*.2);
  }
  else if(t==='passage_pieton'){
    // Rectangle zébré blanc/noir vue de dessus
    const pw=s*.8, ph=s*.55, stripes=5;
    // Fond gris clair (trottoir)
    ctx.fillStyle='rgba(180,175,165,.5)';
    ctx.fillRect(-pw/2-8,-ph/2-8,pw+16,ph+16);
    // Bandes blanches
    const sw=pw/stripes;
    for(let i=0;i<stripes;i++){
      ctx.fillStyle = i%2===0 ? '#fff' : '#3a3a3c';
      ctx.fillRect(-pw/2+i*sw,-ph/2,sw,ph);
    }
    // Contour
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1.5;
    ctx.strokeRect(-pw/2,-ph/2,pw,ph);
    // Silhouette piéton stylisée au centre
    ctx.fillStyle='rgba(10,122,255,.85)';
    // tête
    ctx.beginPath();ctx.arc(0,-ph*.28,ph*.1,0,Math.PI*2);ctx.fill();
    // corps
    ctx.strokeStyle='rgba(10,122,255,.85)';ctx.lineWidth=ph*.07;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,-ph*.16);ctx.lineTo(0,ph*.12);ctx.stroke();
    // bras
    ctx.beginPath();ctx.moveTo(-ph*.14,-ph*.04);ctx.lineTo(ph*.14,-ph*.04);ctx.stroke();
    // jambes
    ctx.beginPath();ctx.moveTo(0,ph*.12);ctx.lineTo(-ph*.12,ph*.3);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,ph*.12);ctx.lineTo(ph*.12,ph*.3);ctx.stroke();
  }
  else if(t==='sign_gira'){
    // Panneau giratoire : disque bleu + bordure blanche + 3 flèches blanches en rotation
    ctx.fillStyle='#0a7aff';ctx.beginPath();ctx.arc(0,0,s*.46,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=s*.07;ctx.beginPath();ctx.arc(0,0,s*.46,0,Math.PI*2);ctx.stroke();
    // 3 flèches courbes en rotation antihoraire, espacées de 120°
    const ar=s*.24, aw2=s*.1;
    ctx.strokeStyle='#fff';ctx.lineWidth=s*.1;ctx.lineCap='round';
    for(let k=0;k<3;k++){
      const a0=k*Math.PI*2/3-Math.PI/2;
      const a1=a0+Math.PI*.55;
      ctx.beginPath();ctx.arc(0,0,ar,a0,a1,false);ctx.stroke();
      // pointe de flèche
      const ex2=ar*Math.cos(a1), ey2=ar*Math.sin(a1);
      const ta=a1+Math.PI/2;
      ctx.fillStyle='#fff';ctx.beginPath();
      ctx.moveTo(ex2,ey2);
      ctx.lineTo(ex2-aw2*Math.cos(ta-0.5),ey2-aw2*Math.sin(ta-0.5));
      ctx.lineTo(ex2-aw2*Math.cos(ta+0.5),ey2-aw2*Math.sin(ta+0.5));
      ctx.closePath();ctx.fill();
    }
  }
  else if(t==='sign_cede_gira'){ctx.fillStyle='#fffbe6';ctx.strokeStyle='#cc0000';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,s*.44);ctx.lineTo(-s*.42,-s*.32);ctx.lineTo(s*.42,-s*.32);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#cc0000';ctx.font=`bold ${s*.13}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('CÉDEZ',0,-s*.06);ctx.fillText('ENTRÉE',0,s*.1);}
  else if(t==='park_ok'){ctx.fillStyle='#0a7aff';ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,s*.42,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font=`bold ${s*.44}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('P',0,2);}
  else if(t==='park_no'){ctx.fillStyle='#cc0000';ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,s*.42,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font=`bold ${s*.44}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('P',0,2);ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-s*.3,-s*.3);ctx.lineTo(s*.3,s*.3);ctx.stroke();}
  else if(t==='park_handicap'){ctx.fillStyle='#0a7aff';ctx.beginPath();ctx.arc(0,0,s*.42,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font=`${s*.44}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♿',0,2);}
  else if(t==='park_payant'){ctx.fillStyle='#30b94a';ctx.strokeStyle='#fff';ctx.lineWidth=2;rr(ctx,-s*.4,-s*.36,s*.8,s*.72,9);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font=`bold ${s*.34}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('P€',0,2);}
  else if(t==='meca_moteur'){ctx.fillStyle='rgba(100,100,110,.12)';ctx.strokeStyle='#636366';ctx.lineWidth=2.5;rr(ctx,-s*.4,-s*.3,s*.8,s*.6,7);ctx.fill();ctx.stroke();ctx.fillStyle='#636366';for(let i=-1;i<=1;i+=2){ctx.fillRect(i*s*.2-8,-s*.36,16,10);ctx.fillRect(i*s*.2-6,-s*.24,12,20);}ctx.fillStyle='#333';ctx.font=`700 ${s*.15}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('MOTEUR',0,s*.16);}
  else if(t==='meca_boite'){ctx.fillStyle='rgba(100,100,110,.1)';ctx.strokeStyle='#636366';ctx.lineWidth=2;rr(ctx,-s*.42,-s*.28,s*.84,s*.56,6);ctx.fill();ctx.stroke();const pos=[[-s*.26,-s*.12],[0,-s*.12],[s*.26,-s*.12],[-s*.26,s*.1],[0,s*.1],[s*.26,s*.1]];pos.forEach(([px,py],i)=>{ctx.fillStyle='#636366';ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='700 8px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i===5?'R':i+1,px,py);});ctx.fillStyle='#333';ctx.font=`700 ${s*.13}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('BOÎTE',0,s*.3);}
  else if(t==='meca_embrayage'){ctx.strokeStyle='#0a7aff';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s*.15,-s*.38);ctx.lineTo(s*.15,s*.18);ctx.lineTo(-s*.28,s*.38);ctx.stroke();ctx.fillStyle='rgba(10,122,255,.18)';ctx.strokeStyle='#0a7aff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(-s*.08,s*.06,s*.22,s*.07,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(-s*.08,s*.14,s*.22,s*.07,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(t==='meca_frein'){ctx.fillStyle='rgba(204,0,0,.1)';ctx.strokeStyle='#cc0000';ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(0,0,s*.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#cc0000';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(0,0,s*.24,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(204,0,0,.65)';ctx.fillRect(-s*.12,-s*.46,s*.24,s*.1);ctx.fillStyle='#cc0000';ctx.font=`700 ${s*.15}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('FREIN',0,s*.1);}
  else if(t==='meca_pneu'){ctx.strokeStyle='#1c1c1e';ctx.lineWidth=s*.1;ctx.beginPath();ctx.arc(0,0,s*.38,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(200,200,210,.85)';ctx.strokeStyle='#888';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,s*.22,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#999';ctx.lineWidth=2;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(s*.22*Math.cos(a),s*.22*Math.sin(a));ctx.stroke();}}
  else if(t==='meca_batterie'){ctx.fillStyle='#1c1c1e';ctx.strokeStyle='#333';ctx.lineWidth=2;rr(ctx,-s*.38,-s*.3,s*.76,s*.6,6);ctx.fill();ctx.stroke();ctx.fillStyle='#cc0000';ctx.fillRect(-s*.28,-s*.38,s*.16,s*.1);ctx.fillStyle='#444';ctx.fillRect(s*.12,-s*.38,s*.16,s*.1);ctx.fillStyle='#f5c800';ctx.font=`bold ${s*.34}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⚡',0,s*.04);}
  else if(t==='meca_angle_mort'){ctx.fillStyle='rgba(232,50,30,.2)';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,s*.46,Math.PI*.02,Math.PI*.72);ctx.closePath();ctx.fill();ctx.strokeStyle='#e8321e';ctx.lineWidth=2.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(0,0,s*.46,Math.PI*.02,Math.PI*.72);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e8321e';ctx.font=`700 ${s*.15}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('ANGLE',0,-s*.04);ctx.fillText('MORT',0,s*.1);ctx.font=`${s*.3}px serif`;ctx.textBaseline='bottom';ctx.fillText('🚗',0,s*.5);}
}

// ═══════════════════════════════════════════════════════
// GRID
// ═══════════════════════════════════════════════════════
function drawGrid(){
  const step=48;ctx.strokeStyle='rgba(0,0,0,.05)';ctx.lineWidth=1;
  for(let x=0;x<=W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<=H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle='rgba(0,0,0,.09)';ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
}
function toggleGrid(){showGrid=!showGrid;document.getElementById('btnGrid').classList.toggle('on',showGrid);redraw();}

// ═══════════════════════════════════════════════════════
// GIRATOIRE
// ═══════════════════════════════════════════════════════
function drawGira(cx,cy,rInner,laneW,laneCount){
  const rOuter=rInner+laneW*laneCount;
  // ① Grande zone verte (paysage)
  const rLandscape=rOuter+52;
  const gGround=ctx.createRadialGradient(cx,cy,rInner*.6,cx,cy,rLandscape);
  gGround.addColorStop(0,'#7ab648');
  gGround.addColorStop(.4,'#5a9e2f');
  gGround.addColorStop(1,'#4a8a22');
  ctx.fillStyle=gGround;
  ctx.beginPath();ctx.arc(cx,cy,rLandscape,0,Math.PI*2);ctx.fill();

  // ② Accotement (anneau beige)
  ctx.fillStyle='#c8bfb0';
  ctx.beginPath();ctx.arc(cx,cy,rOuter+18,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3a3a3c';
  ctx.beginPath();ctx.arc(cx,cy,rOuter+14,0,Math.PI*2);ctx.fill();

  // ③ Chaussée giratoire par voies (de l'extérieur vers l'intérieur)
  for(let l=laneCount-1;l>=0;l--){
    const rMid=rInner+laneW*l+laneW/2;
    const g=ctx.createRadialGradient(cx,cy,rMid-laneW*.4,cx,cy,rMid+laneW*.4);
    g.addColorStop(0,'#2e2e30');g.addColorStop(.5,'#3c3c3e');g.addColorStop(1,'#2a2a2c');
    ctx.strokeStyle=g; ctx.lineWidth=laneW;
    ctx.beginPath();ctx.arc(cx,cy,rMid,0,Math.PI*2);ctx.stroke();
  }

  // ④ Ligne de rive extérieure blanche
  ctx.strokeStyle='rgba(240,235,220,.95)'; ctx.lineWidth=3.5;
  ctx.beginPath();ctx.arc(cx,cy,rOuter,0,Math.PI*2);ctx.stroke();

  // ⑤ Séparations de voies (tirets jaunes)
  if(laneCount>1){
    for(let l=1;l<laneCount;l++){
      const rm=rInner+laneW*l;
      ctx.strokeStyle='rgba(245,200,0,.85)'; ctx.lineWidth=2.5; ctx.setLineDash([14,12]);
      ctx.beginPath();ctx.arc(cx,cy,rm,0,Math.PI*2);ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ⑥ Ligne de rive intérieure blanche
  ctx.strokeStyle='rgba(240,235,220,.95)'; ctx.lineWidth=3.5;
  ctx.beginPath();ctx.arc(cx,cy,rInner,0,Math.PI*2);ctx.stroke();

  // ⑦ Îlot central (belle végétation)
  const gIsland=ctx.createRadialGradient(cx,cy,0,cx,cy,rInner);
  gIsland.addColorStop(0,'#8ecf50');gIsland.addColorStop(.6,'#6ab832');gIsland.addColorStop(1,'#4a8a22');
  ctx.fillStyle=gIsland;
  ctx.beginPath();ctx.arc(cx,cy,rInner,0,Math.PI*2);ctx.fill();
  // bordure île
  ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
  ctx.beginPath();ctx.arc(cx,cy,rInner,0,Math.PI*2);ctx.stroke(); ctx.setLineDash([]);
  // Petits arbres sur l'île (cercles verts foncés)
  const numTrees=Math.max(3,Math.floor(rInner/18));
  for(let i=0;i<numTrees;i++){
    const a=i*Math.PI*2/numTrees;
    const tr=rInner*.52;
    const tx=cx+tr*Math.cos(a), ty=cy+tr*Math.sin(a);
    const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,rInner*.15);
    tg.addColorStop(0,'#5aaa28');tg.addColorStop(1,'#2d6610');
    ctx.fillStyle=tg;
    ctx.beginPath();ctx.arc(tx,ty,rInner*.13,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(tx,ty,rInner*.13,0,Math.PI*2);ctx.stroke();
  }

  // ⑧ Flèches de circulation (jaunes, bien visibles)
  for(let lane=0;lane<laneCount;lane++){
    const rAr=rInner+laneW*(lane+.5);
    [Math.PI*.25,Math.PI*.75,Math.PI*1.25,Math.PI*1.75].forEach(a=>{
      const bx=cx+rAr*Math.cos(a), by=cy+rAr*Math.sin(a);
      const ex=cx+rAr*Math.cos(a-Math.PI*.15), ey=cy+rAr*Math.sin(a-Math.PI*.15);
      const ag=Math.atan2(ey-by,ex-bx), hl=14;
      ctx.strokeStyle='rgba(255,240,40,.95)'; ctx.fillStyle='rgba(255,240,40,.95)'; ctx.lineWidth=3.5;
      ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(ex-Math.cos(ag)*hl,ey-Math.sin(ag)*hl);ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex,ey);
      ctx.lineTo(ex-Math.cos(ag-.45)*hl,ey-Math.sin(ag-.45)*hl);
      ctx.lineTo(ex-Math.cos(ag)*hl*.5,ey-Math.sin(ag)*hl*.5);
      ctx.lineTo(ex-Math.cos(ag+.45)*hl,ey-Math.sin(ag+.45)*hl);
      ctx.closePath();ctx.fill();
    });
  }

  // ⑨ Ombres douces sous la chaussée
  ctx.save();
  const shadow=ctx.createRadialGradient(cx,cy,rOuter+2,cx,cy,rOuter+22);
  shadow.addColorStop(0,'rgba(0,0,0,.22)');shadow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=shadow;
  ctx.beginPath();ctx.arc(cx,cy,rOuter+22,0,Math.PI*2);ctx.arc(cx,cy,rOuter+2,0,Math.PI*2,true);ctx.fill();
  ctx.restore();
}
function addApproach(cx,cy,R,lanes,angle,len){drawings.push({t:'road',x1:cx+R*Math.cos(angle),y1:cy+R*Math.sin(angle),x2:cx+(R+len)*Math.cos(angle),y2:cy+(R+len)*Math.sin(angle),lanes});}

// ═══════════════════════════════════════════════════════
// CINEMATIC CHAIN
// ═══════════════════════════════════════════════════════
function drawChain(cx,cy){
  // Fond de page légèrement quadrillé (style schéma technique)
  ctx.fillStyle='#f8f6f2';ctx.fillRect(0,0,W,H);
  for(let gx=0;gx<W;gx+=30){ctx.strokeStyle='rgba(0,0,0,.04)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(let gy=0;gy<H;gy+=30){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}

  const comps=[
    {id:'mot',label:'MOTEUR',        sub:'Énergie thermique\n↓ couple',     w:108,col:'#e05c00',bg:'#fff4ee'},
    {id:'emb',label:'EMBRAYAGE',     sub:'Découplage\n↓ transmission',      w:94, col:'#0a7aff',bg:'#eef5ff'},
    {id:'bvt',label:'BOÎTE DE\nVITESSES',sub:'Démultiplication\n↓ rapport', w:118,col:'#30b94a',bg:'#eefff2'},
    {id:'arb',label:'ARBRE DE\nTRANSMISSION',sub:'Transmission\n↓ couple',  w:112,col:'#f08000',bg:'#fff8ee'},
    {id:'dif',label:'DIFFÉRENTIEL',  sub:'Partage couple\n↓ roues',         w:118,col:'#9b59b6',bg:'#f8eeff'},
  ];
  const bH=92,gap=18,totalW=comps.reduce((s,c)=>s+c.w,0)+gap*(comps.length-1);
  let curX=cx-totalW/2; const pos=[];
  comps.forEach(c=>{pos.push({...c,x:curX+c.w/2,y:cy});curX+=c.w+gap;});

  // ── Arbres de transmission (tubes métalliques) ──
  pos.slice(0,-1).forEach((a,i)=>{
    const b=pos[i+1];
    const x1=a.x+a.w/2, x2=b.x-b.w/2;
    // tube
    const g=ctx.createLinearGradient(x1,(cy)-8,x1,cy+8);
    g.addColorStop(0,'#bbb');g.addColorStop(.4,'#eee');g.addColorStop(1,'#888');
    ctx.fillStyle=g;
    ctx.fillRect(x1,cy-5,x2-x1,10);
    // filet central
    ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x1,cy);ctx.lineTo(x2,cy);ctx.stroke();
    // flèche de flux
    const mx=(x1+x2)/2;
    ctx.fillStyle=a.col;
    ctx.beginPath();ctx.moveTo(mx+11,cy);ctx.lineTo(mx-1,cy-7);ctx.lineTo(mx-1,cy+7);ctx.closePath();ctx.fill();
  });

  // ── Roues motrices ──
  const dif=pos[pos.length-1];
  [-1,1].forEach((dir,idx)=>{
    const wy=cy+dir*105;
    // arbre vertical
    const g2=ctx.createLinearGradient(dif.x-5,wy,dif.x+5,wy);
    g2.addColorStop(0,'#888');g2.addColorStop(.5,'#ddd');g2.addColorStop(1,'#888');
    ctx.fillStyle=g2; ctx.fillRect(dif.x-5,Math.min(cy,wy),10,Math.abs(wy-cy));
    // flèche
    ctx.fillStyle=dif.col;
    ctx.beginPath();ctx.moveTo(dif.x,wy+dir*2);ctx.lineTo(dif.x-8,wy-dir*10);ctx.lineTo(dif.x+8,wy-dir*10);ctx.closePath();ctx.fill();
    // roue
    ctx.save();ctx.translate(dif.x,wy);
    const rg=ctx.createRadialGradient(-8,-8,4,0,0,26);
    rg.addColorStop(0,'#555');rg.addColorStop(.6,'#1a1a1a');rg.addColorStop(1,'#000');
    ctx.fillStyle=rg; ctx.beginPath();ctx.arc(0,0,26,0,Math.PI*2);ctx.fill();
    const rg2=ctx.createRadialGradient(-3,-3,2,0,0,16);
    rg2.addColorStop(0,'#e0ddd8');rg2.addColorStop(1,'#9a9890');
    ctx.fillStyle=rg2; ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1.5;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(14*Math.cos(a),14*Math.sin(a));ctx.stroke();}
    ctx.fillStyle='#444';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(idx===0?'G':'D',0,0);
    ctx.restore();
    ctx.fillStyle='#555';ctx.font='600 9px sans-serif';ctx.textAlign='center';ctx.textBaseline=dir<0?'bottom':'top';
    ctx.fillText('ROUE '+(idx===0?'GAUCHE':'DROITE'),dif.x,wy+dir*32);
  });

  // ── Boîtes ──
  pos.forEach(c=>{
    // ombre portée
    ctx.fillStyle='rgba(0,0,0,.1)';rr(ctx,c.x-c.w/2+4,cy-bH/2+5,c.w,bH,12);ctx.fill();
    // fond avec dégradé
    const bg=ctx.createLinearGradient(c.x-c.w/2,cy-bH/2,c.x+c.w/2,cy+bH/2);
    bg.addColorStop(0,c.bg);bg.addColorStop(1,'#fff');
    ctx.fillStyle=bg; ctx.strokeStyle=c.col; ctx.lineWidth=2.5;
    rr(ctx,c.x-c.w/2,cy-bH/2,c.w,bH,12);ctx.fill();ctx.stroke();
    // Bande couleur en haut de la boîte
    ctx.fillStyle=c.col;ctx.globalAlpha=.18;
    ctx.beginPath();ctx.moveTo(c.x-c.w/2+12,cy-bH/2);ctx.lineTo(c.x+c.w/2-12,cy-bH/2);
    ctx.quadraticCurveTo(c.x+c.w/2,cy-bH/2,c.x+c.w/2,cy-bH/2+12);
    ctx.lineTo(c.x+c.w/2,cy-bH/2+22);ctx.lineTo(c.x-c.w/2,cy-bH/2+22);
    ctx.lineTo(c.x-c.w/2,cy-bH/2+12);ctx.quadraticCurveTo(c.x-c.w/2,cy-bH/2,c.x-c.w/2+12,cy-bH/2);
    ctx.closePath();ctx.fill();ctx.globalAlpha=1;

    // Icône spécifique
    ctx.fillStyle=c.col;
    if(c.id==='mot'){
      // pistons stylisés
      [-22,0,22].forEach(ox=>{
        ctx.fillStyle=c.col;ctx.globalAlpha=.6;
        ctx.fillRect(c.x+ox-5,cy-28,10,22);ctx.globalAlpha=1;
        ctx.strokeStyle=c.col;ctx.lineWidth=2;
        ctx.strokeRect(c.x+ox-7,cy-32,14,8);
      });
      ctx.strokeStyle=c.col;ctx.lineWidth=3;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(c.x-30,cy-8);ctx.lineTo(c.x,cy-22);ctx.lineTo(c.x+30,cy-8);ctx.stroke();
    }
    if(c.id==='emb'){
      // 2 disques séparés/rapprochés
      [-10,4].forEach((oy,i)=>{
        ctx.fillStyle=c.col;ctx.globalAlpha=i===0?.9:.5;
        ctx.beginPath();ctx.ellipse(c.x,cy+oy,28,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      });
    }
    if(c.id==='bvt'){
      const gpos=[[-24,-10],[0,-10],[24,-10],[-24,8],[0,8]];
      gpos.forEach(([gx,gy],i)=>{
        ctx.fillStyle=c.col;ctx.beginPath();ctx.arc(c.x+gx,cy+gy,7,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(i===4?'R':i+1,c.x+gx,cy+gy);
      });
      ctx.strokeStyle=c.col;ctx.lineWidth=1.5;ctx.globalAlpha=.4;
      [[0,1],[1,2],[3,4],[0,3],[1,4]].forEach(([a,b])=>{
        ctx.beginPath();ctx.moveTo(c.x+gpos[a][0],cy+gpos[a][1]);ctx.lineTo(c.x+gpos[b][0],cy+gpos[b][1]);ctx.stroke();
      });
      ctx.globalAlpha=1;
    }
    if(c.id==='arb'){
      ctx.strokeStyle=c.col;ctx.lineWidth=5;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(c.x-32,cy-4);ctx.lineTo(c.x+32,cy-4);ctx.stroke();
      ctx.beginPath();ctx.moveTo(c.x-32,cy-4);ctx.lineTo(c.x-20,cy-14);ctx.lineTo(c.x-8,cy+6);ctx.lineTo(c.x+8,cy-14);ctx.lineTo(c.x+20,cy+6);ctx.lineTo(c.x+32,cy-4);ctx.stroke();
    }
    if(c.id==='dif'){
      ctx.fillStyle=c.col;ctx.globalAlpha=.2;ctx.beginPath();ctx.arc(c.x,cy-8,22,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      ctx.strokeStyle=c.col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(c.x,cy-8,22,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=c.col;ctx.lineWidth=1.5;
      for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(c.x+14*Math.cos(a),cy-8+14*Math.sin(a));ctx.lineTo(c.x+22*Math.cos(a),cy-8+22*Math.sin(a));ctx.stroke();}
    }
    // Labels
    ctx.fillStyle='#1a1a1c';ctx.font=`700 ${Math.min(11,c.w*.088)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    c.label.split('\n').forEach((ln,i,arr)=>ctx.fillText(ln,c.x,cy+26+i*13-((arr.length-1)*6)));
    ctx.fillStyle=c.col;ctx.font='500 9px sans-serif';ctx.textBaseline='top';
    c.sub.split('\n').forEach((ln,i)=>ctx.fillText(ln,c.x,cy+bH/2+4+i*11));
  });

  // ── Titre ──
  ctx.fillStyle='rgba(0,0,0,.06)';ctx.fillRect(0,0,W,52);
  ctx.fillStyle='#1a1a1c';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('Chaîne cinématique — du moteur aux roues motrices',cx,28);
  ctx.fillStyle='#636366';ctx.font='500 11px sans-serif';
  ctx.fillText('Moteur  →  Embrayage  →  Boîte de vitesses  →  Arbre de transmission  →  Différentiel  →  Roues',cx,46);
}

// ═══════════════════════════════════════════════════════
// EMBRAYAGE (3 états)
// ═══════════════════════════════════════════════════════
function drawClutch(cx,cy,state){
  const colors={debraye:'#d32f2f',patinage:'#e65100',embraye:'#2e7d32'};
  const col=colors[state];
  const labels={debraye:'EMBRAYAGE DÉBRAYÉ',patinage:'POINT DE PATINAGE',embraye:'EMBRAYAGE EMBRAYÉ'};
  const descs={
    debraye:'Pédale enfoncée à fond — transmission interrompue',
    patinage:'Pédale mi-course — glissement partiel — couple progressif',
    embraye:'Pédale relâchée — disques solidaires — couple total transmis'
  };

  // ── Fond technique ────────────────────────
  ctx.fillStyle='#f5f3ef';ctx.fillRect(0,0,W,H);
  // quadrillage technique léger
  ctx.strokeStyle='rgba(0,0,0,.04)';ctx.lineWidth=1;
  for(let gx=0;gx<W;gx+=24){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(let gy=0;gy<H;gy+=24){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}

  // ── Bandeau titre en haut ─────────────────
  ctx.fillStyle=col;ctx.globalAlpha=.1;ctx.fillRect(0,0,W,64);ctx.globalAlpha=1;
  ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,64);ctx.lineTo(W,64);ctx.stroke();
  ctx.fillStyle=col;ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(labels[state],cx,22);
  ctx.fillStyle='#555';ctx.font='13px sans-serif';
  ctx.fillText(descs[state],cx,46);

  // ── Paramètres géométriques ───────────────
  const pedalX=cx-310, pedalPivotY=cy+20;
  const diskR=70;
  const volantX=cx+20, diskX=cx+130, platX=cx+230;
  const axisY=cy;

  // Angle de la pédale selon état
  const pedAngle=state==='debraye'?0.9:state==='patinage'?0.45:0.12;
  // Décalage du disque selon état (débrayé = écarté)
  const diskGap=state==='debraye'?28:state==='patinage'?10:0;

  // ── SECTION GAUCHE : Pédale + câble ──────
  // Fond zone pédale
  ctx.fillStyle='rgba(0,0,0,.03)';rr(ctx,pedalX-55,pedalPivotY-130,110,180,12);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.08)';ctx.lineWidth=1;rr(ctx,pedalX-55,pedalPivotY-130,110,180,12);ctx.stroke();

  // Axe pivot (gris métal)
  const pivG=ctx.createRadialGradient(pedalX-2,pedalPivotY-2,1,pedalX,pedalPivotY,10);
  pivG.addColorStop(0,'#ccc');pivG.addColorStop(1,'#666');
  ctx.fillStyle=pivG;ctx.beginPath();ctx.arc(pedalX,pedalPivotY,10,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#444';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(pedalX,pedalPivotY,10,0,Math.PI*2);ctx.stroke();

  // Bras de pédale (tube métallique)
  const pedEndX=pedalX-Math.sin(pedAngle)*100;
  const pedEndY=pedalPivotY+Math.cos(pedAngle)*100;
  const pedG=ctx.createLinearGradient(pedalX,pedalPivotY,pedEndX,pedEndY);
  pedG.addColorStop(0,col);pedG.addColorStop(1,col+'99');
  ctx.strokeStyle=pedG;ctx.lineWidth=12;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(pedalX,pedalPivotY);ctx.lineTo(pedEndX,pedEndY);ctx.stroke();

  // Plateforme de pédale
  const perpX=Math.cos(pedAngle)*22, perpY=Math.sin(pedAngle)*22;
  ctx.fillStyle=col;ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(pedEndX-perpX-2,pedEndY-perpY);
  ctx.lineTo(pedEndX+perpX+2,pedEndY+perpY);
  ctx.lineTo(pedEndX+perpX,pedEndY+perpY+6);
  ctx.lineTo(pedEndX-perpX,pedEndY-perpY+6);
  ctx.closePath();ctx.fill();

  // Pied stylisé
  ctx.font='28px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(state==='embraye'?'🦶':'👟',pedEndX+(state==='debraye'?-8:4),pedEndY+(state==='debraye'?-16:-14));

  // Étiquette pédale
  ctx.fillStyle='#444';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText('PÉDALE',pedalX,pedalPivotY+100);
  ctx.fillStyle=col;ctx.font='bold 11px sans-serif';
  ctx.fillText(state==='debraye'?'ENFONCÉE':state==='patinage'?'MI-COURSE':'RELÂCHÉE',pedalX,pedalPivotY+114);

  // Câble de commande (ligne pointillée)
  const cableY=pedalPivotY-40;
  const cableStartX=pedalX+8;
  const fourchX=volantX-diskR-48;
  ctx.strokeStyle='#888';ctx.lineWidth=2.5;ctx.setLineDash([8,5]);
  ctx.beginPath();ctx.moveTo(cableStartX,cableY);ctx.lineTo(fourchX,cableY);ctx.stroke();
  ctx.setLineDash([]);
  // flèche sur câble
  const cableDir=state==='embraye'?1:-1;
  ctx.fillStyle='#888';ctx.beginPath();
  ctx.moveTo(fourchX-18,cableY);ctx.lineTo(fourchX-30,cableY-5);ctx.lineTo(fourchX-30,cableY+5);ctx.closePath();ctx.fill();
  ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.textAlign='center';
  ctx.fillText('câble / tringlerie',(cableStartX+fourchX)/2,cableY-13);

  // Fourchette
  ctx.strokeStyle='#636366';ctx.lineWidth=5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(fourchX,cableY);ctx.lineTo(fourchX,axisY+diskR*.4);ctx.stroke();
  ctx.beginPath();ctx.moveTo(fourchX-16,axisY+diskR*.3);ctx.lineTo(fourchX+16,axisY+diskR*.3);ctx.stroke();
  ctx.fillStyle='#888';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('fourchette',fourchX,cableY-2);

  // Arbre moteur entrant
  const shaftG=ctx.createLinearGradient(0,axisY-5,0,axisY+5);
  shaftG.addColorStop(0,'#ccc');shaftG.addColorStop(.4,'#eee');shaftG.addColorStop(1,'#999');
  ctx.fillStyle=shaftG;ctx.fillRect(pedalX+60,axisY-5,volantX-diskR-pedalX-60,10);
  ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1;ctx.strokeRect(pedalX+60,axisY-5,volantX-diskR-pedalX-60,10);
  ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('arbre moteur',(pedalX+60+volantX-diskR)/2,axisY-6);

  // ── SECTION CENTRALE : Mécanisme embrayage ──
  // Volant moteur (côté moteur)
  const volG=ctx.createRadialGradient(volantX-diskR*0.15,axisY-diskR*0.15,diskR*0.1,volantX-diskR*0.2,axisY-diskR*0.2,diskR*1.1);
  volG.addColorStop(0,'#888');volG.addColorStop(.5,'#555');volG.addColorStop(1,'#333');
  ctx.fillStyle=volG;ctx.beginPath();ctx.arc(volantX-diskR,axisY,diskR,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(volantX-diskR,axisY,diskR,0,Math.PI*2);ctx.stroke();
  // Rayons du volant
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(volantX-diskR+diskR*.2*Math.cos(a),axisY+diskR*.2*Math.sin(a));
    ctx.lineTo(volantX-diskR+diskR*.85*Math.cos(a),axisY+diskR*.85*Math.sin(a));ctx.stroke();
  }
  // Moyeu volant
  const hubG=ctx.createRadialGradient(volantX-diskR-3,axisY-3,2,volantX-diskR,axisY,18);
  hubG.addColorStop(0,'#bbb');hubG.addColorStop(1,'#555');
  ctx.fillStyle=hubG;ctx.beginPath();ctx.arc(volantX-diskR,axisY,18,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('VM',volantX-diskR,axisY);
  ctx.fillStyle='#ccc';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText('VOLANT MOTEUR',volantX-diskR,axisY+diskR+6);

  // Garnitures de friction (sur le volant, côté disque)
  ctx.fillStyle='rgba(80,60,40,.6)';
  ctx.beginPath();ctx.arc(volantX-diskR,axisY,diskR,-.3,0.3);ctx.arc(volantX-diskR,axisY,diskR*.72,.3,-.3,true);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.arc(volantX-diskR,axisY,diskR,-Math.PI+.3,-Math.PI-.3,true);ctx.arc(volantX-diskR,axisY,diskR*.72,-Math.PI-.3,-Math.PI+.3).closePath;ctx.fill();

  // Disque d'embrayage (avec décalage selon état)
  const dX=diskX+diskGap;
  const diskFill=state==='embraye'?'rgba(46,125,50,.15)':state==='patinage'?'rgba(230,81,0,.12)':'rgba(211,47,47,.08)';
  ctx.fillStyle=diskFill;ctx.strokeStyle=col;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(dX,axisY,diskR*.88,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Moyeu disque (splines)
  const hubD=ctx.createRadialGradient(dX-3,axisY-3,3,dX,axisY,diskR*.28);
  hubD.addColorStop(0,'#ccc');hubD.addColorStop(1,'#777');
  ctx.fillStyle=hubD;ctx.beginPath();ctx.arc(dX,axisY,diskR*.28,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(dX,axisY);ctx.lineTo(dX+diskR*.28*Math.cos(a),axisY+diskR*.28*Math.sin(a));ctx.stroke();}
  // Ressorts amortisseurs du disque
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+Math.PI/6;
    const r1=diskR*.34,r2=diskR*.72;
    ctx.fillStyle=col+'aa';
    ctx.beginPath();
    ctx.arc(dX+((r1+r2)/2)*Math.cos(a),axisY+((r1+r2)/2)*Math.sin(a),diskR*.07,0,Math.PI*2);
    ctx.fill();
  }
  // Garnitures friction du disque (segments)
  for(let i=0;i<3;i++){
    const a0=i*Math.PI*2/3, a1=a0+Math.PI*2/3-.15;
    ctx.fillStyle='rgba(80,60,40,.5)';
    ctx.beginPath();ctx.arc(dX,axisY,diskR*.86,a0+.08,a1);
    ctx.arc(dX,axisY,diskR*.72,a1,a0+.08,true);ctx.closePath();ctx.fill();
  }
  ctx.fillStyle=col;ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText('DISQUE D\'EMBRAYAGE',dX,axisY+diskR+6);

  // Plateau de pression
  const platFill=ctx.createLinearGradient(platX-22,0,platX+22,0);
  platFill.addColorStop(0,'#aaa');platFill.addColorStop(.4,'#ddd');platFill.addColorStop(1,'#888');
  ctx.fillStyle=platFill;
  ctx.beginPath();ctx.arc(platX,axisY,diskR*.9,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#777';ctx.lineWidth=2;ctx.beginPath();ctx.arc(platX,axisY,diskR*.9,0,Math.PI*2);ctx.stroke();
  // Rainures du plateau
  ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1.5;
  [diskR*.25,diskR*.5,diskR*.72].forEach(r=>{ctx.beginPath();ctx.arc(platX,axisY,r,0,Math.PI*2);ctx.stroke();});
  // Picots ressorts (couvercle)
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;const px=platX+diskR*.62*Math.cos(a),py=axisY+diskR*.62*Math.sin(a);
    ctx.fillStyle='#999';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#666';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.stroke();
  }
  ctx.fillStyle='#555';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText('PLATEAU DE PRESSION',platX,axisY+diskR+6);

  // ── Écart inter-disques selon état ────────
  if(diskGap>0){
    const gapMid=(volantX+dX-diskR*.88)/2-diskR*.05;
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(volantX,axisY-diskR*.5);ctx.lineTo(dX-diskR*.88,axisY-diskR*.5);ctx.stroke();
    ctx.setLineDash([]);
    // flèches d'écartement
    [volantX+4,dX-diskR*.88-4].forEach((x,i)=>{
      const dir=i===0?1:-1;
      ctx.fillStyle=col;ctx.beginPath();
      ctx.moveTo(x,axisY-diskR*.5);
      ctx.lineTo(x-dir*12,axisY-diskR*.5-5);
      ctx.lineTo(x-dir*12,axisY-diskR*.5+5);
      ctx.closePath();ctx.fill();
    });
    const gapPx=Math.round(dX-diskR*.88-volantX);
    ctx.fillStyle=col;ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText(state==='debraye'?'⟵  ÉCART  ⟶':'⟵ glissement ⟶',gapMid,axisY-diskR*.5-4);
  }

  // Arbre de boîte sortant
  const shaftOut=platX+diskR*.9;
  ctx.fillStyle=shaftG;ctx.fillRect(shaftOut,axisY-5,80,10);
  ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1;ctx.strokeRect(shaftOut,axisY-5,80,10);
  ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillText('→ boîte de vitesses',shaftOut+4,axisY-7);

  // Indicateur de flux de couple (→ avec animation statique)
  const fluxItems=[
    {x:pedalX+90,label:'MOTEUR',active:true},
    {x:volantX-diskR*1.4,label:'',active:true},
    {x:(volantX+dX)/2,label:state==='embraye'?'✅ COUPLE':state==='patinage'?'⚡ PARTIEL':'⛔ INTERROMPU',active:state!=='debraye'},
    {x:platX+diskR+20,label:'BOÎTE',active:state!=='debraye'},
  ];
  // Ligne de flux en bas
  const fluxY=cy+diskR+55;
  ctx.strokeStyle=state==='embraye'?'#2e7d32':state==='patinage'?'#e65100':'rgba(100,100,100,.4)';
  ctx.lineWidth=state==='embraye'?4:3;
  if(state!=='debraye') ctx.setLineDash([]);
  else ctx.setLineDash([6,6]);
  ctx.beginPath();ctx.moveTo(pedalX+80,fluxY);ctx.lineTo(shaftOut+70,fluxY);ctx.stroke();
  ctx.setLineDash([]);
  if(state!=='debraye'){
    // flèches de flux
    [pedalX+200,pedalX+320,pedalX+440].forEach(fx=>{
      if(fx>pedalX+80&&fx<shaftOut+70){
        ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(fx+8,fluxY);ctx.lineTo(fx-2,fluxY-5);ctx.lineTo(fx-2,fluxY+5);ctx.closePath();ctx.fill();
      }
    });
  }
  // Capsule état
  const stateY=cy+diskR+85;
  const stateW=300,stateH=34;
  ctx.fillStyle=col;ctx.globalAlpha=.1;rr(ctx,cx-stateW/2,stateY-stateH/2,stateW,stateH,10);ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle=col;ctx.lineWidth=2;rr(ctx,cx-stateW/2,stateY-stateH/2,stateW,stateH,10);ctx.stroke();
  const stateTexts={
    debraye:'⛔  TRANSMISSION INTERROMPUE — Pédale enfoncée',
    patinage:'⚡  PATINAGE — Transmission partielle en cours',
    embraye:'✅  EMBRAYÉ — Couple intégralement transmis'
  };
  ctx.fillStyle=col;ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(stateTexts[state],cx,stateY);
}

// ═══════════════════════════════════════════════════════
// VOITURE SCHÉMA (chaîne cinématique vue latérale)
// ═══════════════════════════════════════════════════════
function drawCarSchema(cx,cy){
  ctx.fillStyle='#f8f6f2';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(0,0,0,.03)';ctx.lineWidth=1;
  for(let gx=0;gx<W;gx+=30){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(let gy=0;gy<H;gy+=30){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}

  const scale=Math.min(W/680,H/340)*.88;
  ctx.save();ctx.translate(cx,cy+10);ctx.scale(scale,scale);

  // Sol
  ctx.fillStyle='#c8c0b0';ctx.fillRect(-300,92,600,12);

  // ── Carrosserie (hatchback 3 portes, avant à gauche) ──
  const carG=ctx.createLinearGradient(-240,-65,240,82);
  carG.addColorStop(0,'#b8d0e8');carG.addColorStop(.45,'#cce0f4');carG.addColorStop(1,'#7aaec8');
  ctx.fillStyle=carG;ctx.strokeStyle='#4a7ea0';ctx.lineWidth=2.5;
  ctx.beginPath();
  // Profil : avant à GAUCHE (capot plat), arrière à DROITE (hayon incliné)
  ctx.moveTo(-230,82);         // bas avant-gauche
  ctx.lineTo(-250,34);         // pare-choc avant
  ctx.lineTo(-230,-8);         // capot avant
  ctx.lineTo(-160,-52);        // base pare-brise avant
  ctx.lineTo(-60,-60);         // toit avant
  ctx.lineTo(80,-60);          // toit milieu
  ctx.lineTo(175,-12);         // hayon arrière (incliné)
  ctx.lineTo(225,34);          // pare-choc arrière
  ctx.lineTo(225,82);          // bas arrière
  ctx.closePath();
  ctx.fill();ctx.stroke();

  // Vitres
  ctx.fillStyle='rgba(190,225,255,.65)';ctx.strokeStyle='#4a7ea0';ctx.lineWidth=1.5;
  // Pare-brise
  ctx.beginPath();ctx.moveTo(-155,-48);ctx.lineTo(-62,-57);ctx.lineTo(-62,-6);ctx.lineTo(-148,-8);ctx.closePath();ctx.fill();ctx.stroke();
  // Vitre latérale
  ctx.beginPath();ctx.moveTo(-55,-57);ctx.lineTo(75,-57);ctx.lineTo(75,-6);ctx.lineTo(-55,-6);ctx.closePath();ctx.fill();ctx.stroke();
  // Hayon vitre
  ctx.beginPath();ctx.moveTo(82,-57);ctx.lineTo(168,-15);ctx.lineTo(168,-6);ctx.lineTo(82,-6);ctx.closePath();ctx.fill();ctx.stroke();

  // Phares avant (jaune) 
  ctx.fillStyle='#ffee88';ctx.strokeStyle='#cc9900';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(-238,8,8,12,0.3,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Phares arrière (rouge)
  ctx.fillStyle='#dd3333';ctx.strokeStyle='#990000';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(222,8,8,12,-0.3,0,Math.PI*2);ctx.fill();ctx.stroke();

  // Labels AVANT / ARRIÈRE
  ctx.fillStyle='#e05c00';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('AVANT',- 240,- 68);
  ctx.fillStyle='#0a7aff';
  ctx.fillText('ARRIÈRE',220,- 68);

  // Roues
  const drawWheel=(wx,wy)=>{
    ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(wx,wy,40,0,Math.PI*2);ctx.fill();
    const wg=ctx.createRadialGradient(wx-8,wy-8,5,wx,wy,30);
    wg.addColorStop(0,'#555');wg.addColorStop(1,'#111');
    ctx.fillStyle=wg;ctx.beginPath();ctx.arc(wx,wy,30,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#999';ctx.beginPath();ctx.arc(wx,wy,12,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#666';ctx.lineWidth=2;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx+24*Math.cos(a),wy+24*Math.sin(a));ctx.stroke();}
  };
  drawWheel(-150,82);drawWheel(160,82);

  // Composants numérotés
  const comps=[
    {n:'1',x:-155,y:22,w:72,h:50,col:'#e05c00',bg:'#fff4ee',lbl:'MOTEUR'},
    {n:'2',x:-68, y:30,w:42,h:34,col:'#0a7aff',bg:'#eef5ff',lbl:'EMBRG'},
    {n:'3',x:10,  y:22,w:72,h:50,col:'#30b94a',bg:'#eefff2',lbl:'BOÎTE'},
    {n:'4',x:96,  y:40,w:55,h:16,col:'#f08000',bg:'#fff8ee',lbl:''},
    {n:'5',x:162, y:64,w:0, h:0, col:'#9b59b6',bg:'',       lbl:''},
  ];
  comps.forEach((c,i)=>{
    if(c.w>0){
      ctx.fillStyle=c.bg;ctx.strokeStyle=c.col;ctx.lineWidth=2;
      rr(ctx,c.x-c.w/2,c.y-c.h/2,c.w,c.h,7);ctx.fill();ctx.stroke();
      if(c.lbl){ctx.fillStyle=c.col;ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.lbl,c.x,c.y);}
    }
    // Numéro dans un cercle
    const nx=i===3?c.x:i===4?162:c.x, ny=i===3?c.y-14:i===4?58:c.y-c.h/2-12;
    ctx.fillStyle=c.col;ctx.beginPath();ctx.arc(nx,ny,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(c.n,nx,ny);
  });

  // Arbre de transmission (ligne 4 → roue 5)
  ctx.strokeStyle='#f08000';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(46,40);ctx.lineTo(135,40);ctx.stroke();
  ctx.fillStyle='#f08000';ctx.beginPath();ctx.moveTo(128,40);ctx.lineTo(116,34);ctx.lineTo(116,46);ctx.closePath();ctx.fill();

  // Légende en bas
  const legend=[
    {n:'1',col:'#e05c00',lbl:'moteur'},
    {n:'2',col:'#0a7aff',lbl:"disques d'embrayage"},
    {n:'3',col:'#30b94a',lbl:'boîte de vitesses'},
    {n:'4',col:'#f08000',lbl:'arbre de transmission'},
    {n:'5',col:'#9b59b6',lbl:'roues'},
  ];
  ctx.font='11px sans-serif';
  let lx=-260;
  legend.forEach((l,i)=>{
    const ix=lx+i*105;
    ctx.fillStyle=l.col;ctx.beginPath();ctx.arc(ix,125,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(l.n,ix,125);
    ctx.fillStyle='#333';ctx.font='9px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(l.lbl,ix+14,125);
  });

  // Titre
  ctx.fillStyle='#1a1a1c';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('Embrayage — chaîne cinématique',0,-76);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════
// EMBRAYAGE 3 ÉTATS SUR UN SEUL VISUEL
// ═══════════════════════════════════════════════════════
function drawClutch3(cx,cy){
  ctx.fillStyle='#f5f3ef';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(0,0,0,.04)';ctx.lineWidth=1;
  for(let gx=0;gx<W;gx+=24){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(let gy=0;gy<H;gy+=24){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}

  const states=['debraye','patinage','embraye'];
  const cols={debraye:'#d32f2f',patinage:'#e65100',embraye:'#2e7d32'};
  const labels={debraye:'Position débrayée',patinage:'position embrayée\nPoint mort',embraye:'Position embrayée\n1ère enclenchée'};
  const pedLabels={debraye:'Pied gauche à fond\nsur le pédale.',patinage:'Pied gauche relevé.',embraye:'Pied gauche relevé.'};
  const wheelLabels={debraye:'Roues ne\ntourne pas',patinage:'Roues ne\ntourne pas',embraye:'Roues\ntournent'};
  const nRows=3;
  const rowH=H/nRows;

  states.forEach((state,i)=>{
    const col=cols[state];
    const ry=i*rowH;
    const rcx=cx, rcy=ry+rowH/2;

    // Fond coloré léger
    ctx.fillStyle=col;ctx.globalAlpha=.06;ctx.fillRect(0,ry,W,rowH);ctx.globalAlpha=1;
    // Ligne séparatrice
    if(i>0){ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(0,ry);ctx.lineTo(W,ry);ctx.stroke();ctx.setLineDash([]);}

    const scale=Math.min(W/700,rowH/130)*.9;
    ctx.save();ctx.translate(rcx,rcy);ctx.scale(scale,scale);

    // Dimensions composants
    const bW=52,bH=46,gap=18;
    const motX=-260,embX=-180,bvtX=-90,diskX=-120,roueX=60;
    const diskGap=state==='debraye'?22:state==='patinage'?8:0;

    // Moteur (carré rouge)
    ctx.fillStyle='rgba(224,92,0,.15)';ctx.strokeStyle='#e05c00';ctx.lineWidth=2;
    rr(ctx,motX-bW/2,-bH/2,bW,bH,6);ctx.fill();ctx.stroke();
    ctx.fillStyle='#e05c00';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('MOT',motX,0);

    // Arbre moteur
    const shG=ctx.createLinearGradient(0,-4,0,4);shG.addColorStop(0,'#ccc');shG.addColorStop(.5,'#eee');shG.addColorStop(1,'#999');
    ctx.fillStyle=shG;ctx.fillRect(motX+bW/2,- 4,embX-bW/2-motX-bW/2+10,8);

    // Disque gauche (moteur)
    ctx.fillStyle='rgba(80,80,80,.3)';ctx.strokeStyle='#555';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(embX-8,-0,20,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;
    for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.moveTo(embX-8,0);ctx.lineTo(embX-8+14*Math.cos(a),14*Math.sin(a));ctx.stroke();}

    // Disque droit (boîte) avec décalage
    ctx.fillStyle=col+'33';ctx.strokeStyle=col;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(embX+8+diskGap,0,20,0,Math.PI*2);ctx.fill();ctx.stroke();
    // ressorts amortisseurs
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;ctx.fillStyle=col+'aa';ctx.beginPath();ctx.arc(embX+8+diskGap+14*Math.cos(a),14*Math.sin(a),4,0,Math.PI*2);ctx.fill();}

    // Flèche entre disques si écart
    if(diskGap>0){
      ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.setLineDash([3,2]);
      ctx.beginPath();ctx.moveTo(embX,- 28);ctx.lineTo(embX+diskGap,- 28);ctx.stroke();
      ctx.setLineDash([]);
    }

    // Boîte de vitesses (vert)
    ctx.fillStyle='rgba(48,185,74,.15)';ctx.strokeStyle='#30b94a';ctx.lineWidth=2;
    rr(ctx,bvtX-bW/2,-bH/2,bW,bH,6);ctx.fill();ctx.stroke();
    ctx.fillStyle='#30b94a';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('BVT',bvtX,0);

    // Arbre sortant
    ctx.fillStyle=shG;ctx.fillRect(bvtX+bW/2,-4,roueX-bvtX-bW/2,8);

    // Roue (ellipse bleue)
    ctx.fillStyle='rgba(0,80,200,.1)';ctx.strokeStyle='#336';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(roueX,0,28,44,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#336';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(roueX,0,14,22,0,0,Math.PI*2);ctx.stroke();
    // Rotation si embrayé
    if(state==='embraye'){
      ctx.strokeStyle='#0a7aff';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(roueX,- 44);ctx.moveTo(roueX,44);
      for(let k=0;k<3;k++){const a=k*Math.PI/3*2-Math.PI/2;ctx.moveTo(roueX,0);ctx.lineTo(roueX+24*Math.cos(a),44*Math.sin(a)/1.57);}
      ctx.stroke();
    }

    // Label état (côté gauche)
    ctx.fillStyle=col;ctx.font='bold 13px sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
    labels[state].split('\n').forEach((ln,k,arr)=>ctx.fillText(ln,-310,(k-(arr.length-1)/2)*16));

    // Label roue (côté droit)
    ctx.fillStyle='#333';ctx.font='11px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
    wheelLabels[state].split('\n').forEach((ln,k,arr)=>ctx.fillText(ln,roueX+40,(k-(arr.length-1)/2)*14));

    // Pied (simplifié)
    ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(state==='debraye'?'👟':'🦶',270,-5);
    ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.textBaseline='top';
    pedLabels[state].split('\n').forEach((ln,k)=>ctx.fillText(ln,270,18+k*12));

    ctx.restore();
  });

  // Titre global
  ctx.fillStyle='rgba(0,0,0,.06)';ctx.fillRect(0,0,W,38);
  ctx.fillStyle='#1a1a1c';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('Fonctionnement de l\'embrayage — 3 positions',cx,20);
}

// ═══════════════════════════════════════════════════════
// LOAD SCENE
// ═══════════════════════════════════════════════════════
function setTitle(t){document.getElementById('hudTitle').textContent=t;}
function loadScene(name){
  saveState();drawings=[];elements=[];selEl=null;updateSelHud();
  const cx=W/2,cy=H/2;

  if(name==='blank'){setTitle('Vierge');redraw();return;}

  const hw=2*56/2+14; // intersection half-width for 2-lane road

  if(name==='inter4'){
    const hw2=hw;
    drawings.push({t:'road',x1:0,y1:cy,x2:W,y2:cy,lanes:2});
    drawings.push({t:'road',x1:cx,y1:0,x2:cx,y2:H,lanes:2});
    drawings.push({t:'scene_inter',x:cx,y:cy,hw:hw2});
    setTitle('Carrefour 4 voies');redraw();return;
  }
  if(name==='inter3_T_bas'){
    drawings.push({t:'road',x1:0,y1:cy,x2:W,y2:cy,lanes:2});
    drawings.push({t:'road',x1:cx,y1:H,x2:cx,y2:cy,lanes:2});
    drawings.push({t:'scene_inter_T',x:cx,y:cy,hw});
    setTitle('Carrefour T – route du bas');redraw();return;
  }
  if(name==='inter4_bas'){
    drawings.push({t:'road',x1:0,y1:cy,x2:W,y2:cy,lanes:2});
    drawings.push({t:'road',x1:cx,y1:0,x2:cx,y2:H,lanes:2});
    drawings.push({t:'scene_inter',x:cx,y:cy,hw,hilite:true,h2:H-(cy+hw)});
    setTitle('Carrefour 4 voies – axe bas');redraw();return;
  }
  if(name==='inter_prio_droite'){
    drawings.push({t:'road',x1:0,y1:cy,x2:W,y2:cy,lanes:2});
    drawings.push({t:'road',x1:cx,y1:0,x2:cx,y2:H,lanes:2});
    drawings.push({t:'scene_inter',x:cx,y:cy,hw});
    elements.push({icon:'🚗',label:'A',x:cx+260,y:cy-22,sz:48,rot:Math.PI});
    elements.push({icon:'🚗',label:'B',x:cx-22, y:cy-260,sz:48,rot:Math.PI*.5});
    setTitle('Priorité à droite');redraw();return;
  }
  if(name==='gira1'){
    const R=Math.min(W,H)*.13,lw=Math.min(W,H)*.09;
    [0,Math.PI/2,Math.PI,Math.PI*3/2].forEach(a=>addApproach(cx,cy,R+lw,1,a,Math.min(W,H)*.35));
    drawings.push({t:'scene_gira',cx,cy,rInner:R,laneW:lw,laneCount:1});
    setTitle('Giratoire 1 voie');redraw();return;
  }
  if(name==='gira2'){
    const R=Math.min(W,H)*.12,lw=Math.min(W,H)*.075;
    [0,Math.PI/2,Math.PI,Math.PI*3/2].forEach(a=>addApproach(cx,cy,R+lw*2,2,a,Math.min(W,H)*.35));
    drawings.push({t:'scene_gira',cx,cy,rInner:R,laneW:lw,laneCount:2});
    setTitle('Giratoire 2 voies');redraw();return;
  }
  if(name==='gira3'){
    const R=Math.min(W,H)*.10,lw=Math.min(W,H)*.062;
    [0,Math.PI/2,Math.PI,Math.PI*3/2].forEach(a=>addApproach(cx,cy,R+lw*3,3,a,Math.min(W,H)*.35));
    drawings.push({t:'scene_gira',cx,cy,rInner:R,laneW:lw,laneCount:3});
    setTitle('Giratoire 3 voies');redraw();return;
  }
  if(name==='park_bataille'){
    const pw=68,ph=128,gp=7,cols=Math.floor((W-80)/(pw+gp));
    drawings.push({t:'road',x1:0,y1:H-80,x2:W,y2:H-80,lanes:1});
    drawings.push({t:'road',x1:0,y1:80,x2:W,y2:80,lanes:1});
    for(let c=0;c<cols;c++){const px=40+c*(pw+gp);drawings.push({t:'rect',x:px,y:100,w:pw,h:ph,color:'rgba(0,112,232,.5)',fill:'rgba(0,112,232,.07)',sz:2});drawings.push({t:'rect',x:px,y:H-100-ph,w:pw,h:ph,color:'rgba(0,112,232,.5)',fill:'rgba(0,112,232,.07)',sz:2});}
    for(let c=0;c<Math.min(5,cols);c+=2)elements.push({icon:'🚗',label:'',x:40+c*(pw+gp)+pw/2,y:100+ph/2,sz:38,rot:Math.PI*.5});
    setTitle('Stationnement en bataille');redraw();return;
  }
  if(name==='park_creneau'){
    const pw=88,ph=42,gp=10,cols=Math.floor((W-80)/(pw+gp));
    drawings.push({t:'road',x1:0,y1:cy,x2:W,y2:cy,lanes:2});
    for(let c=0;c<cols;c++){const px=40+c*(pw+gp);drawings.push({t:'rect',x:px,y:cy-58-ph,w:pw,h:ph,color:'rgba(0,112,232,.5)',fill:'rgba(0,112,232,.07)',sz:2});drawings.push({t:'rect',x:px,y:cy+58,w:pw,h:ph,color:'rgba(0,112,232,.5)',fill:'rgba(0,112,232,.07)',sz:2});}
    for(let c=0;c<Math.min(6,cols);c+=2)elements.push({icon:'🚗',label:'',x:40+c*(pw+gp)+pw/2,y:cy-58-ph/2,sz:32,rot:0});
    setTitle('Stationnement en créneau');redraw();return;
  }
  if(name==='park_epi'){
    drawings.push({t:'road',x1:0,y1:H-80,x2:W,y2:H-80,lanes:1});
    drawings.push({t:'rect',x:0,y:H-80-130,w:W,h:130,color:'rgba(0,112,232,.06)',fill:'rgba(0,112,232,.06)',sz:0});
    const count=Math.floor((W-60)/58);
    for(let i=0;i<=count;i++){const px=40+i*58;drawings.push({t:'pen',path:[{x:px,y:H-80-115*Math.cos(Math.PI/4)},{x:px+115*Math.sin(Math.PI/4),y:H-80}],color:'rgba(0,112,232,.55)',sz:2});}
    for(let c=0;c<Math.min(5,count);c+=2)elements.push({icon:'🚗',label:'',x:50+c*58+22,y:H-80-58,sz:36,rot:Math.PI/4});
    setTitle('Stationnement en épi');redraw();return;
  }
  if(name==='meca_chaine'){drawings.push({t:'scene_chain',cx,cy});setTitle('Chaîne cinématique');redraw();return;}
  if(name==='meca_car_schema'){drawings.push({t:'scene_car_schema',cx,cy});setTitle('Chaîne cinématique – vue voiture');redraw();return;}
  if(name==='emb_debraye') {drawings.push({t:'scene_clutch',cx,cy,state:'debraye'});  setTitle('Embrayage débrayé');    redraw();return;}
  if(name==='emb_patinage'){drawings.push({t:'scene_clutch',cx,cy,state:'patinage'}); setTitle('Point de patinage');    redraw();return;}
  if(name==='emb_embraye') {drawings.push({t:'scene_clutch',cx,cy,state:'embraye'});  setTitle('Embrayage embrayé');    redraw();return;}
  if(name==='emb_3etats')  {drawings.push({t:'scene_clutch3',cx,cy});                 setTitle('Embrayage – 3 états');  redraw();return;}
  if(name==='sens_unique'){
    drawings.push({t:'road',x1:0,y1:cy,x2:W,y2:cy,lanes:2});
    // Panneau sens unique côté gauche
    elements.push({special:'sign_sens_unique',label:'',x:80,y:cy-90,sz:56,rot:0});
    // Flèche sens de circulation
    drawings.push({t:'arrow',x1:100,y1:cy-26,x2:W-80,y2:cy-26,color:'#fff',sz:3,dash:false});
    drawings.push({t:'arrow',x1:100,y1:cy+26,x2:W-80,y2:cy+26,color:'#fff',sz:3,dash:false});
    setTitle('Sens unique');redraw();return;
  }
  if(name==='voie_insertion'){
    // 2×2 voies + voie d'insertion (depuis la droite, en bas)
    const lw=54, y1=cy-lw*1.5, y2=cy-lw*.5, y3=cy+lw*.5, y4=cy+lw*1.5;
    drawings.push({t:'rect',x:0,y:0,w:W,h:y1-8,color:'rgba(120,170,80,.3)',fill:'rgba(120,170,80,.3)',sz:0});
    drawings.push({t:'rect',x:0,y:y4+8,w:W,h:H-y4-8,color:'rgba(120,170,80,.3)',fill:'rgba(120,170,80,.3)',sz:0});
    drawings.push({t:'road',x1:0,y1:y1,x2:W,y2:y1,lanes:1});
    drawings.push({t:'road',x1:0,y1:y2,x2:W,y2:y2,lanes:1});
    drawings.push({t:'road',x1:0,y1:y3,x2:W,y2:y3,lanes:1});
    drawings.push({t:'road',x1:0,y1:y4,x2:W,y2:y4,lanes:1});
    // Voie d'insertion depuis le bas-droit vers la voie y4
    drawings.push({t:'roadcurve',x1:W*.5,y1:H,x2:W,y2:y4,lanes:1});
    // Flèches sens circulation
    drawings.push({t:'arrow',x1:80,y1:y1+lw*.5,x2:W-80,y2:y1+lw*.5,color:'rgba(255,255,255,.6)',sz:2,dash:false});
    drawings.push({t:'arrow',x1:80,y1:y3+lw*.5,x2:W-80,y2:y3+lw*.5,color:'rgba(255,255,255,.6)',sz:2,dash:false});
    drawings.push({t:'text',x:W*.35,y:H-40,text:'Voie d\'insertion',color:'#1a1a1c',sz:16});
    setTitle('2×2 voies — voie d\'insertion');redraw();return;
  }
  if(name==='voie_deceleration'){
    // 2×2 voies + voie de décélération (quitte par la droite, en haut)
    const lw=54, y1=cy-lw*1.5, y2=cy-lw*.5, y3=cy+lw*.5, y4=cy+lw*1.5;
    drawings.push({t:'rect',x:0,y:0,w:W,h:y1-8,color:'rgba(120,170,80,.3)',fill:'rgba(120,170,80,.3)',sz:0});
    drawings.push({t:'rect',x:0,y:y4+8,w:W,h:H-y4-8,color:'rgba(120,170,80,.3)',fill:'rgba(120,170,80,.3)',sz:0});
    drawings.push({t:'road',x1:0,y1:y1,x2:W,y2:y1,lanes:1});
    drawings.push({t:'road',x1:0,y1:y2,x2:W,y2:y2,lanes:1});
    drawings.push({t:'road',x1:0,y1:y3,x2:W,y2:y3,lanes:1});
    drawings.push({t:'road',x1:0,y1:y4,x2:W,y2:y4,lanes:1});
    // Voie de décélération depuis y1 vers le bas-droit
    drawings.push({t:'roadcurve',x1:0,y1:y1,x2:W*.5,y2:0,lanes:1});
    // Flèches sens circulation
    drawings.push({t:'arrow',x1:80,y1:y1+lw*.5,x2:W-80,y2:y1+lw*.5,color:'rgba(255,255,255,.6)',sz:2,dash:false});
    drawings.push({t:'arrow',x1:80,y1:y3+lw*.5,x2:W-80,y2:y3+lw*.5,color:'rgba(255,255,255,.6)',sz:2,dash:false});
    drawings.push({t:'text',x:W*.65,y:30,text:'Voie de décélération',color:'#1a1a1c',sz:16});
    setTitle('2×2 voies — voie de décélération');redraw();return;
  }
  if(name==='meca_vue'){
    const vw=W*.48,vh=H*.62,vx=cx-vw/2,vy=cy-vh/2;
    drawings.push({t:'rect',x:vx,y:vy,w:vw,h:vh,color:'#636366',fill:'rgba(100,100,110,.08)',sz:3});
    [{x:vx-6,y:vy+28},{x:vx+vw-6,y:vy+28},{x:vx-6,y:vy+vh-28},{x:vx+vw-6,y:vy+vh-28}].forEach(p=>drawings.push({t:'rect',x:p.x-22,y:p.y-38,w:26,h:76,color:'#1c1c1e',fill:'#2c2c2e',sz:4}));
    elements.push({special:'meca_moteur', label:'Moteur',   x:cx,      y:vy+100,    sz:76,rot:0});
    elements.push({special:'meca_boite',  label:'Boîte',    x:cx,      y:vy+230,    sz:68,rot:0});
    [{label:'Frein AV G',x:vx+36,y:vy+48},{label:'Frein AV D',x:vx+vw-36,y:vy+48},{label:'Frein AR G',x:vx+36,y:vy+vh-48},{label:'Frein AR D',x:vx+vw-36,y:vy+vh-48}].forEach(p=>elements.push({special:'meca_frein',label:p.label,x:p.x,y:p.y,sz:50,rot:0}));
    elements.push({special:'meca_batterie',label:'Batterie',x:vx-90,y:cy-50,sz:58,rot:0});
    setTitle('Vue mécanique dessus');redraw();return;
  }
  if(name==='urban'){
    drawings.push({t:'rect',x:0,y:cy-88,w:W,h:22,color:'rgba(180,170,155,.8)',fill:'rgba(180,170,155,.8)',sz:0});
    drawings.push({t:'rect',x:0,y:cy+66,w:W,h:22,color:'rgba(180,170,155,.8)',fill:'rgba(180,170,155,.8)',sz:0});
    drawings.push({t:'road',x1:0,y1:cy,x2:W,y2:cy,lanes:2});
    [{x:20,w:110,h:100},{x:160,w:90,h:115},{x:W-150,w:115,h:95},{x:W-300,w:90,h:88}].forEach(b=>drawings.push({t:'rect',x:b.x,y:cy-88-b.h,w:b.w,h:b.h,color:'#aaa',fill:'rgba(165,165,175,.4)',sz:2}));
    setTitle('Zone urbaine');redraw();return;
  }
  if(name==='highway'){
    drawings.push({t:'rect',x:0,y:0,w:W,h:cy-62,color:'rgba(100,160,70,.25)',fill:'rgba(100,160,70,.25)',sz:0});
    drawings.push({t:'rect',x:0,y:cy+62,w:W,h:H-cy-62,color:'rgba(100,160,70,.25)',fill:'rgba(100,160,70,.25)',sz:0});
    drawings.push({t:'road',x1:0,y1:cy-30,x2:W,y2:cy-30,lanes:1});
    drawings.push({t:'road',x1:0,y1:cy+30,x2:W,y2:cy+30,lanes:1});
    drawings.push({t:'arrow',x1:80,y1:cy-30,x2:W-80,y2:cy-30,color:'#30b94a',sz:3,dash:false});
    drawings.push({t:'arrow',x1:W-80,y1:cy+30,x2:80,y2:cy+30,color:'#30b94a',sz:3,dash:false});
    setTitle('Route nationale');redraw();return;
  }
}

// ═══════════════════════════════════════════════════════
// MISC
// ═══════════════════════════════════════════════════════
function clearAll(){if(confirm('Effacer tout ?')){saveState();drawings=[];elements=[];selEl=null;updateSelHud();redraw();}}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.opacity=1;clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity=0,2400);}

// ═══════════════════════════════════════════════════════
// EXPORT – canvas partagé
// ═══════════════════════════════════════════════════════
function buildExportCanvas(){
  // Render clean canvas (no selection handles)
  const prev=selEl;selEl=null;updateSelHud();redraw();
  const pad=30,headerH=44,footerH=22;
  const oc=document.createElement('canvas');
  oc.width=W+pad*2; oc.height=H+pad*2+headerH+footerH;
  const oc2=oc.getContext('2d');
  // White background
  oc2.fillStyle='#ffffff';oc2.fillRect(0,0,oc.width,oc.height);
  // Header
  oc2.fillStyle='#1c1c1e';oc2.fillRect(0,0,oc.width,headerH);
  oc2.fillStyle='#fff';oc2.font='bold 15px -apple-system,sans-serif';oc2.textBaseline='middle';oc2.textAlign='center';
  oc2.fillText('SRRR — '+document.getElementById('hudTitle').textContent,oc.width/2,headerH/2);
  // Schema
  oc2.drawImage(canvas,pad,headerH+pad/2);
  // Border
  oc2.strokeStyle='rgba(0,0,0,.1)';oc2.lineWidth=1.5;oc2.strokeRect(pad,headerH+pad/2,W,H);
  // Footer
  oc2.fillStyle='#78787e';oc2.font='10px -apple-system,sans-serif';oc2.textAlign='right';oc2.textBaseline='bottom';
  oc2.fillText('SRRR – Schémas Routiers Pédagogiques  •  '+new Date().toLocaleDateString('fr-FR'),oc.width-pad,oc.height-4);
  selEl=prev;updateSelHud();redraw();
  return oc;
}

// ── Utilitaire téléchargement ─────────────────────────
function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
}

// ── PNG ──────────────────────────────────────────────
function exportPNG() {
  try {
    const oc = buildExportCanvas();
    oc.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      triggerDownload(url, 'schema_SRRR.png');
      toast('✓ PNG téléchargé');
    }, 'image/png');
  } catch(e) { toast('❌ Erreur PNG : ' + e.message); }
}

// ── PDF via impression navigateur (100% compatible) ──
// Ouvre une page HTML optimisée pour impression PDF
function exportPDF() {
  try {
    const oc = buildExportCanvas();
    const title = document.getElementById('hudTitle').textContent;
    // On utilise JPEG pour réduire la taille
    const imgData = oc.toDataURL('image/jpeg', 0.92);
    const date = new Date().toLocaleDateString('fr-FR');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>SRRR – ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 landscape; margin: 10mm; }
    body { background: #fff; font-family: Arial, sans-serif; }
    .page {
      width: 277mm; height: 190mm;
      display: flex; flex-direction: column;
      padding: 0;
    }
    .header {
      background: #1c1c1e; color: #fff;
      padding: 6px 12px; font-size: 12pt; font-weight: bold;
      flex-shrink: 0;
    }
    .img-wrap {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 4mm; overflow: hidden;
    }
    img {
      max-width: 100%; max-height: 100%;
      object-fit: contain; display: block;
    }
    .footer {
      font-size: 7pt; color: #888; text-align: right;
      padding: 3px 12px; flex-shrink: 0;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">SRRR — ${title}</div>
    <div class="img-wrap"><img src="${imgData}" alt="schéma"></div>
    <div class="footer">SRRR – Schémas Routiers Pédagogiques &nbsp;•&nbsp; ${date}</div>
  </div>
  <scri"+"pt>\n    window.addEventListener('load', function() {\n      setTimeout(function() { window.print(); }, 400);\n    });\n  </scri"+"pt>

</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=1000,height=700');
    if (!win) {
      // Popup bloqué — fallback : lien direct
      triggerDownload(url, 'schema_SRRR_print.html');
      toast('⚠️ Popup bloquée — ouvrez le fichier téléchargé puis imprimez (Ctrl+P → Enregistrer PDF)');
    } else {
      toast('📄 Fenêtre d\'impression ouverte → Enregistrer en PDF');
    }
  } catch(e) { toast('❌ Erreur PDF : ' + e.message); }
}

// ── Word (.doc) ───────────────────────────────────────
function exportWord() {
  try {
    const oc = buildExportCanvas();
    const title = document.getElementById('hudTitle').textContent;
    const date = new Date().toLocaleDateString('fr-FR');
    // PNG en base64 intégré directement dans le HTML Word
    const imgData = oc.toDataURL('image/png');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta name="ProgId" content="Word.Document">
  <title>${title}</title>
  <!--[if gte mso 9]><xml>
    <w:WordDocument><w:Orientation>Landscape</w:Orientation></w:WordDocument>
  </xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; margin: 1cm; }
    h1 { font-size: 14pt; color: #1c1c1e; margin-bottom: 8pt; }
    img { max-width: 25cm; display: block; }
    .ft { font-size: 8pt; color: #888; margin-top: 8pt; text-align: right; }
    @page { size: A4 landscape; margin: 1cm; }
  </style>
</head>
<body>
  <h1>SRRR — ${title}</h1>
  <img src="${imgData}">
  <p class="ft">SRRR – Schémas Routiers Pédagogiques &nbsp;•&nbsp; ${date}</p>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-word;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'schema_SRRR.doc');
    toast('✓ Fichier Word téléchargé (.doc)');
  } catch(e) { toast('❌ Erreur Word : ' + e.message); }
}

// ═══════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════
window.addEventListener('load',init);