const FIELD_MIN = 90;
const FIELD_MAX = 620;
const CATCH_ON = 0.72;
const CATCH_OFF = 0.48;

const state = {
  frame: {
    alwaysOnTop: false
  },
  audio: null,
  running: false,
  frozen: false,
  tick: 0,
  lastStepAt: 0,
  animationId: null,
  tempo: 108,
  gearMix: 0.72,
  fieldMix: 0.42,
  fieldMode: 'stepped',
  fieldStepIndex: 0,
  fieldSteps: [-5, 0, 4, 7],
  fieldFrequency: 180,
  gears: [
    { id: 'A', teeth: 11, speed: 1, phase: 0.05, tone: 180, voice: 'sine', lastTooth: -1 },
    { id: 'B', teeth: 7, speed: 0.63, phase: 0.31, tone: 247, voice: 'triangle', lastTooth: -1 },
    { id: 'C', teeth: 13, speed: 1.37, phase: 0.72, tone: 330, voice: 'square', lastTooth: -1 }
  ],
  connectors: [
    { id: 'A:B', from: 'A', to: 'B', distance: 0.58, slip: 0.18, conductivity: 0.7, coherence: 0, caught: false },
    { id: 'B:C', from: 'B', to: 'C', distance: 0.36, slip: 0.09, conductivity: 0.82, coherence: 0, caught: false }
  ]
};

async function boot() {
  await bootFrame();
  await bootRuntime();
  bootControls();
  renderAll();
  pushLog('tone shell armed');
}

async function bootRuntime() {
  const services = await window.aura.listServices();
  const readiness = await window.aura.invokeService('seed.readiness');

  setText('health', readiness.ok ? 'Ready' : 'Blocked');
  setText('commands', String(services.length));

  const list = byId('service-list');
  list.textContent = '';
  for (const service of services) {
    const item = document.createElement('li');
    const command = document.createElement('strong');
    command.textContent = service.command;
    const classification = document.createElement('span');
    classification.textContent = service.classification;
    item.append(command, classification);
    list.appendChild(item);
  }
}

async function bootFrame() {
  if (!window.auraWindow) {
    return;
  }
  state.frame = await window.auraWindow.getState();
  renderFrameState();
  byId('pin-window').addEventListener('click', toggleAlwaysOnTop);
  byId('minimize-window').addEventListener('click', () => window.auraWindow.minimize());
  byId('close-window').addEventListener('click', () => {
    stopTone();
    window.auraWindow.close();
  });
}

function bootControls() {
  byId('transport-toggle').addEventListener('click', toggleTransport);
  byId('randomize-patch').addEventListener('click', randomizePatch);
  byId('freeze-patch').addEventListener('click', toggleFreeze);
  document.querySelectorAll('[data-field-mode]').forEach((button) => {
    button.addEventListener('click', () => setFieldMode(button.dataset.fieldMode));
  });
  state.fieldSteps.forEach((_step, index) => bindFieldStep(index));
  bindRange('tempo-control', (value) => {
    state.tempo = value;
    setText('tempo-value', `${Math.round(value)} bpm`);
  });
  bindRange('field-mix-control', (value) => {
    state.fieldMix = value / 100;
    setText('field-mix-value', `${Math.round(value)}%`);
    updateFieldGain();
  });
  bindRange('gear-mix-control', (value) => {
    state.gearMix = value / 100;
    setText('gear-mix-value', `${Math.round(value)}%`);
  });
}

async function toggleTransport() {
  if (state.running) {
    stopTone();
    return;
  }
  await startTone();
}

async function startTone() {
  ensureAudio();
  await state.audio.context.resume();
  state.running = true;
  state.lastStepAt = performance.now();
  byId('transport-toggle').textContent = 'Stop';
  byId('transport-toggle').classList.add('is-running');
  setText('transport-state', 'Running');
  pushLog('transport started');
  startField();
  state.animationId = requestAnimationFrame(tick);
}

function stopTone() {
  state.running = false;
  byId('transport-toggle').textContent = 'Start';
  byId('transport-toggle').classList.remove('is-running');
  setText('transport-state', 'Idle');
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }
  stopField();
  pushLog('transport stopped');
}

