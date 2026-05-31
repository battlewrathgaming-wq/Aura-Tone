const state = {
  frame: {
    alwaysOnTop: false
  }
};

async function boot() {
  await bootFrame();
  const services = await window.aura.listServices();
  const readiness = await window.aura.invokeService('seed.readiness');

  document.querySelector('#health').textContent = readiness.ok ? 'Ready' : 'Blocked';
  document.querySelector('#commands').textContent = String(services.length);

  const list = document.querySelector('#service-list');
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
  document.querySelector('#pin-window').addEventListener('click', toggleAlwaysOnTop);
  document.querySelector('#minimize-window').addEventListener('click', () => window.auraWindow.minimize());
  document.querySelector('#close-window').addEventListener('click', () => window.auraWindow.close());
}

async function toggleAlwaysOnTop() {
  const pin = document.querySelector('#pin-window');
  pin.disabled = true;
  try {
    state.frame = await window.auraWindow.setAlwaysOnTop(!state.frame.alwaysOnTop);
    renderFrameState();
  } finally {
    pin.disabled = false;
  }
}

function renderFrameState() {
  const pin = document.querySelector('#pin-window');
  pin.classList.toggle('active', state.frame.alwaysOnTop === true);
  pin.textContent = state.frame.alwaysOnTop ? 'Pinned' : 'Pin';
}

boot().catch((error) => {
  document.querySelector('#health').textContent = error.message;
});
