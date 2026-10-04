'use strict';

const canvas = document.querySelector('#sky');
const ctx = canvas.getContext('2d');
const moon = document.querySelector('#moon');
const constellationLabel = document.querySelector('#constellation-label');
const starNamePanel = document.querySelector('#star-name-panel');
const starNameInput = document.querySelector('#star-name-input');
const deleteStarNameButton = document.querySelector('#delete-star-name');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAR_COLOR = '211,231,255';
const rand = (min, max) => min + Math.random() * (max - min);

let w = 0;
let h = 0;
let stars = [];
let meteors = [];
let awakenedStars = [];
let pointer = null;
let skyDrag = null;
let lastFrame = 0;
let elapsed = 0;
let moonIllumination = .16;
let hoveredConstellation = -1;
let constellationOpacities = [];
let lastConstellationTone = 0;
let namingMode = false;
let pendingNamedStar = null;
let editingNamedStar = -1;
let namedStars = loadNamedStars();

const chain = [[0,1],[1,2],[2,3],[3,4]];
const cross = [[0,1],[1,2],[2,3],[3,4],[5,2],[2,6]];
const zigzag = [[0,1],[1,2],[2,3],[3,4]];
const cup = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[2,4]];
const smallVoice = (tone, index) => ({
  notes: [tone, tone * (index % 2 ? 1.25 : 1.5), tone * (index % 3 ? 2 : 1.75)],
  voice: { brightness: 1250 + index * 75, decay: .91 + index % 4 * .01, spacing: .13 + index % 3 * .035, spread: .35 + index % 5 * .1 }
});
const makeConstellation = (name, anchor, scale, points, edges, tone, index) => ({ name, anchor, scale, points, edges, ...smallVoice(tone, index) });

