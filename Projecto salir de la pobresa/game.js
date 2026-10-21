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

// UI state stays separate from the combat state and its progression formulas.
const appEl = document.querySelector(".app");
const gameShell = document.querySelector("#gameShell");
const tutorialScreen = document.querySelector("#tutorialScreen");
const settingsScreen = document.querySelector("#settingsScreen");
const restartScreen = document.querySelector("#restartScreen");
const hideTutorial = document.querySelector("#hideTutorial");
const reduceEffectsInput = document.querySelector("#reduceEffects");
const skipTutorialInput = document.querySelector("#skipTutorial");
const musicEnabledInput = document.querySelector("#musicEnabled");
const effectsEnabledInput = document.querySelector("#effectsEnabled");
const masterVolumeInput = document.querySelector("#masterVolume");
const orientationGuard = document.querySelector("#orientationGuard");
const isNativeAndroid = window.Capacitor?.getPlatform?.() === "android";
let orientationBlocked = false;
const feedbackEl = document.querySelector("#gameFeedback");
const healthBar = document.querySelector("#healthBar");
const allyBar = document.querySelector("#allyBar");
const leftLaneLabel = document.querySelector("#leftLaneLabel");
const screens = [menuScreen, scoresScreen, tutorialScreen, settingsScreen, pauseScreen, restartScreen, gameOverScreen];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const preferencesKey = "escuadron-ui-v1";
let activeScreen = menuScreen;
let tutorialOrigin = "menu";
let scoreSort = "score";
let feedbackTime = 0;
let feedbackPriority = 0;
let sessionScores = null;
let preferences = readPreferences();
const audioManager = new AudioManager(preferences);
const numberFormat = new Intl.NumberFormat("es-MX");
const upgradeViews = Object.fromEntries(["damage", "rate", "health"].map((type) => [type, {
  level: document.querySelector(`#${type}Level`),
  cost: document.querySelector(`#${type}Cost`),
  card: document.querySelector(`[data-upgrade="${type}"]`),
}]));

function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function storageNotice() {
  const message = document.querySelector("#storageMessage");
  message.hidden = false;
  setText(message, "No se pudo guardar en este dispositivo. Los cambios se conservarán durante esta sesión.");
}

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey));
    return {
      tutorialSeen: saved?.tutorialSeen === true, skipTutorial: saved?.skipTutorial === true,
      reduceEffects: saved?.reduceEffects === true,
      musicEnabled: saved?.musicEnabled !== false, effectsEnabled: saved?.effectsEnabled !== false,
      masterVolume: typeof saved?.masterVolume === "number" && Number.isFinite(saved.masterVolume)
        ? Math.max(0, Math.min(1, saved.masterVolume)) : 0.5,
    };
  } catch {
    return { tutorialSeen: false, skipTutorial: false, reduceEffects: false, musicEnabled: true, effectsEnabled: true, masterVolume: 0.5 };
  }
}

function savePreferences() {
  try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); }
  catch { storageNotice(); }
  applyPreferences();
}

function reducedEffects() {
  return preferences.reduceEffects || motionPreference.matches;
}

function applyPreferences() {
  appEl.classList.toggle("reduce-effects", reducedEffects());
  reduceEffectsInput.checked = preferences.reduceEffects;
  skipTutorialInput.checked = preferences.skipTutorial;
  hideTutorial.checked = preferences.skipTutorial;
  musicEnabledInput.checked = preferences.musicEnabled;
  effectsEnabledInput.checked = preferences.effectsEnabled;
  masterVolumeInput.value = String(Math.round(preferences.masterVolume * 100));
  setText(document.querySelector("#masterVolumeValue"), `${Math.round(preferences.masterVolume * 100)} %`);
  audioManager.setOptions(preferences);
}

