import process from 'node:process';
import { writeFile } from 'node:fs/promises';

const port = Number(process.argv[2] ?? 9334);
const screenshotPath = process.argv[3]?.startsWith('--')
  ? null
  : process.argv[3] ?? null;
const testNetworkFallback =
  process.argv.includes('--network');
const testIpIntelligence =
  process.argv.includes('--ip');
const testCleanMap =
  process.argv.includes('--clean-map');

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('Informe uma porta CDP válida.');
}

async function wait(milliseconds) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function discoverTarget() {
  const response = await fetch(
    `http://127.0.0.1:${port}/json`,
  );
  const targets = await response.json();
  const target = targets.find(
    (candidate) =>
      candidate.type === 'page' &&
      typeof candidate.webSocketDebuggerUrl === 'string',
  );

  if (!target) {
    throw new Error('Renderer Electron não encontrado.');
  }

  return target;
}

const target = await discoverTarget();
const socket = new WebSocket(
  target.webSocketDebuggerUrl,
);
const pending = new Map();
const failures = [];
const consoleErrors = [];
let nextId = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, {
    once: true,
  });
  socket.addEventListener('error', reject, {
    once: true,
  });
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (typeof message.id === 'number') {
    const request = pending.get(message.id);
    if (!request) {
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      request.reject(new Error(message.error.message));
    } else {
      request.resolve(message.result);
    }
    return;
  }

  if (message.method === 'Runtime.exceptionThrown') {
    failures.push(
      message.params?.exceptionDetails?.text ??
        'Exceção desconhecida no renderer.',
    );
  }

  if (
    message.method === 'Runtime.consoleAPICalled' &&
    message.params?.type === 'error'
  ) {
    consoleErrors.push(
      message.params.args
        .map((argument) => argument.value ?? argument.description ?? '')
        .join(' '),
    );
  }
});

function command(method, params = {}) {
  const id = ++nextId;

  return new Promise((resolve, reject) => {
    pending.set(id, { reject, resolve });
    socket.send(JSON.stringify({
      id,
      method,
      params,
    }));
  });
}

async function evaluate(expression) {
  const response = await command(
    'Runtime.evaluate',
    {
      awaitPromise: true,
      expression,
      returnByValue: true,
    },
  );

  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.text ??
        'Falha ao avaliar expressão no renderer.',
    );
  }

  return response.result?.value;
}

async function waitForSelector(selector, timeout = 15_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const found = await evaluate(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    );
    if (found) {
      return;
    }
    await wait(100);
  }

  throw new Error(`Elemento não encontrado: ${selector}`);
}

async function waitForExpression(expression, timeout = 15_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await evaluate(expression)) {
      return;
    }
    await wait(100);
  }

  throw new Error(`Condição não atendida: ${expression}`);
}

async function clickAt(x, y, modifiers = 0) {
  await command('Input.dispatchMouseEvent', {
    button: 'left',
    buttons: 1,
    clickCount: 1,
    modifiers,
    type: 'mousePressed',
    x,
    y,
  });
  await command('Input.dispatchMouseEvent', {
    button: 'left',
    buttons: 0,
    clickCount: 1,
    modifiers,
    type: 'mouseReleased',
    x,
    y,
  });
}

await command('Runtime.enable');
await command('Page.enable');
await waitForSelector('#root');

const setupVisible = await evaluate(
  "Boolean(document.querySelector('.authSetupCard'))",
);
let generatedUnlockPassword = null;

if (setupVisible) {
  const nonce = Date.now().toString(36);
  const primaryPassword = `Smoke${nonce}A9`;
  const unlockPassword = `Unlock${nonce}B7`;
  generatedUnlockPassword = unlockPassword;
  await evaluate(`(() => {
    const primary = ${JSON.stringify(primaryPassword)};
    const unlock = ${JSON.stringify(unlockPassword)};
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set;
    for (const input of document.querySelectorAll('.authSetupCard input')) {
      setter.call(
        input,
        input.name.includes('unlock') ? unlock : primary,
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('.authSetupCard form').requestSubmit();
  })()`);
}

await waitForSelector('.mapWorkspaceShell', 25_000);
await waitForSelector('.maplibregl-canvas', 25_000);

const workspace = await evaluate(`(() => ({
  canvasCount: document.querySelectorAll('.maplibregl-canvas').length,
  dialogCount: document.querySelectorAll('[role="dialog"]').length,
  title: document.title,
}))()`);