const constellations = [
  makeConstellation('ORION', [.11,.17], .105, [[.22,.08],[.75,.11],[.36,.38],[.49,.42],[.62,.45],[.17,.91],[.78,.88],[.49,.62]], [[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[3,7]], 196, 0),
  makeConstellation('URSA MAJOR', [.32,.13], .12, [[.08,.45],[.27,.34],[.45,.42],[.58,.61],[.77,.59],[.91,.43],[1,.25]], cup, 146.83, 1),
  makeConstellation('CASSIOPEIA', [.55,.14], .1, [[.03,.28],[.26,.65],[.49,.2],[.73,.64],[.98,.27]], zigzag, 246.94, 2),
  makeConstellation('LYRA', [.82,.13], .085, [[.5,.02],[.2,.38],[.38,.86],[.75,.82],[.83,.32]], [[0,1],[1,2],[2,3],[3,4],[4,1]], 329.63, 3),
  makeConstellation('TAURUS', [.94,.29], .1, [[.04,.23],[.36,.48],[.58,.5],[.92,.12],[.7,.92]], [[0,1],[1,2],[2,3],[2,4]], 220, 4),
  makeConstellation('LEO', [.17,.37], .11, [[.08,.63],[.28,.36],[.49,.2],[.67,.34],[.61,.58],[.83,.75],[.98,.61]], [[0,1],[1,2],[2,3],[3,4],[4,1],[4,5],[5,6]], 174.61, 5),
  makeConstellation('GEMINI', [.4,.34], .1, [[.25,.05],[.72,.08],[.31,.36],[.68,.38],[.2,.91],[.79,.9]], [[0,2],[2,4],[1,3],[3,5],[2,3]], 261.63, 6),
  makeConstellation('CYGNUS', [.62,.37], .11, [[.5,.03],[.49,.27],[.5,.51],[.49,.77],[.5,.98],[.09,.43],[.91,.42]], cross, 293.66, 7),
  makeConstellation('AQUILA', [.84,.43], .09, [[.5,.04],[.43,.36],[.5,.62],[.55,.96],[.06,.47],[.94,.48]], [[0,1],[1,2],[2,3],[4,1],[1,5]], 233.08, 8),
  makeConstellation('SCORPIUS', [.09,.62], .115, [[.12,.05],[.23,.19],[.18,.36],[.31,.5],[.48,.56],[.65,.65],[.77,.81],[.91,.88],[.99,.73]], [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]], 164.81, 9),
  makeConstellation('SAGITTARIUS', [.29,.59], .1, [[.08,.34],[.32,.2],[.55,.35],[.79,.18],[.68,.55],[.91,.77],[.47,.82],[.24,.62]], [[0,1],[1,2],[2,3],[2,4],[4,5],[4,6],[6,7],[7,0]], 207.65, 10),
  makeConstellation('PEGASUS', [.5,.61], .105, [[.15,.19],[.76,.14],[.83,.71],[.2,.78],[.04,.48],[.98,.92]], [[0,1],[1,2],[2,3],[3,0],[0,4],[2,5]], 277.18, 11),
  makeConstellation('ANDROMEDA', [.71,.59], .1, [[.06,.74],[.32,.53],[.58,.36],[.9,.11],[.74,.7]], [[0,1],[1,2],[2,3],[2,4]], 311.13, 12),
  makeConstellation('DRACO', [.91,.62], .11, [[.05,.18],[.27,.09],[.43,.25],[.38,.48],[.57,.66],[.81,.6],[.95,.82]], [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]], 185, 13),
  makeConstellation('PISCES', [.18,.81], .11, [[.05,.31],[.28,.18],[.48,.37],[.65,.59],[.93,.76],[.77,.91],[.58,.78]], [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]], 246.94, 14),
  makeConstellation('ARIES', [.4,.79], .08, [[.06,.75],[.34,.43],[.69,.34],[.94,.08]], [[0,1],[1,2],[2,3]], 293.66, 15),
  makeConstellation('CANIS MAJOR', [.65,.79], .105, [[.12,.44],[.36,.3],[.54,.05],[.61,.5],[.89,.68],[.5,.91]], [[0,1],[1,2],[1,3],[3,4],[3,5]], 220, 16),
  makeConstellation('CRUX', [.87,.81], .075, [[.5,.02],[.49,.95],[.05,.51],[.94,.48],[.64,.65]], [[0,1],[2,3],[0,4]], 349.23, 17)
];
constellationOpacities = constellations.map(() => 0);

function resize() {
  w = innerWidth;
  h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.min(850, Math.max(240, Math.round(w * h / 2200)));
  stars = Array.from({ length: count }, (_, index) => ({
    x: Math.random() * w, y: Math.random() * h,
    r: index % 31 === 0 ? rand(1.45, 2.2) : rand(.45, 1.35),
    phase: rand(0, Math.PI * 2), alpha: rand(.3, .9), hero: index % 31 === 0
  }));
  updateConstellationLabelPosition();
}

function addMeteor(x, y, vx, vy, strength = 1) {
  if (meteors.length > 70) meteors.shift();
  meteors.push({ x, y, vx, vy, life: 1, strength });
}

function meteorBurst() {
  for (let i = 0; i < 14; i += 1) addMeteor(rand(-w * .1, w * .7), rand(-40, h * .42), rand(430, 720), rand(180, 360), rand(.8, 1.25));
  playHarpNote(587.33, { brightness: 1700, decay: .93, spread: .25 }, .1);
}

function awakenCluster(x, y) {
  const amount = Math.round(rand(14, 22));
  for (let i = 0; i < amount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = Math.pow(Math.random(), .62) * rand(28, 96);
    awakenedStars.push({ x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, r: rand(.6, 2.2), life: 0, maxLife: rand(2.1, 4.2), delay: rand(0, .42), phase: rand(0, Math.PI * 2), hero: Math.random() < .16 });
  }
  awakenedStars = awakenedStars.slice(-130);
  playHarpNote(rand(520, 700), { brightness: 1900, decay: .92, spread: .4 }, -.18 + x / Math.max(w, 1) * .36);
}

