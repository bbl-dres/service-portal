import { exitFullscreen, requestFullscreen } from '../js/ui/fullscreen.js';

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

let calls = 0;
const success = await requestFullscreen({ requestFullscreen: async () => { calls++; } });
check(success && calls === 1, 'a successful request resolves true exactly once');

let unavailable = 0;
const missing = await requestFullscreen({}, { onUnavailable: () => { unavailable++; } });
check(!missing && unavailable === 1, 'an unavailable API resolves false and notifies the caller');

const warnings = [];
const originalWarn = console.warn;
console.warn = (...parts) => warnings.push(parts.map(String).join(' '));
try {
  let rejected = 0;
  const denied = await requestFullscreen({
    requestFullscreen: () => Promise.reject(new Error('permission denied')),
  }, { source: 'probe', onRejected: () => { rejected++; } });
  check(!denied && rejected === 1, 'a rejected request resolves false and notifies the caller');

  let synchronous = 0;
  const thrown = await requestFullscreen({
    requestFullscreen: () => { throw new Error('detached element'); },
  }, { source: 'probe-sync', onRejected: () => { synchronous++; } });
  check(!thrown && synchronous === 1, 'a synchronous browser failure follows the rejection path');
} finally {
  console.warn = originalWarn;
}
check(warnings.length === 2 && warnings.every((line) => line.includes('fullscreen request failed')),
  'failures retain contextual diagnostics', warnings.join(' | '));

const noActiveFullscreen = await exitFullscreen({ documentObject: { fullscreenElement: null } });
check(noActiveFullscreen, 'exiting an inactive fullscreen state is a successful no-op');

let exits = 0;
const exited = await exitFullscreen({
  documentObject: { fullscreenElement: {}, exitFullscreen: async () => { exits++; } },
});
check(exited && exits === 1, 'a successful exit resolves true exactly once');

let unavailableExit = 0;
const missingExit = await exitFullscreen({
  documentObject: { fullscreenElement: {} }, onUnavailable: () => { unavailableExit++; },
});
check(!missingExit && unavailableExit === 1, 'an unavailable exit API resolves false and notifies the caller');

const exitWarnings = [];
console.warn = (...parts) => exitWarnings.push(parts.map(String).join(' '));
try {
  let rejectedExit = 0;
  const failedExit = await exitFullscreen({
    source: 'exit-probe',
    documentObject: { fullscreenElement: {}, exitFullscreen: () => Promise.reject(new Error('denied')) },
    onRejected: () => { rejectedExit++; },
  });
  check(!failedExit && rejectedExit === 1, 'a rejected exit resolves false and notifies the caller');
} finally {
  console.warn = originalWarn;
}
check(exitWarnings.length === 1 && exitWarnings[0].includes('fullscreen exit failed'),
  'exit failures retain contextual diagnostics', exitWarnings.join(' | '));

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