let ipIntelligence = null;
if (testIpIntelligence) {
  await evaluate(
    "document.querySelector('[aria-label=\"Abrir IP Intelligence\"]')?.click()",
  );
  await waitForSelector('.ipGeolocationPanel');
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.ipGeolocationSearch button')]
      .find((candidate) => candidate.textContent.trim() === 'Meu IP público');
    button?.click();
  })()`);
  await waitForExpression(
    "document.querySelector('.ipGeolocationPanel')?.getAttribute('aria-busy') === 'false' && document.querySelectorAll('.ipPublicFamilyStatuses span').length === 2",
    35_000,
  );
  const publicIpState = await evaluate(`(() => ({
    familyStatuses: [...document.querySelectorAll('.ipPublicFamilyStatuses span')]
      .map((status) => status.textContent.trim()),
    resultCount: document.querySelectorAll('.ipGeolocationResultTabs button').length,
  }))()`);
  const filterCounts = {};
  for (const label of ['Todos', 'IPv4', 'IPv6']) {
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('.ipGeolocationVersionFilters button')]
        .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)});
      button?.click();
    })()`);
    await wait(50);
    filterCounts[label] = await evaluate(
      "document.querySelectorAll('.ipGeolocationResultTabs button').length",
    );
  }
  await evaluate(`(() => {
    const input = document.querySelector('.ipGeolocationSearch input');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set;
    setter.call(input, '8.8.8.8');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.ipGeolocationSearch form')?.requestSubmit();
    input.closest('form')?.requestSubmit();
  })()`);
  await waitForExpression(
    "document.querySelector('.ipGeolocationPanel')?.getAttribute('aria-busy') === 'false'",
    25_000,
  );
  await evaluate(`(() => {
    const input = document.querySelector('.ipGeolocationSearch input');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set;
    setter.call(input, '127.0.0.1');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('form')?.requestSubmit();
  })()`);
  await wait(100);
  const privateIpRejected = await evaluate(
    "Boolean(document.querySelector('.ipGeolocationFeedback[role=\"alert\"]'))",
  );
  ipIntelligence = {
    filterCounts,
    privateIpRejected,
    publicIpState,
  };
  await evaluate(
    "document.querySelector('[aria-label=\"Minimizar IP Intelligence\"]')?.click()",
  );
}

const canvasBounds = await evaluate(`(() => {
  const bounds = document.querySelector('.maplibregl-canvas').getBoundingClientRect();
  return {
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
  };
})()`);
const initialMarkerCount = await evaluate(
  "document.querySelectorAll('.coordinateLocationMarker').length",
);
await evaluate(`(() => {
  for (const marker of document.querySelectorAll('.coordinateLocationMarker')) {
    marker.dataset.smokeExisting = 'true';
  }
})()`);
await evaluate(`(() => {
  document.querySelector(
    'button[aria-pressed="true"][aria-label*="rotação automática"]',
  )?.click();
})()`);
await waitForExpression(
  "!document.querySelector('button[aria-pressed=\"true\"][aria-label*=\"rotação automática\"]')",
);
await wait(600);
const markerCandidates = [
  [0, 0],
  [0, -42],
  [38, -22],
  [-32, 28],
  [32, 28],
  [-45, 8],
  [45, 8],
  [0, 44],
  [0, -72],
  [-68, 48],
  [68, 48],
].map(([offsetX, offsetY]) => ({
  x: Math.round(
    canvasBounds.left + canvasBounds.width / 2 + offsetX,
  ),
  y: Math.round(
    canvasBounds.top + canvasBounds.height / 2 + offsetY,
  ),
}));

const markerTargets = [];
let observedMarkerCount = initialMarkerCount;
for (const targetPoint of markerCandidates) {
  await clickAt(targetPoint.x, targetPoint.y, 2);
  await wait(120);
  const nextMarkerCount = await evaluate(
    "document.querySelectorAll('.coordinateLocationMarker').length",
  );
  if (nextMarkerCount > observedMarkerCount) {
    markerTargets.push(targetPoint);
    observedMarkerCount = nextMarkerCount;
  }
  await evaluate(
    "document.querySelector('[aria-label=\"Fechar detalhes do marcador\"]')?.click()",
  );
  if (markerTargets.length === 5) {
    break;
  }
}
await wait(400);

