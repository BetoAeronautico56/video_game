// Real Chrome checks through CDP; no browser automation dependency is installed.
// Test scores live exclusively in a temporary Chrome profile, never the user's browser.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileAudio = process.argv.includes('--mobile-audio');
const evidence = resolve(root, mobileAudio ? 'docs/mobile-audio' : 'docs/ux-ui-redesign');
await mkdir(resolve(evidence,'before'), { recursive:true });
await mkdir(resolve(evidence,'after'), { recursive:true });
const results = [];
const errors = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/favicon.ico')) { res.writeHead(204).end(); return; }
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!path.startsWith(root + '/') && !path.startsWith(root + '\\')) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' })[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'escuadron-ux-chrome-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
let nextId = 0;
const pending = new Map();
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve: (v) => { clearTimeout(timeout); resolve(v); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function navigate(path = '/') {
  await call('Page.navigate', { url: origin + path });
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`location.href === ${JSON.stringify(origin + path)} && document.readyState === 'complete' && typeof state !== 'undefined'`)) return;
    await delay(40);
  }
  throw new Error('Page did not initialize: ' + path);
}
async function click(selector) {
  const point = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.disabled || e.closest('[hidden], [inert]')) throw new Error('Not interactive: '+${JSON.stringify(selector)}); e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  await delay(30);
}
async function key(key, code = key, modifiers = 0) {
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
}
async function check(name, expression) {
  assert.equal(await evaluate(expression), true, name);
  results.push({ name, status: 'passed' });
  console.log('PASS ' + name);
}
async function screenshot(path) {
  await delay(230);
  const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(resolve(evidence, path), Buffer.from(data, 'base64'));
}
async function viewport(width, height) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 621 });
  await delay(80);
}
try {
  let port;
  for (let i = 0; i < 200; i++) {
    try { port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch {}
    await delay(50);
  }
  if (!port) throw new Error('Chrome did not start. Check CHROME_PATH and sandbox permissions.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener('open', r, { once: true }));
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id); pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error))); else entry.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(JSON.stringify(message.params.args));
  });
  await call('Page.enable');
  await call('Runtime.enable');
  await viewport(390, 844);

  // Before captures use a preserved copy of the original application.
  await navigate('/docs/ux-ui-redesign/before-source/');
  await screenshot('before/menu.png');
  await click('#startBtn');
  await delay(650);
  await evaluate('pauseGame()');
  await screenshot('before/pause.png');
  await evaluate('showScreen(null); draw()');
  await screenshot('before/game.png');
  await evaluate('gameOver()');
  await screenshot('before/gameover.png');
  await click('#gameOverScoresBtn');
  await screenshot('before/scores.png');

  await navigate('/');
  await evaluate('localStorage.clear()');
  await navigate('/?fresh=1');
  await check('Initial menu and accessible play action', "activeScreen === menuScreen && gameShell.inert && document.querySelector('#startBtn').textContent.trim() === 'Jugar'");
  await screenshot('after/menu-mobile.png');
  await click('#startBtn');
  await check('First play opens five-step tutorial', "activeScreen === tutorialScreen && document.querySelectorAll('.tutorial-steps li').length === 5 && !running");
  await screenshot('after/tutorial-mobile.png');
  await click('#hideTutorial');
  await click('#tutorialDoneBtn');
  await check('Tutorial starts a real game and saves preference', "running && !paused && !activeScreen && JSON.parse(localStorage.getItem(preferencesKey)).skipTutorial");
  await key('ArrowLeft');
  await check('Keyboard moves left', 'state.lane === 0 && leftBtn.disabled');
  await key('ArrowRight');
  await click('#rightBtn');
  await check('Button moves right and respects lane bounds', 'state.lane === 2 && rightBtn.disabled');
  const bounds = await evaluate('(() => { const r=canvas.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height*.7}; })()');
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x, y: bounds.y }] });
  await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x - 80, y: bounds.y }] });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await check('Touch swipe moves one lane', 'state.lane === 1');
  await click('#pauseBtn');
  await evaluate('window.pausedSnapshot = JSON.stringify(state)');
  await delay(300);
  await check('Pause freezes game state', 'paused && JSON.stringify(state) === window.pausedSnapshot && animationId === 0');
  await screenshot('after/pause-mobile.png');
  await click('#pauseTutorialBtn');
  await key('p', 'KeyP');
  await key(' ', 'Space');
  await delay(200);
  await check('Pause tutorial and shortcuts preserve state', 'activeScreen === tutorialScreen && paused && JSON.stringify(state) === window.pausedSnapshot');
  await click('#tutorialDoneBtn');
  await check('Tutorial returns to pause without restart', 'activeScreen === pauseScreen && JSON.stringify(state) === window.pausedSnapshot');
  await click('#restartBtn');
  await check('Restart asks confirmation and focuses Cancel', "activeScreen === restartScreen && document.activeElement.id === 'cancelRestartBtn' && JSON.stringify(state) === window.pausedSnapshot");
  await screenshot('after/restart-mobile.png');
  await key('p', 'KeyP');
  await key(' ', 'Space');
  await check('Keyboard cannot bypass confirmation', 'activeScreen === pauseScreen && JSON.stringify(state) === window.pausedSnapshot');
  // Space activates the focused Cancel button, which is safe and returns to pause.
  await click('#restartBtn');
  await key('Escape');
  await check('Escape cancels restart and preserves state', 'activeScreen === pauseScreen && paused && JSON.stringify(state) === window.pausedSnapshot');
  await click('#restartBtn');
  await key('Tab');
  await check('Restart dialog traps keyboard focus', "document.activeElement.id === 'confirmRestartBtn'");
  await key('Tab', 'Tab', 8);
  await check('Reverse Tab remains inside dialog', "document.activeElement.id === 'cancelRestartBtn'");
  await click('#cancelRestartBtn');
  await click('#restartBtn');
  await click('#confirmRestartBtn');
  await check('Confirmed restart resets once', 'running && !paused && !activeScreen && state.score === 0 && state.soldiers === 1 && state.upgrades.damage === 0');
  await evaluate('stopAnimation(); state.coins = 4000; state.score = 4000; updateHud()');
  await check('Original improvement costs preserved', 'upgradeCost("damage") === 810 && upgradeCost("rate") === 1080 && upgradeCost("health") === 1350');
  await click('#damageUpgradeBtn');
  await click('#rateUpgradeBtn');
  await click('#healthUpgradeBtn');
  await check('All three upgrades purchase with original progression', 'state.coins === 760 && state.score === 4000 && state.upgrades.damage === 1 && state.upgrades.rate === 1 && state.maxHealth === 4 && state.health === 4');
  await check('Insufficient points disables purchase', 'damageUpgradeBtn.disabled && rateUpgradeBtn.disabled && healthUpgradeBtn.disabled');
  await evaluate('state.coins = 999999; state.upgrades.damage=5; updateHud()');
  await check('Max upgrade level is explicit and disabled', 'damageUpgradeBtn.disabled && upgradeViews.damage.cost.textContent === "Nivel máximo"');
  await evaluate('state = newState(); feedbackTime=0; state.lane=0; state.pickups=[{lane:0,y:playerY(),kind:"soldier",amount:2,speed:0,size:30}]; handleCollisions(); updateHud()');
  await check('Collecting reinforcements retains rewards', 'state.soldiers === 3 && state.score === 10 && state.coins === 10 && feedbackEl.textContent.includes("Refuerzos")');
  await evaluate('state.soldiers=18; spawnPickup(); updateHud()');
  await check('Left lane switches to supplies at 18 soldiers', 'leftLaneLabel.textContent.includes("Suministros") && ["repair","ammo"].includes(state.pickups.at(-1).kind)');
  await evaluate('state=newState(); spawnEnemy("grunt",50); const e=state.enemies[0]; defeatEnemy(e); defeatEnemy(e); updateHud()');
  await check('Enemy reward counted once', 'state.score === 28 && state.coins === 28 && state.kills === 1');
  await evaluate('state=newState(); spawnEnemy("grunt",120); state.enemies[0].hp=1; state.bullets=[{lane:1,y:120,damage:1,target:"enemy"}]; handleCollisions()');
  await check('Actual bullet collision eliminates enemy and awards points', 'state.kills===1 && state.score===28 && state.enemies[0].defeated && state.bullets[0].y===-100');
  await evaluate('takeDamage({type:"captain",lane:1}); updateHud()');
  await check('Captain damage and visual feedback preserved', 'state.health === 1 && feedbackEl.textContent.includes("−2")');
  await evaluate('state.allyCharge=allyGoal-1; hitAlly({y:0,damage:1}); updateHud()');
  await check('Ally activates at original threshold and rewards', 'state.allyUnlocked && state.soldiers === 5 && state.score === 278 && state.allyCharge === 720 && allyEl.textContent === "100%"');
  await evaluate('state.score=1200; activatePower()');
  await check('Original temporary power remains operational', 'state.power.name === "Tormenta" && state.power.time === 8 && state.power.damageBonus === 2');
  await evaluate('state=newState(); running=true; paused=false; state.elapsed=24.99; spawnClock=99; rewardClock=99; update(.02)');
  await check('Special pickup spawns after 25 seconds', 'state.pickups.some(p=>p.kind === "power")');
  await evaluate('pauseGame()');
  await click('#resumeBtn');
  await check('Resume restarts animation without reset', 'running && !paused && animationId !== 0 && state.elapsed >= 25');
  await evaluate('stopAnimation(); state.score=56; state.kills=2; state.soldiers=3; state.elapsed=42; state.health=2; state.coins=56; feedbackTime=0; feedbackEl.classList.remove("visible"); spawnEnemy("grunt",100); spawnPickup(); draw(); updateHud()');
  await screenshot('after/game-mobile.png');

  const sampleScores = [{ score: 183, kills: 6, soldiers: 4, seconds: 90 }, { score: 122, kills: 12, soldiers: 9, seconds: 3661 }, { score: 90 }, { score: 80, kills: 3, soldiers: 18, seconds: 200 }];
  await evaluate(`localStorage.setItem(scoreKey, ${JSON.stringify(JSON.stringify(sampleScores))}); gameOver()`);
  await check('Results include duration, best and strict record gap', "document.querySelector('#finalTime').textContent === '00:42' && document.querySelector('#bestScore').textContent === '183 pts' && document.querySelector('#recordMessage').textContent.includes('128')");
  await screenshot('after/gameover-mobile.png');
  await check('Game over persists result exactly once', 'loadScores().filter(s=>s.score===56).length === 1');
  await evaluate('gameOver()');
  await check('Repeated game over cannot duplicate score', 'loadScores().filter(s=>s.score===56).length === 1');
  await click('#gameOverScoresBtn');
  await check('General filter sorts by points', "scoresList.rows[0].cells[1].textContent === '183'");
  await screenshot('after/scores-mobile.png');
  await click('[data-sort="seconds"]');
  await check('Time filter and hour format work', "scoresList.rows[0].cells[4].textContent === '01:01:01'");
  await click('[data-sort="kills"]');
  await check('Kills filter works', "scoresList.rows[0].cells[2].textContent === '12'");
  await click('[data-sort="soldiers"]');
  await check('Soldiers filter works', "scoresList.rows[0].cells[3].textContent === '18'");
  await check('Missing historical fields remain unknown', "[...scoresList.rows].some(r=>r.cells[1].textContent==='90' && r.cells[2].textContent==='—' && r.cells[4].textContent==='—')");
  await click('#scoresBackBtn');
  await click('#settingsBtn');
  await click('#reduceEffects');
  await check('Settings really enable reduced effects', 'preferences.reduceEffects && appEl.classList.contains("reduce-effects") && JSON.parse(localStorage.getItem(preferencesKey)).reduceEffects');
  await screenshot('after/settings-mobile.png');
  await navigate('/?reload=1');
  await check('Preferences persist after reload', 'preferences.skipTutorial && preferences.reduceEffects');
  await click('#startBtn');
  await check('Returning player skips tutorial', 'running && !activeScreen');
  await evaluate('stopAnimation(); state.score=200; state.elapsed=20; gameOver()');
  await check('New record compares against previous best', "document.querySelector('#recordMessage').textContent.includes('17 puntos') && document.querySelector('#bestScore').textContent === '200 pts'");
  await click('#replayBtn');
  await evaluate('stopAnimation(); state.score=200; gameOver()');
  await check('Tied record has distinct message', "document.querySelector('#recordMessage').textContent.includes('Igualaste')");
  await click('#gameOverMenuBtn');
  await evaluate('window.originalClose=window.close; window.close=()=>{}');
  await click('#exitBtn');
  await check('Browser exit explains closing the tab', 'activeScreen === menuScreen && exitMessageEl.textContent.includes("cerrar esta pestaña")');
  await evaluate('window.close=window.originalClose');

  for (const [width,height] of [[320,568],[390,844],[768,1024],[1366,900],[844,390]]) {
    await viewport(width,height);
    await evaluate('returnToMenu()');
    await check(`Menu fits width ${width}x${height}`, 'document.documentElement.scrollWidth <= innerWidth && menuScreen.scrollWidth <= menuScreen.clientWidth + 1');
    await screenshot(`after/menu-${width}x${height}.png`);
    await evaluate('startGame(); stopAnimation(); draw()');
    await check(`Playable canvas and visible controls ${width}x${height}`, 'canvas.clientHeight >= 180 && canvas.clientWidth >= 250 && document.querySelector(".controls").getBoundingClientRect().bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth');
    if (width < 621) await check(`Touch targets at least 44px ${width}x${height}`, '[damageUpgradeBtn,rateUpgradeBtn,healthUpgradeBtn,leftBtn,rightBtn,pauseBtn].every(b=>b.getBoundingClientRect().height>=44)');
    await screenshot(`after/game-${width}x${height}.png`);
    await evaluate('state.score=35366; state.soldiers=18; state.allyCharge=720; state.allyUnlocked=true; state.health=7; state.maxHealth=7; updateHud(); draw()');
    await check(`HUD fits historical high score and full ally ${width}x${height}`, '[...document.querySelectorAll(".stat strong")].every(e=>e.scrollWidth<=e.clientWidth+1)');
    if (width === 320) await screenshot('after/game-highscore-320x568.png');
    await evaluate('pauseGame()');
    await click('#pauseTutorialBtn');
    await check(`Tutorial has no horizontal overflow ${width}x${height}`, 'tutorialScreen.scrollWidth <= tutorialScreen.clientWidth + 1');
    await screenshot(`after/tutorial-${width}x${height}.png`);
  }
  await evaluate('returnToMenu()');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await check('System reduced-motion preference respected', 'reducedEffects()');
  await evaluate('localStorage.setItem(scoreKey,"not-json")');
  await click('#scoresBtn');
  await check('Malformed score storage shows empty state', 'loadScores().length === 0 && !document.querySelector("#scoresEmpty").hidden');
  await evaluate('localStorage.setItem(scoreKey,"{}")');
  await check('Unexpected score storage shape is handled', 'loadScores().length === 0');
  if (mobileAudio) {
    const { runMobileAudioChecks } = await import('./mobile-audio-cases.mjs');
    await runMobileAudioChecks({ call, evaluate, check, click, key, viewport, navigate, screenshot, delay });
  }
  await evaluate('returnToMenu(); startGame(); stopAnimation(); Object.defineProperty(Storage.prototype,"setItem",{configurable:true,value(){throw new Error("test storage denial")}}); state.score=25; gameOver()');
  await check('Unavailable storage preserves result in session', 'loadScores().some(s=>s.score===25) && !document.querySelector("#storageMessage").hidden');
  await check('No runtime or console errors', JSON.stringify(errors.length === 0));
  await mkdir(evidence, { recursive:true });
  await writeFile(resolve(evidence,'browser-results.json'), JSON.stringify({ browser:'Chrome headless via CDP', date:new Date().toISOString(), fixtures:'Scores and combat scenarios are injected into an isolated test profile. Screenshots are actual application renders, not wireframes.', results, errors },null,2));
  console.log(`${results.length} checks passed. Screenshots: ${evidence}`);
} catch (error) {
  console.error(error);
  await writeFile(resolve(evidence,'browser-results.json'), JSON.stringify({ results, errors, failure:String(error) },null,2));
  process.exitCode=1;
} finally {
  if (socket) socket.close();
  chrome.kill();
  server.close();
}
