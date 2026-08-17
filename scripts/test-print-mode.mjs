import { createPrintMode } from '../js/ui/print-mode.js';

const activeClasses = new Set();
globalThis.document = { body: { classList: {
  add: (name) => activeClasses.add(name),
  remove: (name) => activeClasses.delete(name),
  contains: (name) => activeClasses.has(name),
} } };

class PrintTarget extends EventTarget {
  listenerCount = 0;
  printCalls = 0;
  addEventListener(type, listener, options) {
    if (type === 'afterprint') this.listenerCount++;
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    if (type === 'afterprint') this.listenerCount--;
    super.removeEventListener(type, listener, options);
  }
  print() { this.printCalls++; }
}

const target = new PrintTarget();
globalThis.window = target;
const mode = createPrintMode({ timeout: 10_000 });

mode.print();
mode.print();
if (target.printCalls !== 2 || target.listenerCount !== 1
  || !document.body.classList.contains('print--plan')) {
  throw new Error('repeated print did not replace the prior lifecycle');
}

target.dispatchEvent(new Event('afterprint'));
if (target.listenerCount !== 0 || document.body.classList.contains('print--plan')) {
  throw new Error('afterprint did not release print mode');
}

mode.print();
mode.destroy();
if (target.listenerCount !== 0 || document.body.classList.contains('print--plan')) {
  throw new Error('route cleanup did not release print mode');
}

target.print = () => { throw new Error('print failed'); };
let rejected = false;
try { mode.print(); } catch { rejected = true; }
if (!rejected || target.listenerCount !== 0 || document.body.classList.contains('print--plan')) {
  throw new Error('a print exception left global state behind');
}

console.log('Print-mode lifecycle passed.');