const markerState = await evaluate(`(() => ({
  count: document.querySelectorAll('.coordinateLocationMarker').length,
  centers: [...document.querySelectorAll('.coordinateLocationMarker')]
    .filter((marker) => marker.dataset.smokeExisting !== 'true')
    .map((marker) => {
    const bounds = marker.getBoundingClientRect();
    return {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
  }),
  initialScale: Number.parseFloat(
    document.querySelector('.maplibregl-map').style.getPropertyValue('--coordinate-marker-scale'),
  ),
}))()`);
markerState.addedCount =
  markerState.count - initialMarkerCount;
const alignmentErrors = await evaluate(`(() => {
  const containerBounds = document.querySelector(
    '.maplibregl-canvas-container',
  ).getBoundingClientRect();
  return [...document.querySelectorAll('.coordinateLocationMarker')]
    .filter((marker) => marker.dataset.smokeExisting !== 'true')
    .map((marker) => {
      const match = marker.style.transform.match(
        /translate\\(([-+0-9.e]+)px,\\s*([-+0-9.e]+)px\\)/,
      );
      if (!match) {
        return 10_000;
      }
      const bounds = marker.getBoundingClientRect();
      return Math.hypot(
        bounds.left + bounds.width / 2 - (
          containerBounds.left + Number.parseFloat(match[1])
        ),
        bounds.top + bounds.height / 2 - (
          containerBounds.top + Number.parseFloat(match[2])
        ),
      );
    });
})()`);
let cleanMap = null;
if (testCleanMap) {
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'rawKeyDown',
    windowsVirtualKeyCode: 113,
  });
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'keyUp',
  });
  await waitForExpression(
    "document.querySelector('.mapWorkspaceShell')?.dataset.cleanMapMode === 'true'",
  );
  const hiddenState = await evaluate(`(() => {
    const hiddenSelectors = [
      '.compactModuleRail',
      '.workspaceTopbar',
      '.workspaceSearch',
      '.topRightControls',
      '.workspaceModeNavigation',
      '.worldGlobeHud',
      '.worldGlobeTools',
    ];
    return {
      allChromeHidden: hiddenSelectors.every((selector) => (
        document.querySelector(selector) &&
        document.querySelector(selector).getClientRects().length === 0
      )),
      attributionVisible: getComputedStyle(
        document.querySelector('.detailedBasemapAttribution'),
      ).display !== 'none',
      canvasCount: document.querySelectorAll('.maplibregl-canvas').length,
    };
  })()`);
  const cleanMarkerCenter = await evaluate(`(() => {
    const marker = [...document.querySelectorAll('.coordinateLocationMarker')]
      .find((item) => item.dataset.smokeExisting !== 'true');
    const bounds = marker.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  })()`);
  await clickAt(cleanMarkerCenter.x, cleanMarkerCenter.y);
  await waitForSelector('.mapMarkerDetailsPopover');
  const markerPopoverInteractive = await evaluate(
    "getComputedStyle(document.querySelector('.mapMarkerDetailsPopover')).display !== 'none'",
  );
  await evaluate(
    "document.querySelector('[aria-label=\"Fechar detalhes do marcador\"]')?.click()",
  );
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'rawKeyDown',
    windowsVirtualKeyCode: 113,
  });
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'keyUp',
  });
  await waitForExpression(
    "document.querySelector('.mapWorkspaceShell')?.dataset.cleanMapMode === 'false'",
  );
  const restored = await evaluate(`(() => ({
    controlsVisible: getComputedStyle(
      document.querySelector('.worldGlobeTools'),
    ).display !== 'none',
    railVisible: getComputedStyle(
      document.querySelector('.compactModuleRail'),
    ).display !== 'none',
  }))()`);
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'rawKeyDown',
    windowsVirtualKeyCode: 113,
  });
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'keyUp',
  });
  await waitForExpression(
    "document.querySelector('.mapWorkspaceShell')?.dataset.cleanMapMode === 'true'",
  );
  await command('Input.dispatchKeyEvent', {
    code: 'Escape',
    key: 'Escape',
    type: 'rawKeyDown',
    windowsVirtualKeyCode: 27,
  });
  await command('Input.dispatchKeyEvent', {
    code: 'Escape',
    key: 'Escape',
    type: 'keyUp',
  });
  await waitForExpression(
    "document.querySelector('.mapWorkspaceShell')?.dataset.cleanMapMode === 'false'",
  );
  cleanMap = {
    escapeRestored: true,
    hiddenState,
    markerPopoverInteractive,
    restored,
  };
}
const centerPoint = markerTargets[1];
await command('Input.dispatchMouseEvent', {
  deltaX: 0,
  deltaY: -520,
  type: 'mouseWheel',
  x: centerPoint.x,
  y: centerPoint.y,
});
await wait(1_200);
const zoomedInScale = await evaluate(
  "Number.parseFloat(document.querySelector('.maplibregl-map').style.getPropertyValue('--coordinate-marker-scale'))",
);
await command('Input.dispatchMouseEvent', {
  deltaX: 0,
  deltaY: 900,
  type: 'mouseWheel',
  x: centerPoint.x,
  y: centerPoint.y,
});
await wait(1_200);
const zoomedOutScale = await evaluate(
  "Number.parseFloat(document.querySelector('.maplibregl-map').style.getPropertyValue('--coordinate-marker-scale'))",
);
const measurementUi = await evaluate(`(() => {
  document.querySelector('.mapMeasurementToggle')?.click();
  const panel = document.querySelector('.mapMeasurementPanel');
  const modes = [...panel.querySelectorAll('.mapMeasurementModes button')]
    .map((button) => button.textContent.trim());
  document.querySelector('.mapMeasurementToggle')?.click();
  return { modes };
})()`);

