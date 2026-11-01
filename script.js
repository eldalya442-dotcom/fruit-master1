const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");
const timerEl = document.getElementById("timer");

const menu = document.getElementById("menu");
const gameover = document.getElementById("gameover");

const MAX_LEVEL = 20;

let W, H;
let score = 0;
let level = 1;
let lives = 3;

let levelStartScore = 0;
let levelTarget = 50;

let running = false;
let soundOn = true;

let objects = [];
let particles = [];
let trails = [];
let backgroundFruits = [];

let lastSpawn = 0;
let spawnDelay = 1100;
let lastTime = 0;
let startTime = 0;
let audio = null;
let messageTimer = null;

const fruits = [
  "🍉", "🍎", "🍊", "🍋",
  "🍍", "🥝", "🍓", "🍇",
  "🥑", "🥕", "🍐", "🍑"
];

const rotten = ["🤢", "🍂", "🦠"];

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  W = window.innerWidth;
  H = window.innerHeight;

  canvas.width = W * dpr;
  canvas.height = H * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

function createBackground() {
  backgroundFruits = [];

  for (let i = 0; i < 22; i++) {
    backgroundFruits.push({
      x: Math.random() * W,
      y: Math.random() * H,
      emoji: fruits[Math.floor(Math.random() * fruits.length)],
      size: 20 + Math.random() * 25,
      speed: 0.2 + Math.random() * 0.5,
      angle: Math.random() * 6
    });
  }
}

createBackground();

function sound(type = "slice") {
  if (!soundOn) return;

  try {
    audio = audio || new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    if (audio.state === "suspended") audio.resume();

    const now = audio.currentTime;

    function tone(freq, endFreq, duration, volume, wave) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);

      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFreq),
        now + duration
      );

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + duration
      );

      osc.connect(gain);
      gain.connect(audio.destination);

      osc.start(now);
      osc.stop(now + duration);
    }

    if (type === "slice") {
      tone(1000, 160, 0.14, 0.16, "sawtooth");
      tone(1500, 400, 0.08, 0.07, "triangle");
    }

    if (type === "rotten") {
      tone(220, 75, 0.25, 0.15, "triangle");
      tone(150, 80, 0.18, 0.08, "sine");
    }

    if (type === "bomb") {
      tone(100, 35, 0.4, 0.2, "sawtooth");
      tone(65, 30, 0.3, 0.12, "triangle");
    }

    if (type === "level") {
      tone(500, 900, 0.2, 0.13, "sine");

      setTimeout(() => {
        if (soundOn) {
          tone(700, 1100, 0.2, 0.12, "sine");
        }
      }, 120);
    }

  } catch (e) {}
}

function updateLevelDisplay() {
  document.getElementById("level").textContent =
    level + " / " + MAX_LEVEL;

  const progress = Math.min(
    100,
    ((score - levelStartScore) / levelTarget) * 100
  );

  document.getElementById("progressFill").style.width =
    progress + "%";

  document.getElementById("progressText").textContent =
    (score - levelStartScore) + " / " + levelTarget + " نقطة";

  document.getElementById("nextLevel").textContent =
    level === MAX_LEVEL
      ? "المستوى الأخير 👑"
      : "المستوى التالي: " + (level + 1);

  document.getElementById("levelStatus").textContent =
    level <= 5 ? "بداية المغامرة 🌟" :
    level <= 10 ? "محترف الفواكه 🔥" :
    level <= 15 ? "خبير التقطيع ⚡" :
    "تحدي الأبطال 👑";
}

function showLevel() {
  const msg = document.getElementById("levelMessage");

  msg.textContent = level === MAX_LEVEL
    ? "👑 وصلت للمستوى الأخير!"
    : "🏆 المستوى " + level;

  clearTimeout(messageTimer);

  messageTimer = setTimeout(() => {
    msg.textContent = "";
  }, 1400);
}

function spawn() {
  const roll = Math.random();

  let type = "fruit";
  let emoji;

  if (roll < 0.13) {
    type = "rotten";
    emoji = rotten[Math.floor(Math.random() * rotten.length)];
  } else if (roll < 0.23) {
    type = "bomb";
    emoji = "💣";
  } else {
    emoji = fruits[Math.floor(Math.random() * fruits.length)];
  }

  objects.push({
    x: W * (0.12 + Math.random() * 0.76),
    y: H + 45,
    vx: (Math.random() - 0.5) * (3 + level * 0.2),
    vy: -(10 + Math.random() * 4 + level * 0.5),
    gravity: 0.19,
    size: 40 + Math.random() * 12,
    emoji,
    type,
    active: true,
    rotation: 0
  });
}

function createParticles(x, y, emoji) {
  for (let i = 0; i < 16; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 9,
      vy: (Math.random() - 0.5) * 9,
      life: 1,
      emoji
    });
  }
}

function addScore(obj) {
  if (obj.type === "fruit") {
    score += 1;
    sound("slice");
  } else if (obj.type === "rotten") {
    score += 5;
    sound("rotten");
  } else {
    score += 10;
    sound("bomb");
  }

  while (
    level < MAX_LEVEL &&
    score >= levelStartScore + levelTarget
  ) {
    levelStartScore += levelTarget;
    level++;

    levelTarget = level * 50;

    spawnDelay = Math.max(
      300,
      1100 - (level - 1) * 40
    );

    sound("level");
    showLevel();
  }

  scoreEl.textContent = score;
  updateLevelDisplay();
}

