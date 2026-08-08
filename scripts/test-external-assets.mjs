#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createExternalAssetLoader } from '../js/core/external-assets.js';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.parentNode = null;
    this.onload = null;
    this.onerror = null;
    this.removed = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  remove() {
    this.removed = true;
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }
}

class FakeHead {
  constructor() {
    this.children = [];
    this.history = [];
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    this.history.push(node);
    return node;
  }
}

class FakeDocument {
  constructor() {
    this.head = new FakeHead();
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

class FakeClock {
  constructor() {
    this.nextId = 1;
    this.timers = new Map();
  }

  setTimeout = (callback, delay) => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { callback, delay });
    return id;
  };

  clearTimeout = (id) => {
    this.timers.delete(id);
  };

  fireNext() {
    const entry = this.timers.entries().next().value;
    assert.ok(entry, 'a timeout is pending');
    const [id, timer] = entry;
    this.timers.delete(id);
    timer.callback();
  }
}

const TEST_INTEGRITY = `sha384-${'A'.repeat(64)}`;
const CONFIG = {
  key: 'example@1.2.3',
  globalName: 'ExampleLibrary',
  styles: [
    { url: 'https://cdn.example.test/one.css', integrity: TEST_INTEGRITY },
    { url: 'https://cdn.example.test/two.css', integrity: TEST_INTEGRITY },
  ],
  script: { url: 'https://cdn.example.test/library.js', integrity: TEST_INTEGRITY },
  timeoutMs: 25,
  messages: {
    timeout: 'timeout-message',
    style: 'style-message',
    script: 'script-message',
    global: 'global-message',
  },
};

function harness() {
  const document = new FakeDocument();
  const globalObject = {};
  const clock = new FakeClock();
  const load = createExternalAssetLoader({
    document,
    globalObject,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });
  return { document, globalObject, clock, load };
}

function assertCleaned(nodes, clock) {
  assert.ok(nodes.every((node) => node.removed), 'failed nodes are removed');
  assert.ok(nodes.every((node) => node.onload === null && node.onerror === null), 'failed handlers are cleared');
  assert.equal(clock.timers.size, 0, 'failed attempt clears its timeout');
}

{
  const { document, load } = harness();
  await assert.rejects(load({ ...CONFIG, script: { ...CONFIG.script, url: 'http://cdn.example.test/library.js' } }),
    /HTTPS URLs/);
  await assert.rejects(load({ ...CONFIG, styles: [{ ...CONFIG.styles[0], integrity: '' }] }),
    /SHA-384 integrity/);
  await assert.rejects(load({ ...CONFIG, script: { ...CONFIG.script, integrity: 'sha384-short' } }),
    /SHA-384 integrity/);
  await assert.rejects(load({ ...CONFIG, styles: {} }), /SHA-384 integrity/);
  await assert.rejects(load({ ...CONFIG, script: { ...CONFIG.script, url: 'https://user:pass@cdn.example.test/a.js' } }),
    /HTTPS URLs/);
  assert.equal(document.head.children.length, 0, 'invalid or unpinned configurations insert no nodes');
}

{
  const { document, globalObject, clock, load } = harness();
  const first = load(CONFIG);
  const duplicate = load(CONFIG);
  assert.equal(duplicate, first, 'concurrent requests share one promise');
  assert.equal(document.head.children.length, 2, 'only styles are inserted before executable code');

  const [styleOne, styleTwo] = document.head.children;
  assert.equal(styleOne.rel, 'stylesheet');
  assert.equal(styleOne.href, CONFIG.styles[0].url);
  for (const node of document.head.children) {
    assert.match(node.getAttribute('integrity'), /^sha384-/);
    assert.equal(node.getAttribute('crossorigin'), 'anonymous');
    assert.equal(node.getAttribute('referrerpolicy'), 'no-referrer');
  }

  let settled = false;
  first.finally(() => { settled = true; });
  styleOne.onload();
  await Promise.resolve();
  assert.equal(settled, false, 'one stylesheet does not resolve or append the script early');
  assert.equal(document.head.children.length, 2, 'script remains absent until every stylesheet is ready');
  styleTwo.onload();
  const script = document.head.children[2];
  assert.equal(script.src, CONFIG.script.url);
  assert.equal(script.async, true);
  assert.match(script.getAttribute('integrity'), /^sha384-/);
  assert.equal(script.getAttribute('crossorigin'), 'anonymous');
  assert.equal(script.getAttribute('referrerpolicy'), 'no-referrer');
  globalObject.ExampleLibrary = { ready: true };
  script.onload();
  assert.equal(await first, globalObject.ExampleLibrary, 'the declared global is returned');
  assert.ok(document.head.children.every((node) => !node.removed), 'successful assets remain installed');
  assert.ok(document.head.children.every((node) => node.onload === null && node.onerror === null), 'success handlers are cleared');
  assert.equal(clock.timers.size, 0, 'success clears its timeout');
}