let mapFallback = null;
if (testNetworkFallback) {
  await command('Network.enable');
  await command('Network.setCacheDisabled', {
    cacheDisabled: true,
  });
  await command('Network.setBlockedURLs', {
    urls: ['*://tiles.openfreemap.org/*'],
  });
  await command('Network.emulateNetworkConditions', {
    connectionType: 'none',
    downloadThroughput: 0,
    latency: 0,
    offline: true,
    uploadThroughput: 0,
  });
  for (let index = 0; index < 7; index += 1) {
    await evaluate(
      "document.querySelector('[aria-label=\"Aproximar mapa\"]')?.click()",
    );
    await wait(260);
  }
  await wait(2_500);
  const offlineState = await evaluate(`(() => ({
    state: document.querySelector('.detailedBasemapAttribution')?.dataset.state,
    text: document.querySelector('.detailedBasemapAttribution')?.innerText.trim(),
  }))()`);
  await command('Network.emulateNetworkConditions', {
    connectionType: 'wifi',
    downloadThroughput: -1,
    latency: 0,
    offline: false,
    uploadThroughput: -1,
  });
  await command('Network.setBlockedURLs', {
    urls: [],
  });
  await evaluate(
    "document.querySelector('.detailedBasemapAttribution button')?.click()",
  );
  await wait(6_000);
  const recoveredState = await evaluate(`(() => ({
    state: document.querySelector('.detailedBasemapAttribution')?.dataset.state,
    text: document.querySelector('.detailedBasemapAttribution')?.innerText.trim(),
  }))()`);
  mapFallback = {
    offlineState,
    recoveredState,
  };
}