function hit(x, y) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    if (!obj.active) continue;

    const dx = x - obj.x;
    const dy = y - obj.y;

    if (Math.hypot(dx, dy) < obj.size * 0.9) {
      obj.active = false;

      addScore(obj);
      createParticles(obj.x, obj.y, obj.emoji);

      return true;
    }
  }

  return false;
}

let pointerDown = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener("pointerdown", e => {
  if (!running) return;

  pointerDown = true;
  lastX = e.clientX;
  lastY = e.clientY;

  hit(lastX, lastY);
});

canvas.addEventListener("pointermove", e => {
  if (!pointerDown || !running) return;

  const x = e.clientX;
  const y = e.clientY;

  trails.push({
    x1: lastX,
    y1: lastY,
    x2: x,
    y2: y,
    life: 1
  });

  const distance = Math.hypot(
    x - lastX,
    y - lastY
  );

  const steps = Math.max(
    1,
    Math.ceil(distance / 12)
  );

  for (let i = 1; i <= steps; i++) {
    const px = lastX + (x - lastX) * i / steps;
    const py = lastY + (y - lastY) * i / steps;

    hit(px, py);
  }

  lastX = x;
  lastY = y;
});

function pointerEnd() {
  pointerDown = false;
}

canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);

function drawBackground() {
  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createRadialGradient(
    W / 2, H / 2, 20,
    W / 2, H / 2, W
  );

  gradient.addColorStop(0, "#243653");
  gradient.addColorStop(1, "#070b19");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  backgroundFruits.forEach(f => {
    f.y -= f.speed;

    if (f.y < -50) f.y = H + 50;

    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    ctx.font = f.size + "px Arial";
    ctx.fillText(f.emoji, 0, 0);
    ctx.restore();
  });
}

function drawObjects(dt) {
  objects.forEach(obj => {
    if (!obj.active) return;

    obj.x += obj.vx * dt;
    obj.y += obj.vy * dt;
    obj.vy += obj.gravity * dt;
    obj.rotation += 0.025 * dt;

    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.rotate(obj.rotation);

    ctx.shadowBlur = 18;

    ctx.shadowColor =
      obj.type === "bomb" ? "#ff3333" :
      obj.type === "rotten" ? "#77aa33" :
      "#ffb52e";

    ctx.font = obj.size + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(obj.emoji, 0, 0);
    ctx.restore();

    if (obj.y > H + 80) {
      obj.active = false;

      if (obj.type === "fruit") {
        lives--;
        livesEl.textContent = lives;

        if (lives <= 0) endGame();
      }
    }
  });

  objects = objects.filter(o => o.active);
}

function drawTrails() {
  trails.forEach(t => {
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);

    ctx.strokeStyle =
      `rgba(100,230,255,${t.life})`;

    ctx.lineWidth = 7 * t.life;
    ctx.lineCap = "round";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#55ddff";

    ctx.stroke();

    t.life -= 0.09;
  });

  trails = trails.filter(t => t.life > 0);
}

function drawParticles(dt) {
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.2 * dt;
    p.life -= 0.025 * dt;

    ctx.globalAlpha = Math.max(0, p.life);
    ctx.font = "18px Arial";
    ctx.fillText(p.emoji, p.x, p.y);
    ctx.globalAlpha = 1;
  });

  particles = particles.filter(p => p.life > 0);
}

function loop(time = 0) {
  if (!running) return;

  const dt = Math.min(
    (time - lastTime) / 16.67 || 1,
    2
  );

  lastTime = time;

  drawBackground();

  if (time - lastSpawn > spawnDelay) {
    spawn();
    lastSpawn = time;
  }

  drawObjects(dt);
  drawTrails();
  drawParticles(dt);

  timerEl.textContent = Math.floor(
    (Date.now() - startTime) / 1000
  );

  requestAnimationFrame(loop);
}

function startGame() {
  score = 0;
  level = 1;
  lives = 3;

  levelStartScore = 0;
  levelTarget = 50;

  objects = [];
  particles = [];
  trails = [];

  scoreEl.textContent = 0;
  levelEl.textContent = "1 / 20";
  livesEl.textContent = 3;
  timerEl.textContent = 0;

  spawnDelay = 1100;

  updateLevelDisplay();

  startTime = Date.now();
  lastSpawn = performance.now();

  menu.classList.add("hidden");
  gameover.classList.add("hidden");

  document.getElementById("levelMessage").textContent = "";

  running = true;
  lastTime = performance.now();

  sound("level");

  requestAnimationFrame(loop);
}

function endGame() {
  if (!running) return;

  running = false;

  document.getElementById("finalScore").textContent = score;
  document.getElementById("finalLevel").textContent = level;

  document.getElementById("finalTime").textContent =
    Math.floor((Date.now() - startTime) / 1000);

  gameover.classList.remove("hidden");
}

document.getElementById("startBtn").onclick = startGame;
document.getElementById("restartBtn").onclick = startGame;

document.getElementById("homeBtn").onclick = () => {
  running = false;

  gameover.classList.add("hidden");
  menu.classList.remove("hidden");

  drawBackground();
};

document.getElementById("soundBtn").onclick = () => {
  soundOn = !soundOn;

  document.getElementById("soundBtn").textContent =
    soundOn ? "🔊" : "🔇";

  if (soundOn) sound("level");
};

drawBackground();
updateLevelDisplay();
