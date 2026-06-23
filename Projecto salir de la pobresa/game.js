const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const soldiersEl = document.querySelector("#soldiers");
const healthEl = document.querySelector("#health");
const allyEl = document.querySelector("#ally");
const coinsEl = document.querySelector("#coins");
const menuScreen = document.querySelector("#menuScreen");
const scoresScreen = document.querySelector("#scoresScreen");
const pauseScreen = document.querySelector("#pauseScreen");
const gameOverScreen = document.querySelector("#gameOverScreen");
const scoresList = document.querySelector("#scoresList");
const finalScoreEl = document.querySelector("#finalScore");
const exitMessageEl = document.querySelector("#exitMessage");
const startBtn = document.querySelector("#startBtn");
const scoresBtn = document.querySelector("#scoresBtn");
const scoresBackBtn = document.querySelector("#scoresBackBtn");
const gameOverScoresBtn = document.querySelector("#gameOverScoresBtn");
const gameOverMenuBtn = document.querySelector("#gameOverMenuBtn");
const replayBtn = document.querySelector("#replayBtn");
const exitBtn = document.querySelector("#exitBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const resumeBtn = document.querySelector("#resumeBtn");
const pauseMenuBtn = document.querySelector("#pauseMenuBtn");
const restartBtn = document.querySelector("#restartBtn");
const leftBtn = document.querySelector("#leftBtn");
const rightBtn = document.querySelector("#rightBtn");
const damageUpgradeBtn = document.querySelector("#damageUpgradeBtn");
const rateUpgradeBtn = document.querySelector("#rateUpgradeBtn");
const healthUpgradeBtn = document.querySelector("#healthUpgradeBtn");

const lanes = [0, 1, 2];
const laneNames = ["refuerzos", "enemigos", "aliado"];
const enemyTypes = {
  grunt: { color: "#ff5d5d", bar: "#fca5a5", hp: 2.2, speed: 1, size: 34, reward: 28, soldierScale: 0.08 },
  runner: { color: "#fb923c", bar: "#fed7aa", hp: 1.5, speed: 1.38, size: 30, reward: 36, soldierScale: 0.06 },
  brute: { color: "#c084fc", bar: "#e9d5ff", hp: 4.6, speed: 0.76, size: 44, reward: 62, soldierScale: 0.16 },
  captain: { color: "#f43f5e", bar: "#fecdd3", hp: 6.4, speed: 0.98, size: 48, reward: 96, soldierScale: 0.22 },
};
const scoreKey = "escuadron-scores-v3";
const allyGoal = 720;
const maxSoldiers = 18;
const baseFireRate = 0.95;
const upgradeMax = {
  damage: 5,
  rate: 4,
  health: 4,
};

let state;
let lastTime = 0;
let spawnClock = 0;
let rewardClock = 0;
let animationId = 0;
let running = false;
let paused = false;
let pointerStartX = 0;

function newState() {
  return {
    lane: 1,
    score: 0,
    coins: 0,
    soldiers: 1,
    health: 3,
    maxHealth: 3,
    allyCharge: 0,
    allyUnlocked: false,
    fireClock: 0,
    difficulty: 1,
    elapsed: 0,
    waves: 0,
    kills: 0,
    nextSpecialAt: 25,
    power: null,
    upgrades: {
      damage: 0,
      rate: 0,
      health: 0,
    },
    playerFlash: 0,
    bullets: [],
    enemies: [],
    pickups: [],
    particles: [],
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function laneX(lane) {
  return (lane + 0.5) * (canvas.clientWidth / 3);
}

function playerY() {
  return canvas.clientHeight - 82;
}

function clampLane(lane) {
  return Math.max(0, Math.min(2, lane));
}

function showScreen(screen) {
  for (const item of [menuScreen, scoresScreen, pauseScreen, gameOverScreen]) {
    item.hidden = item !== screen;
  }
}

function move(delta) {
  if (!running || paused) return;
  state.lane = clampLane(state.lane + delta);
  state.playerFlash = 0.12;
}

function startGame() {
  stopAnimation();
  state = newState();
  running = true;
  paused = false;
  lastTime = performance.now();
  spawnClock = 0.7;
  rewardClock = 1.15;
  showScreen(null);
  updateHud();
  draw();
  animationId = requestAnimationFrame(loop);
}

function pauseGame() {
  if (!running || paused) return;
  paused = true;
  stopAnimation();
  showScreen(pauseScreen);
  updateHud();
  draw();
}

function resumeGame() {
  if (!running || !paused) return;
  paused = false;
  lastTime = performance.now();
  showScreen(null);
  updateHud();
  animationId = requestAnimationFrame(loop);
}

function stopAnimation() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = 0;
}

function returnToMenu() {
  stopAnimation();
  running = false;
  paused = false;
  exitMessageEl.textContent = "";
  showScreen(menuScreen);
  updateHud();
  draw();
}

function gameOver() {
  if (!running) return;
  stopAnimation();
  running = false;
  paused = false;
  saveScore();
  finalScoreEl.textContent = `Lograste ${state.score} puntos, ${state.kills} bajas y ${state.soldiers} soldados.`;
  updateHud();
  showScreen(gameOverScreen);
}

function addPoints(amount, spendable = true) {
  state.score += amount;
  if (spendable) state.coins += amount;
}

function upgradeCost(type) {
  const level = state.upgrades[type];
  if (type === "damage") return (90 + level * 80) * 9;
  if (type === "rate") return (120 + level * 95) * 9;
  return (150 + level * 110) * 9;
}

function buyUpgrade(type) {
  if (!running || paused) return;
  if (state.upgrades[type] >= upgradeMax[type]) return;

  const cost = upgradeCost(type);
  if (state.coins < cost) return;

  state.coins -= cost;
  state.upgrades[type] += 1;

  if (type === "health") {
    state.maxHealth += 1;
    state.health = state.maxHealth;
  }

  addBurst(laneX(state.lane), playerY(), type === "damage" ? "#f87171" : type === "rate" ? "#38bdf8" : "#34d399", 18);
  updateHud();
}

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(scoreKey)) || [];
  } catch (error) {
    return [];
  }
}