const layouts = [
  'tactical',
  'streets-dark',
  'streets-light',
];
const layoutStates = [];
for (const layout of layouts) {
  await evaluate(`(() => {
    const select = document.querySelector('.mapBasemapStyleControl select');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value',
    ).set;
    setter.call(select, ${JSON.stringify(layout)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(100);
  layoutStates.push(await evaluate(`(() => {
    const hiddenLabel = document.querySelector('.mapBasemapStyleControl .srOnly')
      .getBoundingClientRect();
    return {
      canvasCount: document.querySelectorAll('.maplibregl-canvas').length,
      hiddenLabelHeight: hiddenLabel.height,
      hiddenLabelWidth: hiddenLabel.width,
      value: document.querySelector('.mapBasemapStyleControl select').value,
    };
  })()`));
}

if (screenshotPath) {
  const capture = await command('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  await writeFile(
    screenshotPath,
    Buffer.from(capture.data, 'base64'),
  );
}

await command('Input.dispatchKeyEvent', {
  code: 'F1',
  key: 'F1',
  nativeVirtualKeyCode: 112,
  type: 'rawKeyDown',
  windowsVirtualKeyCode: 112,
});
await command('Input.dispatchKeyEvent', {
  code: 'F1',
  key: 'F1',
  type: 'keyUp',
});
await waitForSelector('.authMinimalCard');

if (testCleanMap) {
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'rawKeyDown',
    windowsVirtualKeyCode: 113,
  });
  await command('Input.dispatchKeyEvent', {
    code: 'F2',
    key: 'F2',
    modifiers: 8,
    type: 'keyUp',
  });
  await wait(100);
}

const lockState = await evaluate(`(() => ({
  cleanMapMode: document.querySelector('.mapWorkspaceShell')?.dataset.cleanMapMode,
  inputs: document.querySelectorAll('.authMinimalCard input').length,
  particles: document.querySelectorAll('.authLoginParticles').length,
  protectedInert: document.querySelector('.authProtectedContent')?.inert === true,
  labels: [
    document.querySelector('.authMinimalCard h1')?.textContent,
    ...[...document.querySelectorAll('.authMinimalCard label > span')]
      .map((element) => element.textContent),
    document.querySelector('.authMinimalCard .authSubmit')?.textContent,
  ].filter(Boolean),
}))()`);

let authSecurity = null;
if (generatedUnlockPassword) {
  const hostilePayloadRejected = await evaluate(
    "window.zeroHub.auth.unlock(null).then(() => false, () => true)",
  );
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await evaluate(`(() => {
      const input = document.querySelector('.authMinimalCard input');
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set;
      setter.call(input, 'senha-incorreta-de-smoke');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.authMinimalCard form').requestSubmit();
    })()`);
    await waitForExpression(
      "document.querySelector('.authMinimalCard')?.getAttribute('aria-busy') === 'false'",
      10_000,
    );
  }
  const limitedState = await evaluate(`(() => ({
    disabled: document.querySelector('.authMinimalCard .authSubmit')?.disabled,
    feedback: document.querySelector('.authMinimalCard .authFeedback')?.innerText.trim(),
  }))()`);
  await waitForExpression(
    "document.querySelector('.authMinimalCard .authSubmit')?.disabled === false",
    5_000,
  );
  authSecurity = {
    hostilePayloadRejected,
    limitedState,
  };
  await evaluate(`(() => {
    const input = document.querySelector('.authMinimalCard input');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set;
    setter.call(input, ${JSON.stringify(generatedUnlockPassword)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.authMinimalCard form').requestSubmit();
  })()`);
  await waitForExpression(
    "!document.querySelector('.authMinimalCard')",
    10_000,
  );
}

const unlockedAgain = generatedUnlockPassword
  ? await evaluate(
    "!document.querySelector('.authMinimalCard')",
  )
  : null;
const report = {
  alignmentErrors,
  authSecurity,
  cleanMap,
  consoleErrors,
  failures,
  ipIntelligence,
  lockState,
  layoutStates,
  mapFallback,
  markerState: {
    addedCount: markerState.addedCount,
    totalCount: markerState.count,
    initialScale: markerState.initialScale,
    zoomedInScale,
    zoomedOutScale,
  },
  measurementUi,
  setupVisible,
  unlockedAgain,
  workspace,
};

console.log(JSON.stringify(report, null, 2));
socket.close();

if (
  failures.length > 0 ||
  consoleErrors.length > 0 ||
  workspace.canvasCount !== 1 ||
  markerState.addedCount !== 5 ||
  alignmentErrors.some((error) => error > 1) ||
  !(
    zoomedInScale >= markerState.initialScale &&
    zoomedOutScale <= zoomedInScale
  ) ||
  !measurementUi.modes.includes('Área') ||
  layoutStates.some((state, index) => (
    state.canvasCount !== 1 ||
    state.hiddenLabelHeight > 1 ||
    state.hiddenLabelWidth > 1 ||
    state.value !== layouts[index]
  )) ||
  (
    testNetworkFallback &&
    (
      mapFallback?.offlineState.state !== 'unavailable' ||
      mapFallback?.recoveredState.state !== 'available'
    )
  ) ||
  lockState.inputs !== 1 ||
  lockState.particles !== 0 ||
  !lockState.protectedInert ||
  (
    testCleanMap &&
    (
      !cleanMap?.hiddenState.allChromeHidden ||
      !cleanMap.hiddenState.attributionVisible ||
      cleanMap.hiddenState.canvasCount !== 1 ||
      !cleanMap.markerPopoverInteractive ||
      !cleanMap.restored.controlsVisible ||
      !cleanMap.restored.railVisible ||
      !cleanMap.escapeRestored ||
      lockState.cleanMapMode !== 'false'
    )
  ) ||
  (
    authSecurity !== null &&
    (
      !authSecurity.hostilePayloadRejected ||
      authSecurity.limitedState.disabled !== true
    )
  ) ||
  (
    testIpIntelligence &&
    (
      ipIntelligence?.publicIpState.familyStatuses.length !== 2 ||
      ipIntelligence?.privateIpRejected !== true
    )
  ) ||
  unlockedAgain === false
) {
  process.exitCode = 1;
}