{
  const { document, globalObject, clock, load } = harness();
  const failed = load(CONFIG);
  const firstNodes = document.head.children.slice();
  firstNodes[0].onerror();
  await assert.rejects(failed, /style-message/);
  assert.equal(document.head.children.length, 0, 'stylesheet failure removes the whole partial load');
  assertCleaned(firstNodes, clock);

  const retry = load(CONFIG);
  const retryNodes = document.head.children.slice();
  assert.equal(retryNodes.length, 2, 'a failed key can retry its styles');
  assert.notEqual(retryNodes[0], firstNodes[0], 'retry creates fresh nodes');
  for (const node of retryNodes) node.onload();
  const retryScript = document.head.children[2];
  globalObject.ExampleLibrary = { retried: true };
  retryScript.onload();
  assert.equal(await retry, globalObject.ExampleLibrary, 'retry can complete successfully');
}

{
  const { document, clock, load } = harness();
  const failed = load(CONFIG);
  const styles = document.head.children.slice();
  styles[0].onload();
  styles[1].onerror();
  await assert.rejects(failed, /style-message/);
  assert.equal(document.head.history.some((node) => node.tagName === 'SCRIPT'), false,
    'a late stylesheet failure cannot occur after executable code was appended');
  assertCleaned(styles, clock);
}

{
  const { document, clock, load } = harness();
  const timedOut = load(CONFIG);
  const nodes = document.head.children.slice();
  assert.equal(clock.timers.values().next().value.delay, 25, 'configured timeout is scheduled');
  clock.fireNext();
  await assert.rejects(timedOut, /timeout-message/);
  assert.equal(document.head.children.length, 0, 'timeout removes every inserted node');
  assertCleaned(nodes, clock);

  const retry = load(CONFIG);
  const retryStyles = document.head.children.slice();
  assert.equal(retryStyles.length, 2, 'timeout also permits a fresh style retry');
  for (const node of retryStyles) node.onload();
  const retryScript = document.head.children[2];
  retryScript.onerror();
  await assert.rejects(retry, /script-message/);
  assert.equal(document.head.children.length, 0, 'script failure removes every inserted node');
  assertCleaned([...retryStyles, retryScript], clock);
}

{
  const { document, globalObject, clock, load } = harness();
  globalObject.ExampleLibrary = { untrusted: true };
  const missing = load(CONFIG);
  const styles = document.head.children.slice();
  delete globalObject.ExampleLibrary;
  for (const node of styles) node.onload();
  const script = document.head.children[2];
  script.onload();
  await assert.rejects(missing, /global-message/);
  assert.equal(document.head.children.length, 0, 'missing global cleans up otherwise loaded assets');
  assertCleaned([...styles, script], clock);

  const retry = load(CONFIG);
  const retryStyles = document.head.children.slice();
  for (const node of retryStyles) node.onload();
  const retryScript = document.head.children[2];
  globalObject.ExampleLibrary = { authenticated: true };
  retryScript.onload();
  assert.equal(await retry, globalObject.ExampleLibrary, 'a pre-existing global does not bypass authenticated loading');
}

console.log('external asset loader: all checks passed');