function drawStar(star, alpha, radius = star.r) {
  if (alpha <= 0) return;
  if (star.hero) {
    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, radius * 7);
    glow.addColorStop(0, `rgba(235,246,255,${alpha * .72})`);
    glow.addColorStop(.18, `rgba(191,222,255,${alpha * .3})`);
    glow.addColorStop(1, 'rgba(154,203,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(star.x, star.y, radius * 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(225,241,255,${alpha * .48})`;
    ctx.lineWidth = .55;
    ctx.beginPath(); ctx.moveTo(star.x - radius * 5, star.y); ctx.lineTo(star.x + radius * 5, star.y); ctx.moveTo(star.x, star.y - radius * 4); ctx.lineTo(star.x, star.y + radius * 4); ctx.stroke();
  }
  ctx.fillStyle = `rgba(${STAR_COLOR},${alpha})`;
  ctx.beginPath(); ctx.arc(star.x, star.y, radius, 0, Math.PI * 2); ctx.fill();
}

function drawLine(a, b, alpha, width = .65) {
  ctx.strokeStyle = `rgba(${STAR_COLOR},${Math.max(0, alpha)})`;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawBackground() {
  const light = moonIllumination;
  const vertical = ctx.createLinearGradient(0, 0, 0, h);
  vertical.addColorStop(0, `rgb(${Math.round(2 + light * 5)},${Math.round(4 + light * 12)},${Math.round(8 + light * 20)})`);
  vertical.addColorStop(.52, `rgb(${Math.round(3 + light * 7)},${Math.round(7 + light * 16)},${Math.round(13 + light * 27)})`);
  vertical.addColorStop(1, `rgb(${Math.round(4 + light * 12)},${Math.round(9 + light * 27)},${Math.round(16 + light * 42)})`);
  ctx.fillStyle = vertical; ctx.fillRect(0, 0, w, h);
  const haze = ctx.createRadialGradient(w * .54, h * .66, 0, w * .54, h * .66, Math.max(w, h) * .7);
  haze.addColorStop(0, `rgba(72,128,184,${.008 + light * .112})`);
  haze.addColorStop(.45, `rgba(39,82,133,${.004 + light * .041})`);
  haze.addColorStop(1, 'rgba(3,7,12,0)');
  ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h);
}

function loadNamedStars() {
  try {
    const saved = JSON.parse(localStorage.getItem('celestial-named-stars') || '[]');
    return Array.isArray(saved) ? saved.filter(item => Number.isFinite(item.x) && Number.isFinite(item.y) && typeof item.name === 'string').slice(0, 60) : [];
  } catch { return []; }
}

function saveNamedStars() {
  try { localStorage.setItem('celestial-named-stars', JSON.stringify(namedStars)); } catch {}
}

function drawNamedStars() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '500 9px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  for (const item of namedStars) {
    const point = { x: item.x * w, y: item.y * h, r: 2.15, hero: true };
    drawStar(point, .96);
    ctx.fillStyle = 'rgba(224,239,255,.78)';
    ctx.fillText(item.name, point.x, point.y + 10);
  }
}

function constellationLayout(data) {
  const size = Math.min(w, h) * data.scale;
  const centerX = w * data.anchor[0];
  const centerY = h * data.anchor[1];
  return data.points.map(([x, y]) => ({ x: centerX + (x - .5) * size, y: centerY + (y - .5) * size }));
}

function drawConstellation(dt) {
  constellations.forEach((data, index) => {
    const target = index === hoveredConstellation ? 1 : 0;
    constellationOpacities[index] += (target - constellationOpacities[index]) * Math.min(1, dt * (target ? 7 : 3.8));
    const opacity = constellationOpacities[index];
    if (opacity < .01) return;
    const points = constellationLayout(data);
    for (const [from, to] of data.edges) drawLine(points[from], points[to], .48 * opacity, .8);
    points.forEach((point, i) => drawStar({ ...point, r: i % 3 === 0 ? 1.55 : 1.15, hero: true }, (.7 + .18 * Math.sin(elapsed * 1.3 + i)) * opacity));
  });
}