function saveScore() {
  const result = {
    score: state.score,
    kills: state.kills,
    soldiers: state.soldiers,
    health: state.health,
    seconds: Math.floor(state.elapsed),
  };
  const scores = [...loadScores(), result]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  localStorage.setItem(scoreKey, JSON.stringify(scores));
}

function openScores() {
  renderScores();
  stopAnimation();
  if (running) {
    running = false;
    paused = false;
  }
  showScreen(scoresScreen);
}

function renderScores() {
  const scores = loadScores();
  scoresList.replaceChildren();

  if (!scores.length) {
    const item = document.createElement("li");
    item.textContent = "Aun no hay partidas guardadas.";
    scoresList.append(item);
    return;
  }

  for (const result of scores) {
    const item = document.createElement("li");
    const main = document.createElement("strong");
    const detail = document.createElement("span");
    main.textContent = `${result.score} puntos`;
    detail.textContent = ` | ${result.kills} bajas | ${result.soldiers} soldados | ${result.seconds}s`;
    item.append(main, detail);
    scoresList.append(item);
  }
}

async function exitGame() {
  exitMessageEl.textContent = "";
  const nativeApp = window.Capacitor?.Plugins?.App;

  try {
    if (nativeApp?.exitApp) {
      await nativeApp.exitApp();
      return;
    }
  } catch (error) {
    // The browser fallback below keeps the menu useful outside Android.
  }

  window.close();
  exitMessageEl.textContent = "En navegador puedes cerrar esta pestaña. En Android el boton saldra de la app.";
}

function spawnWave() {
  state.waves += 1;
  const pressure = Math.min(3, Math.floor(state.difficulty / 3));
  const extraChance = Math.min(0.64, Math.max(0.08, (state.difficulty - 1) * 0.085));
  let count = 1;

  if (Math.random() < extraChance) count += 1;
  if (pressure > 1 && Math.random() < extraChance * 0.42) count += 1;

  for (let i = 0; i < count; i += 1) {
    const captainWave = state.difficulty >= 5 && state.waves % 9 === 0 && i === count - 1;
    spawnEnemy(captainWave ? "captain" : pickEnemyType(), -40 - i * 78);
  }
}