function formatTime(seconds) {
  if (!hasMetric(seconds)) return "—";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${rest}` : `${String(minutes).padStart(2, "0")}:${rest}`;
}

function hasMetric(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function metric(value) {
  return hasMetric(value) ? numberFormat.format(value) : "—";
}

function notifyGame(message, priority = 1) {
  if (feedbackTime > 0 && priority < feedbackPriority) return;
  feedbackPriority = priority;
  feedbackTime = priority > 1 ? 2.5 : 1.2;
  setText(feedbackEl, message);
  feedbackEl.classList.add("visible");
}

function updateFeedback(dt) {
  feedbackTime = Math.max(0, feedbackTime - dt);
  if (!feedbackTime) feedbackEl.classList.remove("visible");
}

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
let pointerStartX = null;
let pointerId = null;

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
  activeScreen = screen;
  for (const item of screens) {
    item.hidden = item !== screen;
  }
  const name = screen ? screen.id.replace("Screen", "") : "game";
  appEl.dataset.screen = name;
  const audioScene = running && paused ? "paused" : !screen ? "game" : screen === gameOverScreen ? "results" : "menu";
  audioManager.setScene(audioScene);
  gameShell.inert = Boolean(screen);
  gameShell.setAttribute("aria-hidden", String(Boolean(screen)));
  pointerStartX = null;
  pointerId = null;
  if (screen) {
    screen.scrollTop = 0;
    // A destructive dialog starts on its safe action; other screens announce their heading.
    const focusTarget = screen === restartScreen ? document.querySelector("#cancelRestartBtn") : screen;
    focusTarget.focus({ preventScroll: true });
  } else {
    canvas.focus({ preventScroll: true });
  }
}

function requestStart() {
  if (activeScreen !== menuScreen) return;
  if (!preferences.tutorialSeen && !preferences.skipTutorial) openTutorial("start");
  else startGame();
}

function openTutorial(origin = "menu") {
  if (origin === "pause" && (!running || !paused || activeScreen !== pauseScreen)) return;
  tutorialOrigin = origin;
  hideTutorial.checked = preferences.skipTutorial;
  showScreen(tutorialScreen);
}

function finishTutorial() {
  if (activeScreen !== tutorialScreen) return;
  preferences.tutorialSeen = true;
  preferences.skipTutorial = hideTutorial.checked;
  savePreferences();
  if (tutorialOrigin === "start") startGame();
  else if (tutorialOrigin === "pause") showScreen(pauseScreen);
  else returnToMenu();
}

function confirmRestart() {
  if (activeScreen !== pauseScreen || !running || !paused) return;
  showScreen(restartScreen);
}

function cancelRestart() {
  if (activeScreen === restartScreen) showScreen(pauseScreen);
}

function move(delta) {
  if (!running || paused || activeScreen) return;
  const previousLane = state.lane;
  state.lane = clampLane(state.lane + delta);
  if (state.lane !== previousLane) audioManager.play("move");
  state.playerFlash = 0.12;
  updateMovementButtons();
}

function startGame() {
  if (orientationBlocked) return;
  stopAnimation();
  state = newState();
  running = true;
  paused = false;
  lastTime = performance.now();
  spawnClock = 0.7;
  rewardClock = 1.15;
  feedbackTime = 0;
  feedbackEl.classList.remove("visible");
  setText(feedbackEl, "");
  showScreen(null);
  updateHud();
  draw();
  animationId = requestAnimationFrame(loop);
}

function pauseGame() {
  if (!running || paused || activeScreen) return;
  paused = true;
  stopAnimation();
  showScreen(pauseScreen);
  updateHud();
  draw();
}

function resumeGame() {
  if (!running || !paused || activeScreen !== pauseScreen || document.hidden || orientationBlocked) return;
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
  const historicalScores = loadScores().map((result) => result.score).filter(hasMetric);
  const previousBest = historicalScores.length ? Math.max(...historicalScores) : null;
  saveScore();
  setText(finalScoreEl, `${numberFormat.format(state.score)} pts`);
  setText(document.querySelector("#finalKills"), state.kills);
  setText(document.querySelector("#finalSoldiers"), state.soldiers);
  setText(document.querySelector("#finalTime"), formatTime(state.elapsed));
  setText(document.querySelector("#bestScore"), `${numberFormat.format(Math.max(previousBest ?? 0, state.score))} pts`);
  const message = previousBest === null ? "¡Tu primera marca! La próxima misión es superarla." : state.score > previousBest
    ? `¡Nuevo récord! Superaste tu marca anterior por ${numberFormat.format(state.score - previousBest)} puntos.`
    : state.score === previousBest ? "¡Igualaste tu récord! Un punto más para superarlo."
    : `Te faltaron ${numberFormat.format(previousBest - state.score + 1)} puntos para superar tu récord anterior.`;
  setText(document.querySelector("#recordMessage"), message);
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
  const label = { damage: "Daño", rate: "Cadencia", health: "Vida" }[type];
  notifyGame(`${label} mejorada · Nivel ${state.upgrades[type]} · −${cost} pts`, 2);
  updateHud();
}

function loadScores() {
  if (sessionScores) return [...sessionScores];
  try {
    const saved = JSON.parse(localStorage.getItem(scoreKey));
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
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
    .sort((a, b) => (hasMetric(b.score) ? b.score : -1) - (hasMetric(a.score) ? a.score : -1))
    .slice(0, 8);
  try { localStorage.setItem(scoreKey, JSON.stringify(scores)); }
  catch { sessionScores = scores; storageNotice(); }
}

function openScores() {
  if (running) return;
  scoreSort = "score";
  renderScores();
  stopAnimation();
  showScreen(scoresScreen);
}

function renderScores() {
  const scores = loadScores().sort((a, b) => {
    const av = hasMetric(a[scoreSort]) ? a[scoreSort] : -1;
    const bv = hasMetric(b[scoreSort]) ? b[scoreSort] : -1;
    return bv - av || (hasMetric(b.score) ? b.score : -1) - (hasMetric(a.score) ? a.score : -1);
  });
  scoresList.replaceChildren();
  document.querySelector("#scoresEmpty").hidden = scores.length !== 0;
  for (const button of document.querySelectorAll("[data-sort]")) {
    button.setAttribute("aria-pressed", String(button.dataset.sort === scoreSort));
  }
  const sortLabels = { score: "puntos", seconds: "tiempo", kills: "bajas", soldiers: "soldados" };
  setText(document.querySelector("#scoresCaption"), `Clasificación ordenada por ${sortLabels[scoreSort]}, de mayor a menor`);
  for (const [index, result] of scores.entries()) {
    const row = document.createElement("tr");
    const position = document.createElement("td");
    const rank = document.createElement("span");
    rank.className = `rank rank-${index + 1}`;
    rank.textContent = String(index + 1);
    position.append(rank);
    row.append(position);
    for (const key of ["score", "kills", "soldiers", "seconds"]) {
      const cell = document.createElement("td");
      cell.textContent = key === "seconds" ? formatTime(result[key]) : metric(result[key]);
      row.append(cell);
    }
    scoresList.append(row);
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
  audioManager.play("shoot");
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
  if (reducedEffects()) count = Math.min(count, 3);
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
  updateFeedback(dt);
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
        notifyGame("Suministro recogido · Vida recuperada", 2);
        continue;
      }

      if (pickup.kind === "ammo") {
        addPoints(pickup.amount);
        pickup.y = canvas.clientHeight + 100;
        addBurst(laneX(0), py, "#38bdf8", 16);
        notifyGame(`Suministros · +${pickup.amount} puntos`);
        continue;
      }

      const recruited = Math.min(pickup.amount, maxSoldiers - state.soldiers);
      state.soldiers = Math.min(maxSoldiers, state.soldiers + pickup.amount);
      audioManager.soldiersChanged(state.soldiers - recruited, state.soldiers, maxSoldiers);
      notifyGame(`Refuerzos · +${recruited} soldados`);
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
  notifyGame("¡Poder temporal activado!", 3);
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
  const previousHealth = state.health;
  state.health = Math.max(0, state.health - damage);
  if (state.health < previousHealth) audioManager.play("damage");
  state.playerFlash = 0.25;
  addBurst(laneX(enemy.lane), playerY(), "#f87171", 22);
  notifyGame(`Línea rebasada · −${damage} de vida`, 3);
}

function hitAlly(bullet) {
  if (state.allyUnlocked || bullet.y >= canvas.clientHeight * 0.36) return;
  const previousPercent = Math.floor((state.allyCharge / allyGoal) * 100);
  state.allyCharge = Math.min(allyGoal, state.allyCharge + bullet.damage);
  const currentPercent = Math.floor((state.allyCharge / allyGoal) * 100);
  if (currentPercent > previousPercent) audioManager.play("allyCharge", currentPercent / 100);
  bullet.y = -100;

  if (state.allyCharge >= allyGoal) {
    state.allyUnlocked = true;
    const recruited = Math.min(4, maxSoldiers - state.soldiers);
    state.soldiers = Math.min(maxSoldiers, state.soldiers + 4);
    audioManager.soldiersChanged(state.soldiers - recruited, state.soldiers, maxSoldiers);
    addPoints(250);
    addBurst(laneX(2), canvas.clientHeight * 0.28, "#fbbf24", 32);
    notifyGame(`¡Aliado activado! · +${recruited} soldados y +250 pts`, 3);
  }
}

function defeatEnemy(enemy) {
  if (enemy.defeated) return;
  enemy.defeated = true;
  audioManager.play("enemyDefeat");
  state.kills += 1;
  addPoints(enemy.reward);
  addBurst(laneX(enemy.lane), enemy.y, enemyTypes[enemy.type].color, enemy.type === "captain" ? 24 : 14);
  notifyGame(`Enemigo eliminado · +${enemy.reward} pts`);
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const road = ctx.createLinearGradient(0, 0, 0, h);
  road.addColorStop(0, "#142d43");
  road.addColorStop(1, "#071320");
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
    ctx.fillStyle = lane === state.lane ? "rgba(55, 162, 255, 0.13)" : "rgba(255, 255, 255, 0.015)";
    ctx.fillRect(lane * laneW, 0, laneW, h);
  }

  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = "rgba(132, 185, 218, 0.4)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * laneW, 36);
    ctx.lineTo(i * laneW, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(80, 143, 185, 0.07)";
  for (let y = 68; y < h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const x = laneX(state.lane);
  const y = playerY();
  const body = state.playerFlash > 0 ? "#78b7ff" : "#55a1ff";

  ctx.fillStyle = "#1e496a";
  ctx.beginPath();
  ctx.moveTo(x - 15, y - 12);
  ctx.lineTo(x - 32, y + 24);
  ctx.lineTo(x + 32, y + 24);
  ctx.lineTo(x + 15, y - 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#52dbff";
  ctx.fillRect(x - 15, y + 26, 7, 12);
  ctx.fillRect(x + 8, y + 26, 7, 12);

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
    ctx.fillStyle = "#210d20";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(enemy.type === "captain" ? "★" : "×", x, enemy.y + 7);
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

  ctx.fillStyle = state.allyUnlocked ? "#fbbf24" : "#377baf";
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
  ctx.fillStyle = state.allyUnlocked ? "#fce8ab" : "#c9eaff";
  ctx.font = "700 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText(state.allyUnlocked ? "ACTIVADO" : "CARGAR ↑", x, y + 76);
}

function drawPowerStatus() {
  if (!state.power) return;
  const x = canvas.clientWidth / 2;
  const y = 82;
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
  setText(scoreEl, numberFormat.format(state.score));
  scoreEl.classList.toggle("long-number", state.score >= 10000);
  setText(coinsEl, `${numberFormat.format(state.coins)} pts`);
  setText(soldiersEl, state.soldiers);
  setText(healthEl, `${state.health}/${state.maxHealth}`);
  setText(allyEl, state.allyUnlocked ? "100%" : `${Math.floor((state.allyCharge / allyGoal) * 100)}%`);
  if (healthBar.max !== state.maxHealth) healthBar.max = state.maxHealth;
  if (healthBar.value !== state.health) healthBar.value = state.health;
  if (allyBar.value !== state.allyCharge) allyBar.value = state.allyCharge;
  setText(leftLaneLabel, state.soldiers >= maxSoldiers ? "✚ Suministros" : "✚ Refuerzos");
  updateUpgradeButtons();
  updateMovementButtons();
}

function updateMovementButtons() {
  leftBtn.disabled = !running || paused || state.lane === 0;
  rightBtn.disabled = !running || paused || state.lane === 2;
}

function updateUpgradeButtons() {
  updateUpgradeButton(damageUpgradeBtn, "damage", "Daño");
  updateUpgradeButton(rateUpgradeBtn, "rate", "Cadencia");
  updateUpgradeButton(healthUpgradeBtn, "health", "Vida");
}

function updateUpgradeButton(button, type, label) {
  const level = state.upgrades[type];
  const maxed = level >= upgradeMax[type];
  const view = upgradeViews[type];
  const cost = upgradeCost(type);
  setText(view.level, `${level}/${upgradeMax[type]}`);
  setText(view.cost, maxed ? "Nivel máximo" : `${numberFormat.format(cost)} pts`);
  const disabled = maxed || !running || paused || state.coins < cost;
  if (button.disabled !== disabled) button.disabled = disabled;
  const description = maxed ? `${label}: nivel máximo` : `Mejorar ${label.toLowerCase()}, nivel ${level}, costo ${cost} puntos${state.coins < cost ? ", puntos insuficientes" : ""}`;
  if (button.getAttribute("aria-label") !== description) {
    button.setAttribute("aria-label", description);
    button.title = description;
  }
  view.card.classList.toggle("available", !disabled);
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

function redrawAtCurrentSize() {
  resizeCanvas();
  if (state) draw();
}
if (window.ResizeObserver) new ResizeObserver(redrawAtCurrentSize).observe(canvas);
else window.addEventListener("resize", redrawAtCurrentSize);

function updateOrientationGuard() {
  // A browser keeps its existing responsive layout. Only an Android window that
  // ignores portrait and becomes too short gets this safe, non-destructive pause.
  const blocked = isNativeAndroid && window.innerWidth > window.innerHeight && window.innerHeight < 500;
  if (blocked === orientationBlocked) return;
  if (blocked) pauseGame();
  orientationBlocked = blocked;
  appEl.inert = blocked;
  orientationGuard.hidden = !blocked;
  audioManager.setBlocked("orientation", blocked);
  if (blocked) orientationGuard.focus({ preventScroll: true });
  else (activeScreen || canvas).focus({ preventScroll: true });
}
window.addEventListener("resize", updateOrientationGuard);

document.addEventListener("visibilitychange", () => {
  audioManager.setBlocked("visibility", document.hidden);
  if (document.hidden) pauseGame();
});
window.addEventListener("blur", () => audioManager.setBlocked("focus", true));
window.addEventListener("focus", () => audioManager.setBlocked("focus", false));
window.addEventListener("pagehide", () => audioManager.setBlocked("page", true));
window.addEventListener("pageshow", () => audioManager.setBlocked("page", false));
document.addEventListener("pointerdown", (event) => {
  if (event.isTrusted) void audioManager.unlock();
}, { capture: true, passive: true });
document.addEventListener("keydown", (event) => {
  if (event.isTrusted && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) void audioManager.unlock();
}, true);
document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!event.isTrusted || !button || button.disabled || button.closest("[hidden], [inert]")) return;
  // Direction buttons use only the valid-movement sound. Capturing also covers
  // confirmation buttons that intentionally stop event propagation.
  if (button === leftBtn || button === rightBtn) return;
  void audioManager.unlock().then(() => {
    setTimeout(() => audioManager.play("button"), 0);
  });
}, true);

document.addEventListener("keydown", (event) => {
  if (orientationBlocked) return;
  const key = event.key.toLowerCase();
  if (event.key === "Tab" && activeScreen) {
    const focusable = [...activeScreen.querySelectorAll("button:not(:disabled), input:not(:disabled), [tabindex='0']")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === activeScreen)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === activeScreen)) {
      event.preventDefault(); first?.focus();
    }
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    if (activeScreen === restartScreen) cancelRestart();
    else if (activeScreen === tutorialScreen) {
      if (tutorialOrigin === "pause") showScreen(pauseScreen);
      else returnToMenu();
    } else if (activeScreen === scoresScreen || activeScreen === settingsScreen) returnToMenu();
    else if (activeScreen === pauseScreen) resumeGame();
    else if (!activeScreen) pauseGame();
    return;
  }
  const target = event.target;
  if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
  if (activeScreen) {
    if (key === "p" && activeScreen === pauseScreen && !event.repeat) resumeGame();
    if (event.key === " " && activeScreen === menuScreen && (target === menuScreen || target === document.body)) {
      event.preventDefault(); requestStart();
    }
    return;
  }
  if (event.key === "ArrowLeft" || key === "a") { event.preventDefault(); move(-1); }
  if (event.key === "ArrowRight" || key === "d") { event.preventDefault(); move(1); }
  if (key === "p" && !event.repeat) { event.preventDefault(); pauseGame(); }
});

canvas.addEventListener("pointerdown", (event) => {
  if (!running || paused || activeScreen || !event.isPrimary) return;
  pointerStartX = event.clientX;
  pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointerup", (event) => {
  if (pointerStartX === null || event.pointerId !== pointerId) return;
  const delta = event.clientX - pointerStartX;
  pointerStartX = null;
  pointerId = null;
  if (Math.abs(delta) > 28) move(delta > 0 ? 1 : -1);
});
canvas.addEventListener("pointercancel", () => { pointerStartX = null; pointerId = null; });
leftBtn.addEventListener("click", () => move(-1));
rightBtn.addEventListener("click", () => move(1));
restartBtn.addEventListener("click", confirmRestart);
document.querySelector("#confirmRestartBtn").addEventListener("click", (event) => {
  event.stopPropagation();
  if (activeScreen === restartScreen && running && paused) startGame();
});
document.querySelector("#cancelRestartBtn").addEventListener("click", (event) => {
  event.stopPropagation(); cancelRestart();
});
startBtn.addEventListener("click", requestStart);
replayBtn.addEventListener("click", () => { if (activeScreen === gameOverScreen) startGame(); });
document.querySelector("#tutorialBtn").addEventListener("click", () => openTutorial("menu"));
document.querySelector("#pauseTutorialBtn").addEventListener("click", () => openTutorial("pause"));
document.querySelector("#tutorialDoneBtn").addEventListener("click", finishTutorial);
document.querySelector("#settingsBtn").addEventListener("click", () => {
  applyPreferences(); showScreen(settingsScreen);
  if (!audioManager.supported) setText(document.querySelector("#settingsStatus"), "Este navegador no ofrece audio compatible. Puedes seguir jugando.");
});
document.querySelector("#settingsBackBtn").addEventListener("click", returnToMenu);
reduceEffectsInput.addEventListener("change", () => {
  preferences.reduceEffects = reduceEffectsInput.checked; savePreferences();
  setText(document.querySelector("#settingsStatus"), "Preferencias aplicadas.");
});
skipTutorialInput.addEventListener("change", () => {
  preferences.skipTutorial = skipTutorialInput.checked; savePreferences();
  setText(document.querySelector("#settingsStatus"), "Preferencias aplicadas.");
});
musicEnabledInput.addEventListener("change", () => {
  preferences.musicEnabled = musicEnabledInput.checked;
  savePreferences();
  setText(document.querySelector("#settingsStatus"), "Preferencias aplicadas.");
});
effectsEnabledInput.addEventListener("change", () => {
  preferences.effectsEnabled = effectsEnabledInput.checked;
  savePreferences();
  setText(document.querySelector("#settingsStatus"), "Preferencias aplicadas.");
});
masterVolumeInput.addEventListener("input", () => {
  preferences.masterVolume = Number(masterVolumeInput.value) / 100;
  // Persist at the end of the gesture, rather than writing storage on every tick.
  applyPreferences();
});
masterVolumeInput.addEventListener("change", () => {
  savePreferences();
  setText(document.querySelector("#settingsStatus"), "Preferencias aplicadas.");
});
motionPreference.addEventListener("change", applyPreferences);
for (const button of document.querySelectorAll("[data-sort]")) {
  button.addEventListener("click", () => { scoreSort = button.dataset.sort; renderScores(); });
}
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
applyPreferences();
resizeCanvas();
state = newState();
draw();
updateHud();
showScreen(menuScreen);
audioManager.setBlocked("visibility", document.hidden);
audioManager.setBlocked("focus", !document.hasFocus());
updateOrientationGuard();

// Capacitor is optional in the browser. Android Back follows the same safe routes.
const nativeApp = window.Capacitor?.Plugins?.App;
if (nativeApp?.addListener) {
  nativeApp.addListener("backButton", () => {
    if (!activeScreen) pauseGame();
    else if (activeScreen === restartScreen) cancelRestart();
    else if (activeScreen === tutorialScreen && tutorialOrigin === "pause") showScreen(pauseScreen);
    else if (activeScreen === pauseScreen) resumeGame();
    else if (activeScreen !== menuScreen) returnToMenu();
  });
  nativeApp.addListener("appStateChange", ({ isActive }) => {
    audioManager.setBlocked("native", !isActive);
    if (!isActive) pauseGame();
  });
}