function detectConstellation() {
  if (!pointer) return -1;
  let nearest = -1;
  let nearestDistance = Infinity;
  const base = Math.min(w, h);
  constellations.forEach((data, index) => {
    const distance = Math.hypot(pointer.x - w * data.anchor[0], pointer.y - h * data.anchor[1]);
    const radius = Math.max(36, base * data.scale * .72);
    if (distance < radius && distance < nearestDistance) { nearest = index; nearestDistance = distance; }
  });
  return nearest;
}

function updateConstellationHover() {
  const next = detectConstellation();
  if (next === hoveredConstellation) return;
  hoveredConstellation = next;
  if (next < 0) {
    constellationLabel.classList.remove('visible');
    constellationLabel.textContent = '';
    return;
  }
  const data = constellations[next];
  constellationLabel.textContent = data.name;
  updateConstellationLabelPosition();
  constellationLabel.classList.add('visible');
  if (performance.now() - lastConstellationTone > 350) {
    playConstellationTheme(data);
    lastConstellationTone = performance.now();
  }
}

function updateConstellationLabelPosition() {
  if (hoveredConstellation < 0 || !w || !h) return;
  const data = constellations[hoveredConstellation];
  constellationLabel.style.left = `${w * data.anchor[0]}px`;
  constellationLabel.style.top = `${Math.min(h - 92, h * data.anchor[1] + Math.min(w, h) * data.scale * .72)}px`;
}

function updateMoonPhase() {
  const progress = (elapsed % 60) / 60;
  const firstHalf = progress < .5;
  const local = firstHalf ? progress * 2 : (progress - .5) * 2;
  const eased = .5 - Math.cos(local * Math.PI) / 2;
  const shift = firstHalf ? eased * 112 : -112 + eased * 112;
  const phaseLight = firstHalf ? eased : 1 - eased;
  const illumination = phaseLight;
  moonIllumination = illumination;
  moon.style.setProperty('--moon-shadow-x', `${shift}%`);
  moon.style.setProperty('--moon-glow', (.04 + illumination * .22).toFixed(3));
  moon.style.setProperty('--moon-haze', (.015 + illumination * .11).toFixed(3));
}