function pickEnemyType() {
  const roll = Math.random();
  if (state.difficulty >= 3 && roll < 0.28) return "runner";
  if (state.difficulty >= 4 && roll > 0.74) return "brute";
  return "grunt";
}

function spawnEnemy(typeName, y) {
  const type = enemyTypes[typeName];
  const levelHp = type.hp + state.difficulty * (typeName === "runner" ? 0.26 : 0.4);
  const squadHp = Math.max(0, state.soldiers - 6) * type.soldierScale;
  const hp = Math.ceil(levelHp + squadHp + Math.random() * Math.max(1, state.difficulty * 0.28));

  state.enemies.push({
    lane: 1,
    y,
    type: typeName,
    hp,
    maxHp: hp,
    defeated: false,
    speed: (66 + state.difficulty * 4.9) * type.speed,
    size: type.size,
    reward: type.reward,
  });
}

function spawnPickup() {
  if (state.soldiers >= maxSoldiers) {
    spawnSupplyPickup();
    return;
  }

  const bonusChance = Math.max(0.18, 0.52 - state.difficulty * 0.035);
  const amount = Math.random() < bonusChance ? 2 : 1;
  state.pickups.push({
    lane: 0,
    y: -36,
    kind: "soldier",
    amount,
    speed: 94 + state.difficulty * 1.8,
    size: 30,
  });
}

function spawnSupplyPickup() {
  const kind = state.health < state.maxHealth && Math.random() < 0.55 ? "repair" : "ammo";
  state.pickups.push({
    lane: 0,
    y: -36,
    kind,
    amount: kind === "repair" ? 1 : 45,
    speed: 96 + state.difficulty * 1.6,
    size: kind === "repair" ? 34 : 32,
  });
}

function spawnSpecialPickup() {
  state.pickups.push({
    lane: 0,
    y: -46,
    kind: "power",
    amount: 0,
    speed: 102 + state.difficulty * 1.4,
    size: 42,
  });
  state.nextSpecialAt = state.elapsed + 21 + Math.random() * 6;
}

function shoot() {
  const power = state.power;
  const volleySize = state.soldiers + (power?.volleyBonus || 0);
  const spread = Math.min(42, volleySize * 2.25);
  for (let i = 0; i < volleySize; i += 1) {
    const offset = (i - (volleySize - 1) / 2) * Math.min(10, spread / Math.max(1, volleySize - 1));
    state.bullets.push({
      lane: state.lane,
      x: laneX(state.lane) + offset,
      y: playerY() - 34,
      target: state.lane === 2 ? "ally" : "enemy",
      speed: 520,
      damage: (state.allyUnlocked ? 2 : 1) + state.upgrades.damage + (power?.damageBonus || 0),
    });
  }
}

function addBurst(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.7) * 180,
      life: 0.35 + Math.random() * 0.28,
      color,
    });
  }
}