function tick(now) {
  if (!state.running) {
    return;
  }
  const stepMs = 60000 / state.tempo / 4;
  if (now - state.lastStepAt >= stepMs) {
    const elapsedSteps = Math.floor((now - state.lastStepAt) / stepMs);
    state.lastStepAt += elapsedSteps * stepMs;
    advanceMachine(elapsedSteps);
    renderAll();
  }
  state.animationId = requestAnimationFrame(tick);
}

function advanceMachine(steps) {
  state.tick += steps;
  const highHits = new Set();
  for (const gear of state.gears) {
    const previousTooth = gear.lastTooth;
    gear.phase = wrap01(gear.phase + steps * gear.speed / gear.teeth);
    const tooth = Math.floor(gear.phase * gear.teeth);
    if (tooth !== previousTooth) {
      gear.lastTooth = tooth;
      triggerGear(gear, tooth);
      if (tooth === 0) {
        highHits.add(gear.id);
      }
    }
  }
  const catches = updateConnectors({ detectCatch: true, highHits });
  for (const connector of catches) {
    advanceFieldStep(connector.id);
  }
  updateFieldTone();
}

function triggerGear(gear, tooth) {
  if (!state.audio) {
    return;
  }
  const context = state.audio.context;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const accent = tooth === 0 ? 1.35 : 1;
  osc.type = gear.voice;
  osc.frequency.setValueAtTime(gear.tone * accent, now);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(gear.tone * 3, now);
  filter.Q.setValueAtTime(5, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16 * state.gearMix, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(state.audio.master);
  osc.start(now);
  osc.stop(now + 0.13);
  pushLog(`gear ${gear.id} tooth ${pad(tooth, 2)} ${Math.round(gear.tone * accent)}Hz`);
}

function updateConnectors(options = {}) {
  const catches = [];
  for (const connector of state.connectors) {
    const from = findGear(connector.from);
    const to = findGear(connector.to);
    const spread = phaseSpread(from.phase, to.phase);
    const closeness = 1 - spread * 2;
    const pull = 1 - connector.distance;
    connector.coherence = clamp01((closeness * 0.7 + pull * connector.conductivity * 0.3) * (1 - connector.slip));
    if (options.detectCatch) {
      const highHit = options.highHits?.has(connector.from) || options.highHits?.has(connector.to);
      if (!connector.caught && connector.coherence >= CATCH_ON && highHit) {
        connector.caught = true;
        catches.push(connector);
      } else if (connector.caught && connector.coherence <= CATCH_OFF) {
        connector.caught = false;
      }
    }
  }
  return catches;
}

function updateFieldTone() {
  const coherence = averageCoherence();
  const target = fieldFrequencyForCoherence(coherence);
  state.fieldFrequency = target;
  if (!state.audio?.fieldOsc) {
    return;
  }
  const context = state.audio.context;
  const ramp = state.fieldMode === 'glide' ? 0.22 : 0.08;
  state.audio.fieldOsc.frequency.setTargetAtTime(target, context.currentTime, ramp);
  state.audio.fieldFilter.frequency.setTargetAtTime(260 + coherence * 1600, context.currentTime, 0.1);
  updateFieldGain();
}

function startField() {
  ensureAudio();
  if (state.audio.fieldOsc) {
    return;
  }
  const context = state.audio.context;
  const osc = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(state.fieldFrequency, context.currentTime);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(440, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(state.audio.master);
  state.audio.fieldOsc = osc;
  state.audio.fieldFilter = filter;
  state.audio.fieldGain = gain;
  osc.start();
  updateFieldGain();
}

function stopField() {
  const audio = state.audio;
  if (!audio?.fieldOsc) {
    return;
  }
  const now = audio.context.currentTime;
  audio.fieldGain.gain.setTargetAtTime(0.0001, now, 0.03);
  audio.fieldOsc.stop(now + 0.12);
  audio.fieldOsc = null;
  audio.fieldFilter = null;
  audio.fieldGain = null;
}

function updateFieldGain() {
  if (!state.audio?.fieldGain) {
    return;
  }
  const target = state.running ? Math.max(0.0001, state.fieldMix * 0.08) : 0.0001;
  state.audio.fieldGain.gain.setTargetAtTime(target, state.audio.context.currentTime, 0.04);
}

function ensureAudio() {
  if (state.audio) {
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.72;
  master.connect(context.destination);
  state.audio = {
    context,
    master,
    fieldOsc: null,
    fieldFilter: null,
    fieldGain: null
  };
}

function randomizePatch() {
  if (state.frozen) {
    pushLog('patch frozen; mutate ignored');
    return;
  }
  const teeth = [5, 7, 9, 11, 13, 15, 17];
  const tones = [147, 165, 180, 220, 247, 294, 330, 392];
  state.gears.forEach((gear, index) => {
    gear.teeth = pick(teeth);
    gear.speed = round(0.45 + Math.random() * 1.25, 2);
    gear.phase = Math.random();
    gear.tone = tones[(index * 2 + Math.floor(Math.random() * tones.length)) % tones.length];
    gear.lastTooth = -1;
  });
  state.connectors.forEach((connector) => {
    connector.distance = round(0.2 + Math.random() * 0.65, 2);
    connector.slip = round(Math.random() * 0.28, 2);
    connector.conductivity = round(0.45 + Math.random() * 0.5, 2);
    connector.caught = false;
  });
  updateConnectors();
  updateFieldTone();
  renderAll();
  pushLog('patch mutated');
}

function setFieldMode(mode) {
  if (!['stepped', 'glide', 'constant'].includes(mode)) {
    return;
  }
  state.fieldMode = mode;
  document.querySelectorAll('[data-field-mode]').forEach((button) => {
    const active = button.dataset.fieldMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  setText('field-mode', mode);
  updateFieldTone();
  renderField();
  pushLog(`field ${mode}`);
}

function advanceFieldStep(source) {
  state.fieldStepIndex = (state.fieldStepIndex + 1) % state.fieldSteps.length;
  pushLog(`catch ${source} -> field step ${state.fieldStepIndex + 1} ${signedStep(state.fieldSteps[state.fieldStepIndex])}`);
}

function bindFieldStep(index) {
  const input = byId(`field-step-${index}`);
  const update = () => {
    state.fieldSteps[index] = Number(input.value);
    renderFieldSteps();
    updateFieldTone();
    renderField();
  };
  input.addEventListener('input', update);
  update();
}

function toggleFreeze() {
  state.frozen = !state.frozen;
  const button = byId('freeze-patch');
  button.classList.toggle('active', state.frozen);
  button.setAttribute('aria-pressed', String(state.frozen));
  setText('patch-state', state.frozen ? 'patch frozen' : 'patch mutable');
  pushLog(state.frozen ? 'patch frozen' : 'patch mutable');
}

function renderAll() {
  updateConnectors();
  updateFieldTone();
  renderGears();
  renderConnectors();
  renderField();
  renderFieldSteps();
  setText('tick-readout', `tick ${pad(state.tick, 4)}`);
  setText('coherence-readout', `coh ${Math.round(averageCoherence() * 100)}%`);
}

function renderGears() {
  const list = byId('gear-list');
  list.replaceChildren(...state.gears.map((gear) => {
    const item = document.createElement('article');
    item.className = 'gear-row';
    item.append(
      textBlock('strong', gear.id),
      textBlock('code', `[${gearRing(gear)}]`),
      textBlock('span', `${gear.teeth}t`),
      textBlock('span', `x${gear.speed.toFixed(2)}`),
      textBlock('span', `${gear.tone}Hz`)
    );
    return item;
  }));
}

function gearRing(gear) {
  const slots = 16;
  const phaseIndex = Math.floor(gear.phase * slots);
  const marks = Math.max(3, Math.min(8, Math.round(gear.teeth / 2)));
  return Array.from({ length: slots }, (_slot, index) => {
    if (index === phaseIndex) return '@';
    return Math.round(index * marks / slots) !== Math.round((index + 1) * marks / slots) ? '#' : '.';
  }).join('');
}

function renderConnectors() {
  const list = byId('connector-list');
  list.replaceChildren(...state.connectors.map((connector) => {
    const item = document.createElement('article');
    item.className = 'connector-row';
    const bar = document.createElement('div');
    bar.className = 'connector-bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.round(connector.coherence * 100)}%`;
    bar.appendChild(fill);
    const coherence = textBlock('span', `coh ${Math.round(connector.coherence * 100)}%`);
    const controls = document.createElement('div');
    controls.className = 'connector-controls';
    controls.append(
      connectorRange(connector, 'distance', 'dist', 0, 1, 0.01, () => refreshConnectorRow(connector, fill, coherence)),
      connectorRange(connector, 'slip', 'slip', 0, 0.5, 0.01, () => refreshConnectorRow(connector, fill, coherence))
    );
    item.append(
      textBlock('strong', connector.id),
      bar,
      coherence,
      controls
    );
    return item;
  }));
}

function connectorRange(connector, key, label, min, max, step, onInput) {
  const control = document.createElement('label');
  control.className = 'connector-control';
  const caption = document.createElement('span');
  caption.textContent = `${label} ${Math.round(connector[key] * 100)}%`;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(connector[key]);
  input.addEventListener('input', () => {
    connector[key] = Number(input.value);
    caption.textContent = `${label} ${Math.round(connector[key] * 100)}%`;
    onInput();
  });
  control.append(caption, input);
  return control;
}

function refreshConnectorRow(connector, fill, coherence) {
  updateConnectors();
  updateFieldTone();
  fill.style.width = `${Math.round(connector.coherence * 100)}%`;
  coherence.textContent = `coh ${Math.round(connector.coherence * 100)}%`;
  setText('coherence-readout', `coh ${Math.round(averageCoherence() * 100)}%`);
  renderField();
}

function renderField() {
  const coherence = averageCoherence();
  setText('field-frequency', `${Math.round(state.fieldFrequency)} Hz`);
  byId('field-meter-fill').style.width = `${Math.round(coherence * 100)}%`;
}

function fieldFrequencyForCoherence(coherence) {
  const stepOffset = state.fieldSteps[state.fieldStepIndex] || 0;
  const stepMultiplier = 2 ** (stepOffset / 12);
  let base;
  if (state.fieldMode === 'constant') {
    base = 220;
  } else if (state.fieldMode === 'glide') {
    base = FIELD_MIN + (FIELD_MAX - FIELD_MIN) * coherence;
  } else {
    const stepped = Math.round(coherence * 12) / 12;
    base = FIELD_MIN + (FIELD_MAX - FIELD_MIN) * stepped;
  }
  return clamp(base * stepMultiplier, FIELD_MIN / 2, FIELD_MAX * 2);
}

function renderFieldSteps() {
  state.fieldSteps.forEach((step, index) => {
    setText(`field-step-value-${index}`, signedStep(step));
    const cell = document.querySelector(`[data-field-step-cell="${index}"]`);
    cell?.classList.toggle('active', index === state.fieldStepIndex);
  });
}

async function toggleAlwaysOnTop() {
  const pin = byId('pin-window');
  pin.disabled = true;
  try {
    state.frame = await window.auraWindow.setAlwaysOnTop(!state.frame.alwaysOnTop);
    renderFrameState();
  } finally {
    pin.disabled = false;
  }
}

function renderFrameState() {
  const pin = byId('pin-window');
  pin.classList.toggle('active', state.frame.alwaysOnTop === true);
  pin.textContent = state.frame.alwaysOnTop ? 'Pinned' : 'Pin';
}

function pushLog(message) {
  const list = byId('event-log');
  const item = document.createElement('li');
  item.textContent = `${pad(state.tick, 4)} ${message}`;
  list.prepend(item);
  while (list.children.length > 8) {
    list.lastElementChild.remove();
  }
}

function bindRange(id, onChange) {
  const input = byId(id);
  const update = () => onChange(Number(input.value));
  input.addEventListener('input', update);
  update();
}

function averageCoherence() {
  return state.connectors.reduce((total, connector) => total + connector.coherence, 0) / state.connectors.length;
}

function findGear(id) {
  return state.gears.find((gear) => gear.id === id);
}

function phaseSpread(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 1 - diff);
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function signedStep(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

function textBlock(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function setText(id, value) {
  byId(id).textContent = value == null ? '' : String(value);
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing renderer element: ${id}`);
  }
  return element;
}

boot().catch((error) => {
  setText('health', error.message);
});