function render(dt) {
  elapsed += reducedMotion ? dt * .4 : dt;
  updateMoonPhase();
  updateConstellationHover();
  drawBackground();
  const nearby = [];
  for (const star of stars) {
    const distance = pointer ? Math.hypot(star.x - pointer.x, star.y - pointer.y) : Infinity;
    const twinkle = .84 + Math.sin(elapsed * (star.hero ? 1.7 : .72) + star.phase) * .16;
    const hoverLight = distance < 120 ? .2 * (1 - distance / 120) : 0;
    drawStar(star, Math.min(1, star.alpha * twinkle + hoverLight));
    if (distance < 150) nearby.push(star);
  }
  if (pointer) nearby.slice(0, 6).forEach(star => drawLine(star, pointer, .12 * (1 - Math.hypot(star.x - pointer.x, star.y - pointer.y) / 150)));
  drawNamedStars();
  drawConstellation(dt);

  for (let i = awakenedStars.length - 1; i >= 0; i -= 1) {
    const star = awakenedStars[i]; star.life += dt;
    if (star.life < star.delay) continue;
    const age = star.life - star.delay;
    const fadeIn = Math.min(1, age / .38);
    const fadeOut = Math.min(1, (star.maxLife - age) / 1.1);
    drawStar(star, Math.max(0, Math.min(fadeIn, fadeOut)) * (.68 + .25 * Math.sin(elapsed * 2 + star.phase)), star.r * (.72 + fadeIn * .28));
    if (age >= star.maxLife) awakenedStars.splice(i, 1);
  }

  for (let i = meteors.length - 1; i >= 0; i -= 1) {
    const meteor = meteors[i];
    meteor.x += meteor.vx * dt; meteor.y += meteor.vy * dt; meteor.life -= dt * .58;
    const tailX = meteor.x - meteor.vx * .24; const tailY = meteor.y - meteor.vy * .24;
    const tail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
    tail.addColorStop(0, `rgba(245,251,255,${Math.max(0, meteor.life)})`); tail.addColorStop(.16, `rgba(177,220,255,${Math.max(0, meteor.life) * .78})`); tail.addColorStop(1, 'rgba(130,194,255,0)');
    ctx.strokeStyle = tail; ctx.lineWidth = 1.55 * meteor.strength; ctx.beginPath(); ctx.moveTo(meteor.x, meteor.y); ctx.lineTo(tailX, tailY); ctx.stroke();
    const head = ctx.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, 9 * meteor.strength);
    head.addColorStop(0, `rgba(255,255,255,${Math.max(0, meteor.life)})`); head.addColorStop(.2, `rgba(195,228,255,${Math.max(0, meteor.life) * .65})`); head.addColorStop(1, 'rgba(155,207,255,0)');
    ctx.fillStyle = head; ctx.beginPath(); ctx.arc(meteor.x, meteor.y, 9 * meteor.strength, 0, Math.PI * 2); ctx.fill();
    if (meteor.life <= 0) meteors.splice(i, 1);
  }
  if (skyDrag && pointer) { drawLine(skyDrag, pointer, .38); ctx.strokeStyle = 'rgba(231,244,255,.55)'; ctx.beginPath(); ctx.arc(skyDrag.x, skyDrag.y, 5, 0, Math.PI * 2); ctx.stroke(); }
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000 || 0, .04); lastFrame = now;
  if (!document.hidden && Math.random() < dt * .18) addMeteor(rand(-50, w * .72), rand(-40, h * .35), rand(390, 520), rand(170, 260), rand(.7, 1));
  render(dt); requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; pointer = { x: event.clientX, y: event.clientY }; skyDrag = { ...pointer }; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', event => { pointer = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', event => {
  if (!skyDrag) return;
  const dx = event.clientX - skyDrag.x; const dy = event.clientY - skyDrag.y; const distance = Math.hypot(dx, dy);
  if (namingMode) {
    if (distance <= 14) openStarNaming(event.clientX, event.clientY);
    skyDrag = null;
    return;
  }
  if (distance > 14) { const speed = Math.min(920, Math.max(310, distance * 3)); addMeteor(skyDrag.x, skyDrag.y, dx / distance * speed, dy / distance * speed, Math.min(1.35, .8 + distance / 500)); playHarpNote(rand(520, 760), { brightness: 1850, decay: .93, spread: .5 }, -.25 + event.clientX / Math.max(w, 1) * .5); }
  else awakenCluster(event.clientX, event.clientY);
  skyDrag = null;
});
canvas.addEventListener('pointercancel', () => { skyDrag = null; pointer = null; });
canvas.addEventListener('pointerleave', () => { if (!skyDrag) pointer = null; });

function openStarNaming(x, y) {
  let nearestNamed = -1;
  let namedDistance = 28;
  namedStars.forEach((item, index) => {
    const distance = Math.hypot(item.x * w - x, item.y * h - y);
    if (distance < namedDistance) { namedDistance = distance; nearestNamed = index; }
  });
  editingNamedStar = nearestNamed;
  deleteStarNameButton.hidden = nearestNamed < 0;
  if (nearestNamed >= 0) {
    const item = namedStars[nearestNamed];
    pendingNamedStar = { x: item.x, y: item.y };
    starNameInput.value = item.name;
  } else {
    let nearest = null;
    let nearestDistance = 34;
    for (const star of stars) {
      const distance = Math.hypot(star.x - x, star.y - y);
      if (distance < nearestDistance) { nearestDistance = distance; nearest = star; }
    }
    if (!nearest) return;
    pendingNamedStar = { x: nearest.x / w, y: nearest.y / h };
    starNameInput.value = '';
  }
  starNamePanel.style.left = `${Math.max(112, Math.min(w - 112, pendingNamedStar.x * w))}px`;
  starNamePanel.style.top = `${Math.max(70, pendingNamedStar.y * h - 12)}px`;
  starNamePanel.hidden = false;
  requestAnimationFrame(() => starNameInput.focus());
}