function update(dt) {
  state.elapsed += dt;
  const scorePressure = Math.min(state.score, 3000) / 6000;
  state.difficulty = 1 + state.elapsed / 20 + scorePressure;
  state.fireClock -= dt;
  state.playerFlash = Math.max(0, state.playerFlash - dt);
  spawnClock -= dt;
  rewardClock -= dt;
  updatePower(dt);

  const upgradeFireFactor = Math.max(0.62, 1 - state.upgrades.rate * 0.11);
  const fireRate = baseFireRate * upgradeFireFactor * (state.power?.fireFactor || 1);
  if (state.fireClock <= 0) {
    shoot();
    state.fireClock = fireRate;
  }

  if (spawnClock <= 0 && state.enemies.length < 9) {
    spawnWave();
    spawnClock = Math.max(0.44, 1.24 - state.difficulty * 0.062) + Math.random() * 0.18;
  }

  if (rewardClock <= 0) {
    spawnPickup();
    rewardClock = 2.15 + Math.min(1.25, state.difficulty * 0.07) + Math.random() * 1.15;
  }

  if (state.elapsed >= state.nextSpecialAt && !hasPowerPickup()) {
    spawnSpecialPickup();
  }

  for (const bullet of state.bullets) bullet.y -= bullet.speed * dt;
  for (const enemy of state.enemies) enemy.y += enemy.speed * dt;
  for (const pickup of state.pickups) pickup.y += pickup.speed * dt;

  handleCollisions();

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }

  state.bullets = state.bullets.filter((bullet) => bullet.y > -30);
  state.enemies = state.enemies.filter((enemy) => enemy.y < canvas.clientHeight + 60 && enemy.hp > 0);
  state.pickups = state.pickups.filter((pickup) => pickup.y < canvas.clientHeight + 50);
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function handleCollisions() {
  const py = playerY();

  for (const pickup of state.pickups) {
    if (pickup.lane === state.lane && Math.abs(pickup.y - py) < 42) {
      if (pickup.kind === "power") {
        activatePower();
        pickup.y = canvas.clientHeight + 100;
        addBurst(laneX(0), py, "#fbbf24", 28);
        continue;
      }

      if (pickup.kind === "repair") {
        state.health = Math.min(state.maxHealth, state.health + pickup.amount);
        addPoints(10);
        pickup.y = canvas.clientHeight + 100;
        addBurst(laneX(0), py, "#34d399", 16);
        continue;
      }

      if (pickup.kind === "ammo") {
        addPoints(pickup.amount);
        pickup.y = canvas.clientHeight + 100;
        addBurst(laneX(0), py, "#38bdf8", 16);
        continue;
      }

      state.soldiers = Math.min(maxSoldiers, state.soldiers + pickup.amount);
      addPoints(pickup.amount * 5);
      pickup.y = canvas.clientHeight + 100;
      addBurst(laneX(0), py, "#36d399", 16);
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.defeated && enemy.y > py - enemy.size * 0.8) {
      takeDamage(enemy);
      enemy.defeated = true;
      enemy.y = canvas.clientHeight + 100;
      if (state.health <= 0) gameOver();
      return;
    }
  }

  for (const bullet of state.bullets) {
    if (bullet.target === "ally") {
      hitAlly(bullet);
      continue;
    }

    for (const enemy of state.enemies) {
      if (!enemy.defeated && enemy.lane === bullet.lane && Math.abs(enemy.y - bullet.y) < enemy.size) {
        enemy.hp -= bullet.damage;
        bullet.y = -100;
        if (enemy.hp <= 0) defeatEnemy(enemy);
        break;
      }
    }
  }
}

function hasPowerPickup() {
  return state.pickups.some((pickup) => pickup.kind === "power");
}

function activatePower() {
  if (state.score >= 1200) {
    state.power = {
      name: "Tormenta",
      time: 8,
      damageBonus: 2,
      volleyBonus: 5,
      fireFactor: 0.55,
      color: "#f472b6",
    };
    return;
  }

  if (state.score >= 500) {
    state.power = {
      name: "Escuadra elite",
      time: 7,
      damageBonus: 1,
      volleyBonus: 3,
      fireFactor: 0.65,
      color: "#22d3ee",
    };
    return;
  }

  state.power = {
    name: "Municion pesada",
    time: 6,
    damageBonus: 1,
    volleyBonus: 1,
    fireFactor: 0.78,
    color: "#fbbf24",
  };
}

function updatePower(dt) {
  if (!state.power) return;
  state.power.time -= dt;
  if (state.power.time <= 0) state.power = null;
}

function takeDamage(enemy) {
  const damage = enemy.type === "captain" ? 2 : 1;
  state.health = Math.max(0, state.health - damage);
  state.playerFlash = 0.25;
  addBurst(laneX(enemy.lane), playerY(), "#f87171", 22);
}

function hitAlly(bullet) {
  if (state.allyUnlocked || bullet.y >= canvas.clientHeight * 0.36) return;
  state.allyCharge = Math.min(allyGoal, state.allyCharge + bullet.damage);
  bullet.y = -100;

  if (state.allyCharge >= allyGoal) {
    state.allyUnlocked = true;
    state.soldiers = Math.min(maxSoldiers, state.soldiers + 4);
    addPoints(250);
    addBurst(laneX(2), canvas.clientHeight * 0.28, "#fbbf24", 32);
  }
}

