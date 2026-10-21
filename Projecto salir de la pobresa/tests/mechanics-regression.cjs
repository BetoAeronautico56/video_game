// Deterministic comparison with the pre-redesign engine, which has the same
// progression rules. Rendering and audio are inert; actual state is compared.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createContext, runInContext } = require('node:vm');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '..');
function engine(file, seed) {
  const elements = new Map();
  const gradient = { addColorStop() {} };
  const drawing = new Proxy({}, { get: (target, key) => key === 'createLinearGradient' ? () => gradient : typeof target[key] === 'undefined' ? () => {} : target[key] });
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      id, textContent: '', hidden: false, value: 0, max: 3, dataset: {}, style: {},
      clientWidth: 390, clientHeight: 600,
      classList: { toggle() {}, add() {}, remove() {} },
      getContext: () => drawing, getBoundingClientRect: () => ({ width:390, height:600 }),
      getAttribute: () => null, setAttribute() {}, focus() {}, addEventListener() {},
      append() {}, replaceChildren() {},
    });
    return elements.get(id);
  };
  let random = seed;
  const math = Object.create(Math);
  math.random = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
  const storage = new Map();
  class SilentAudio { setOptions() {} setScene() {} setBlocked() {} play() {} soldiersChanged() {} }
  const context = createContext({
    Math: math, Intl, console, AudioManager: SilentAudio,
    window: { matchMedia: () => ({ matches:false, addEventListener() {} }), addEventListener() {}, devicePixelRatio:1 },
    document: { querySelector: element, querySelectorAll: () => [], addEventListener() {}, hasFocus: () => true, hidden:false, createElement: element },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key,value) => storage.set(key,value) },
    performance: { now: () => 1000 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout, clearTimeout,
  });
  runInContext(readFileSync(resolve(root,file),'utf8'),context);
  return (expression) => runInContext(expression,context);
}
const baseline = 'docs/ux-ui-redesign/before-source/game.js';
const scenarios = [
  'startGame(); stopAnimation(); for(let i=0;i<4000 && running;i++){ if(i%37===0)move((i%74===0)?-1:1); update(0.033); }',
  'startGame(); stopAnimation(); state.coins=999999; for(const k of ["damage","rate","health"])for(let i=0;i<10;i++)buyUpgrade(k); for(let i=0;i<400 && running;i++)update(0.033);',
  'startGame(); stopAnimation(); state.soldiers=17; state.lane=0; state.pickups=[{lane:0,y:playerY(),kind:"soldier",amount:2,speed:0,size:30}]; handleCollisions(); spawnPickup(); state.allyCharge=719; hitAlly({y:0,damage:1}); takeDamage({type:"captain",lane:1}); shoot();',
  'startGame(); stopAnimation(); for(const score of [0,500,1200]){state.score=score;activatePower();updatePower(2);shoot();} pauseGame(); resumeGame(); stopAnimation();',
];
let count = 0;
for (const seed of [1,42,2026,9001]) for (const scenario of scenarios) {
  const before = engine(baseline,seed);
  const after = engine('game.js',seed);
  const result = scenario + '; JSON.stringify({state,running,paused,spawnClock,rewardClock});';
  assert.equal(after(result), before(result), `Engine state differs, seed ${seed}, scenario ${count}`);
  count++;
}
console.log(`${count} deterministic engine comparisons passed; movement, combat, progression, rewards and timing unchanged.`);