function closeStarNaming() {
  starNamePanel.hidden = true;
  deleteStarNameButton.hidden = true;
  pendingNamedStar = null;
  editingNamedStar = -1;
}

let moonDrag = null;
moon.addEventListener('pointerdown', event => { const rect = moon.getBoundingClientRect(); moonDrag = { startX: event.clientX, startY: event.clientY, left: rect.left + rect.width / 2, top: rect.top + rect.height / 2, moved: false }; moon.setPointerCapture(event.pointerId); });
moon.addEventListener('pointermove', event => {
  if (!moonDrag) return;
  const dx = event.clientX - moonDrag.startX; const dy = event.clientY - moonDrag.startY;
  if (Math.hypot(dx, dy) > 7) moonDrag.moved = true;
  if (!moonDrag.moved) return;
  moon.style.left = `${Math.max(40, Math.min(w - 40, moonDrag.left + dx))}px`; moon.style.top = `${Math.max(40, Math.min(h - 96, moonDrag.top + dy))}px`;
});
moon.addEventListener('pointerup', () => { moonDrag = null; });
moon.addEventListener('pointercancel', () => { moonDrag = null; });
moon.addEventListener('keydown', event => {
  const directions = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, -15], ArrowDown: [0, 15] };
  if (!directions[event.key]) return;
  event.preventDefault(); const rect = moon.getBoundingClientRect(); const [dx, dy] = directions[event.key];
  moon.style.left = `${Math.max(40, Math.min(w - 40, rect.left + rect.width / 2 + dx))}px`; moon.style.top = `${Math.max(40, Math.min(h - 96, rect.top + rect.height / 2 + dy))}px`;
});

const button = id => document.getElementById(id);
button('burst').addEventListener('click', meteorBurst);
button('name-star').addEventListener('click', () => {
  namingMode = !namingMode;
  button('name-star').setAttribute('aria-pressed', String(namingMode));
  document.body.classList.toggle('naming', namingMode);
  if (!namingMode) closeStarNaming();
});
starNamePanel.addEventListener('submit', event => {
  event.preventDefault();
  const name = starNameInput.value.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name || !pendingNamedStar) return;
  const item = { ...pendingNamedStar, name };
  if (editingNamedStar >= 0) namedStars[editingNamedStar] = item;
  else namedStars.push(item);
  namedStars = namedStars.slice(-60);
  saveNamedStars();
  closeStarNaming();
  namingMode = false;
  button('name-star').setAttribute('aria-pressed', 'false');
  document.body.classList.remove('naming');
  playHarpNote(659.25, { brightness: 2100, decay: .94, spread: .2 }, 0);
});
button('cancel-star-name').addEventListener('click', closeStarNaming);
deleteStarNameButton.addEventListener('click', () => {
  if (editingNamedStar < 0) return;
  namedStars.splice(editingNamedStar, 1);
  saveNamedStars();
  closeStarNaming();
  namingMode = false;
  button('name-star').setAttribute('aria-pressed', 'false');
  document.body.classList.remove('naming');
});
starNameInput.addEventListener('keydown', event => { if (event.key === 'Escape') closeStarNaming(); });

button('fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { button('fullscreen').disabled = true; } });
if (!document.fullscreenEnabled) button('fullscreen').hidden = true;

let audio = null;
let masterGain = null;
let ambienceGain = null;
let reverb = null;
let sounding = false;

function makeImpulse(context, seconds = 5.8, decay = 3.5) {
  const length = Math.floor(context.sampleRate * seconds); const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) { const data = impulse.getChannelData(channel); for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay); }
  return impulse;
}