function defeatEnemy(enemy) {
  if (enemy.defeated) return;
  enemy.defeated = true;
  state.kills += 1;
  addPoints(enemy.reward);
  addBurst(laneX(enemy.lane), enemy.y, enemyTypes[enemy.type].color, enemy.type === "captain" ? 24 : 14);
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const road = ctx.createLinearGradient(0, 0, 0, h);
  road.addColorStop(0, "#2f3742");
  road.addColorStop(1, "#171c23");
  ctx.fillStyle = road;
  ctx.fillRect(0, 0, w, h);

  drawLanes(w, h);
  drawAllyStation();
  drawPickups();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawPowerStatus();
  drawParticles();
}

function drawLanes(w, h) {
  const laneW = w / 3;
  for (const lane of lanes) {
    ctx.fillStyle = lane === state.lane ? "rgba(77, 156, 255, 0.11)" : "rgba(255, 255, 255, 0.025)";
    ctx.fillRect(lane * laneW, 0, laneW, h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.font = "700 11px Arial";
    ctx.textAlign = "center";
    const name = lane === 0 && state.soldiers >= maxSoldiers ? "suministros" : laneNames[lane];
    ctx.fillText(name.toUpperCase(), laneX(lane), 22);
  }

  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * laneW, 36);
    ctx.lineTo(i * laneW, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawPlayer() {
  const x = laneX(state.lane);
  const y = playerY();
  const body = state.playerFlash > 0 ? "#78b7ff" : "#55a1ff";

  ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = body;
  roundedRect(x - 20, y - 22, 40, 48, 8);
  ctx.fill();
  ctx.fillStyle = "#172033";
  roundedRect(x - 8, y - 36, 16, 18, 6);
  ctx.fill();
  ctx.fillStyle = "#dbeafe";
  ctx.fillRect(x - 5, y - 42, 10, 14);

  if (state.power) {
    ctx.strokeStyle = state.power.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 2, 35, 0, Math.PI * 2);
    ctx.stroke();
  }

  const mini = Math.min(state.soldiers - 1, 8);
  for (let i = 0; i < mini; i += 1) {
    const angle = Math.PI + (i / Math.max(1, mini - 1)) * Math.PI;
    const sx = x + Math.cos(angle) * 34;
    const sy = y + 20 + Math.sin(angle) * 12;
    ctx.fillStyle = "#9dd7ff";
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    const x = laneX(enemy.lane);
    const type = enemyTypes[enemy.type];
    ctx.fillStyle = type.color;
    roundedRect(x - enemy.size * 0.56, enemy.y - enemy.size * 0.52, enemy.size * 1.12, enemy.size, 7);
    ctx.fill();
    ctx.fillStyle = "#260d16";
    ctx.fillRect(x - 15, enemy.y - enemy.size * 0.74, 30, 6);
    ctx.fillStyle = type.bar;
    ctx.fillRect(x - 15, enemy.y - enemy.size * 0.74, 30 * Math.max(0, enemy.hp / enemy.maxHp), 6);
  }
}

function drawPickups() {
  for (const pickup of state.pickups) {
    const x = laneX(pickup.lane);
    if (pickup.kind === "power") {
      drawPowerPickup(x, pickup);
      continue;
    }

    if (pickup.kind === "repair" || pickup.kind === "ammo") {
      drawSupplyPickup(x, pickup);
      continue;
    }

    ctx.fillStyle = "#36d399";
    ctx.beginPath();
    ctx.arc(x, pickup.y, pickup.size * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#052e1a";
    ctx.font = "900 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`+${pickup.amount}`, x, pickup.y + 6);
  }
}

function drawSupplyPickup(x, pickup) {
  const isRepair = pickup.kind === "repair";
  ctx.fillStyle = isRepair ? "#34d399" : "#38bdf8";
  roundedRect(x - 18, pickup.y - 18, 36, 36, 8);
  ctx.fill();
  ctx.fillStyle = isRepair ? "#052e1a" : "#082f49";
  ctx.font = "900 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(isRepair ? "+" : "$", x, pickup.y + 6);
}

function drawPowerPickup(x, pickup) {
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(x, pickup.y, pickup.size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff7cc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, pickup.y, pickup.size * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#422006";
  ctx.font = "900 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PODER", x, pickup.y + 4);
}

function drawBullets() {
  for (const bullet of state.bullets) {
    ctx.fillStyle = bullet.target === "ally" ? "#fbbf24" : "#b7f7ff";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.target === "ally" ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAllyStation() {
  const x = laneX(2);
  const y = canvas.clientHeight * 0.26;
  const pct = state.allyCharge / allyGoal;

  ctx.fillStyle = state.allyUnlocked ? "#fbbf24" : "#526071";
  roundedRect(x - 26, y - 34, 52, 68, 8);
  ctx.fill();
  ctx.fillStyle = "#111827";
  roundedRect(x - 15, y - 48, 30, 20, 7);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 35, y + 46, 70, 10);
  ctx.fillStyle = state.allyUnlocked ? "#fbbf24" : "#79c0ff";
  ctx.fillRect(x - 35, y + 46, 70 * pct, 10);
}

function drawPowerStatus() {
  if (!state.power) return;
  const x = canvas.clientWidth / 2;
  const y = 46;
  const width = 164;
  ctx.fillStyle = "rgba(8, 15, 24, 0.82)";
  roundedRect(x - width / 2, y - 13, width, 28, 8);
  ctx.fill();
  ctx.fillStyle = state.power.color;
  ctx.font = "800 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${state.power.name} ${Math.ceil(state.power.time)}s`, x, y + 4);
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function updateHud() {
  scoreEl.textContent = state.score.toString();
  coinsEl.textContent = `${state.coins} pts`;
  soldiersEl.textContent = state.soldiers.toString();
  healthEl.textContent = `${state.health}/${state.maxHealth}`;
  allyEl.textContent = state.allyUnlocked ? "Listo" : `${Math.floor((state.allyCharge / allyGoal) * 100)}%`;
  updateUpgradeButtons();
}

function updateUpgradeButtons() {
  updateUpgradeButton(damageUpgradeBtn, "damage", "Daño");
  updateUpgradeButton(rateUpgradeBtn, "rate", "Cadencia");
  updateUpgradeButton(healthUpgradeBtn, "health", "Vida");
}

function updateUpgradeButton(button, type, label) {
  const level = state.upgrades[type];
  if (level >= upgradeMax[type]) {
    button.textContent = `${label} MAX`;
    button.disabled = true;
    return;
  }

  const cost = upgradeCost(type);
  button.textContent = `${label} ${cost}`;
  button.disabled = !running || paused || state.coins < cost;
}

function loop(now) {
  if (!running || paused) return;
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  updateHud();
  if (running && !paused) animationId = requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  if (state) draw();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || key === "a") move(-1);
  if (event.key === "ArrowRight" || key === "d") move(1);
  if (key === "p" || event.key === "Escape") {
    if (paused) resumeGame();
    else pauseGame();
  }
  if (event.key === " " && !running && !paused) startGame();
});

canvas.addEventListener("pointerdown", (event) => {
  pointerStartX = event.clientX;
});

canvas.addEventListener("pointerup", (event) => {
  const delta = event.clientX - pointerStartX;
  if (Math.abs(delta) > 28) move(delta > 0 ? 1 : -1);
});

leftBtn.addEventListener("click", () => move(-1));
rightBtn.addEventListener("click", () => move(1));
restartBtn.addEventListener("click", startGame);
startBtn.addEventListener("click", startGame);
replayBtn.addEventListener("click", startGame);
damageUpgradeBtn.addEventListener("click", () => buyUpgrade("damage"));
rateUpgradeBtn.addEventListener("click", () => buyUpgrade("rate"));
healthUpgradeBtn.addEventListener("click", () => buyUpgrade("health"));
scoresBtn.addEventListener("click", openScores);
gameOverScoresBtn.addEventListener("click", openScores);
scoresBackBtn.addEventListener("click", returnToMenu);
gameOverMenuBtn.addEventListener("click", returnToMenu);
pauseBtn.addEventListener("click", pauseGame);
resumeBtn.addEventListener("click", resumeGame);
pauseMenuBtn.addEventListener("click", returnToMenu);
exitBtn.addEventListener("click", exitGame);

resizeCanvas();
state = newState();
draw();
updateHud();
showScreen(menuScreen);