function setupAudio() {
  audio = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audio.createGain(); masterGain.gain.value = 0; masterGain.connect(audio.destination);
  const room = audio.createGain(); room.gain.value = .52; reverb = audio.createConvolver(); reverb.buffer = makeImpulse(audio); reverb.connect(room); room.connect(masterGain);
  const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = .25;
  ambienceGain = audio.createGain(); ambienceGain.gain.value = .16; ambienceGain.connect(filter); filter.connect(masterGain); filter.connect(reverb);
  [82.41, 123.47, 164.81].forEach((frequency, index) => {
    const oscillator = audio.createOscillator(); const voiceGain = audio.createGain(); const lfo = audio.createOscillator(); const depth = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency; voiceGain.gain.value = [.05,.027,.016][index]; lfo.frequency.value = [.027,.039,.022][index]; depth.gain.value = frequency * .006;
    lfo.connect(depth); depth.connect(oscillator.frequency); oscillator.connect(voiceGain); voiceGain.connect(ambienceGain); oscillator.start(); lfo.start();
  });
}

function playHarpNote(frequency, voice, pan = 0, when = null) {
  if (!sounding || !audio) return;
  const start = when === null ? audio.currentTime : when;
  const duration = Math.max(1.8, 1.2 + voice.decay * 3.2);
  const output = audio.createGain(); const panner = audio.createStereoPanner ? audio.createStereoPanner() : audio.createGain();
  if (panner.pan) panner.pan.value = Math.max(-1, Math.min(1, pan));
  output.gain.setValueAtTime(.0001, start); output.gain.exponentialRampToValueAtTime(.12, start + .012); output.gain.exponentialRampToValueAtTime(.0001, start + duration);
  output.connect(panner); panner.connect(masterGain); if (reverb) panner.connect(reverb);
  [1,2,3,4].forEach((multiple, index) => {
    const oscillator = audio.createOscillator(); const partialGain = audio.createGain(); const lowpass = audio.createBiquadFilter();
    oscillator.type = index === 0 ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(frequency * multiple, start); oscillator.detune.value = rand(-4,4);
    lowpass.type = 'lowpass'; lowpass.frequency.value = voice.brightness; partialGain.gain.value = [1,.32,.13,.06][index];
    oscillator.connect(lowpass); lowpass.connect(partialGain); partialGain.connect(output); oscillator.start(start); oscillator.stop(start + duration + .1);
  });
  const noiseLength = Math.floor(audio.sampleRate * .025); const noiseBuffer = audio.createBuffer(1, noiseLength, audio.sampleRate); const noise = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) noise[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength);
  const pick = audio.createBufferSource(); const pickFilter = audio.createBiquadFilter(); const pickGain = audio.createGain(); pick.buffer = noiseBuffer; pickFilter.type = 'bandpass'; pickFilter.frequency.value = frequency * 2.4; pickGain.gain.value = .22; pick.connect(pickFilter); pickFilter.connect(pickGain); pickGain.connect(output); pick.start(start);
}

function playConstellationTheme(data) {
  if (!sounding || !audio) return;
  const start = audio.currentTime + .04;
  data.notes.forEach((frequency, index) => { const pan = data.notes.length === 1 ? 0 : -data.voice.spread + index / (data.notes.length - 1) * data.voice.spread * 2; playHarpNote(frequency, data.voice, pan, start + index * data.voice.spacing); });
}

button('sound').addEventListener('click', async () => {
  try {
    if (!audio) setupAudio(); await audio.resume(); sounding = !sounding;
    masterGain.gain.cancelScheduledValues(audio.currentTime); masterGain.gain.setTargetAtTime(sounding ? .52 : 0, audio.currentTime, sounding ? .7 : .16);
    button('sound').setAttribute('aria-pressed', String(sounding));
    if (sounding && hoveredConstellation >= 0) playConstellationTheme(constellations[hoveredConstellation]);
  } catch { button('sound').disabled = true; }
});

document.addEventListener('visibilitychange', () => { if (audio) masterGain.gain.setTargetAtTime(document.hidden || !sounding ? 0 : .52, audio.currentTime, .24); });
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
