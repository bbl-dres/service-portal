import {
  LIMITS,
  MAX_FILE_SIZE,
  PARSER_TIMEOUT_MS,
  PLAN_CHECK_INTAKE_ENABLED,
  PlanCheckParserError,
  assertResultBudget,
  boundedString,
  inspectDwgHeader,
} from './config.js';

const DEFAULT_WORKER_URL = new URL('./parser-worker.js', import.meta.url);

function abortError(message = 'Die DWG-Verarbeitung wurde abgebrochen.') {
  if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function validateFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new PlanCheckParserError('INVALID_FILE', 'Bitte wählen Sie eine DWG-Datei aus.');
  }
  const name = boundedString(file.name);
  if (!name.toLowerCase().endsWith('.dwg')) {
    throw new PlanCheckParserError('INVALID_FILE_TYPE', 'Unterstützt werden ausschliesslich binäre DWG-Dateien.');
  }
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new PlanCheckParserError('INVALID_FILE', 'Die DWG-Datei ist leer oder besitzt eine ungültige Grösse.');
  }
  if (size > MAX_FILE_SIZE) {
    throw new PlanCheckParserError('FILE_TOO_LARGE', 'Die DWG-Datei darf höchstens 50 MiB gross sein.', {
      actual: size,
      limit: MAX_FILE_SIZE,
    });
  }
  return { name, size };
}

function parserError(value) {
  if (value?.name === 'AbortError') return abortError(value.message);
  return new PlanCheckParserError(value?.code || 'PARSER_FAILED',
    value?.message || 'Die DWG-Datei konnte nicht verarbeitet werden.', value?.details);
}

function validateResult(result) {
  if (!result || typeof result !== 'object') {
    throw new PlanCheckParserError('INVALID_RESULT', 'Der DWG-Pr\u00fcfprozess lieferte kein g\u00fcltiges Ergebnis.');
  }
  const collections = [
    ['Layer', result.layers, LIMITS.layers],
    ['Darstellungsobjekte', result.drawing?.renderList, LIMITS.renderPrimitives],
    ['Raumergebnisse', result.validation?.rooms, LIMITS.reportedItems],
    ['Fl\u00e4chenergebnisse', result.validation?.areas, LIMITS.reportedItems],
    ['Fehlermeldungen', result.validation?.errors, LIMITS.validationErrors],
  ];
  for (const [label, values, limit] of collections) {
    if (!Array.isArray(values)) {
      throw new PlanCheckParserError('INVALID_RESULT', `${label} fehlen im DWG-Pr\u00fcfergebnis.`);
    }
    if (values.length > limit) {
      throw new PlanCheckParserError('RESOURCE_LIMIT', `${label} \u00fcberschreiten die sichere Ergebnisgrenze.`, {
        actual: values.length,
        limit,
      });
    }
  }
  assertResultBudget(result);
  return result;
}

export function createPlanCheckParser({
  workerUrl = DEFAULT_WORKER_URL,
  timeoutMs = PARSER_TIMEOUT_MS,
  // Test-only quarantine escape hatch. The application never supplies this;
  // only the explicitly opted-in trusted-fixture regression does.
  allowTrustedFixture = false,
} = {}) {
  let worker = null;
  let active = null;
  let nextRequestId = 0;
  let disposed = false;
  const intakeEnabled = PLAN_CHECK_INTAKE_ENABLED || allowTrustedFixture === true;
  const parseTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Math.max(1, Math.trunc(Number(timeoutMs)))
    : PARSER_TIMEOUT_MS;

  const endActive = (operation) => {
    if (active !== operation) return;
    operation.signal?.removeEventListener('abort', operation.onAbort);
    clearTimeout(operation.timeoutId);
    active = null;
  };

  const destroyWorker = () => {
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    worker = null;
  };

  const rejectActive = (reason, terminate = false) => {
    if (!active) {
      if (terminate) destroyWorker();
      return;
    }
    const operation = active;
    endActive(operation);
    if (terminate || operation.posted) destroyWorker();
    operation.reject(reason);
  };

  const handleMessage = (event) => {
    const message = event.data;
    if (!active || message?.requestId !== active.requestId) return;
    const operation = active;
    if (message.type === 'progress') {
      try { operation.onProgress?.(message.progress); } catch { /* Progress observers cannot fail parsing. */ }
      return;
    }
    if (message.type === 'result') {
      try {
        const result = validateResult(message.result);
        endActive(operation);
        // Treat the WASM runtime as single-use. This limits heap retention and
        // guarantees every eventual opt-in parse starts from a clean engine.
        destroyWorker();
        result.elapsedMs = Math.max(0, performance.now() - operation.startedAt);
        operation.resolve(result);
      } catch (error) {
        endActive(operation);
        destroyWorker();
        operation.reject(error);
      }
    } else if (message.type === 'error') {
      // A parser/engine failure can leave WASM state inconsistent. Every parse
      // is single-use, so a retry always starts in a fresh worker as well.
      endActive(operation);
      destroyWorker();
      operation.reject(parserError(message.error));
    }
  };

  const ensureWorker = () => {
    if (worker) return worker;
    if (typeof Worker !== 'function') {
      throw new PlanCheckParserError('WORKER_NOT_SUPPORTED',
        'Dieser Browser unterstützt den für die DWG-Prüfung benötigten Web Worker nicht.');
    }
    worker = new Worker(workerUrl, { type: 'module', name: 'plan-check-parser' });
    worker.onmessage = handleMessage;
    worker.onerror = (event) => {
      event.preventDefault?.();
      rejectActive(new PlanCheckParserError('WORKER_FAILED',
        event.message || 'Der DWG-Prüfprozess wurde unerwartet beendet.'), true);
    };
    worker.onmessageerror = () => rejectActive(new PlanCheckParserError('WORKER_MESSAGE_FAILED',
      'Das Ergebnis der DWG-Prüfung konnte nicht übertragen werden.'), true);
    return worker;
  };

  const parse = (file, { signal, onProgress } = {}) => {
    if (disposed) return Promise.reject(new PlanCheckParserError('DISPOSED', 'Der DWG-Parser wurde bereits freigegeben.'));
    if (!intakeEnabled) return Promise.reject(new PlanCheckParserError('INTAKE_DISABLED',
      'Die DWG-Verarbeitung ist aus Sicherheitsgr\u00fcnden deaktiviert.'));
    if (signal?.aborted) return Promise.reject(abortError());

    let fileInfo;
    try { fileInfo = validateFile(file); } catch (error) { return Promise.reject(error); }
    if (active) rejectActive(abortError('Eine neuere DWG-Prüfung hat diese Verarbeitung ersetzt.'), true);
    const requestId = ++nextRequestId;

    return new Promise((resolve, reject) => {
      const operation = {
        requestId,
        resolve,
        reject,
        signal,
        onProgress,
        posted: false,
        startedAt: performance.now(),
        onAbort: null,
        timeoutId: null,
      };
      operation.onAbort = () => {
        if (active === operation) rejectActive(abortError(), true);
      };
      active = operation;
      signal?.addEventListener('abort', operation.onAbort, { once: true });
      operation.timeoutId = setTimeout(() => {
        if (active !== operation) return;
        rejectActive(new PlanCheckParserError('PARSE_TIMEOUT',
          'Die DWG-Pr\u00fcfung hat das sichere Zeitlimit \u00fcberschritten.', {
            limitMs: parseTimeoutMs,
          }), true);
      }, parseTimeoutMs);
      try { onProgress?.({ stage: 'reading', value: 0.05 }); } catch { /* Observer only. */ }

      Promise.resolve().then(() => file.arrayBuffer()).then((buffer) => {
        if (active !== operation) return;
        if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== fileInfo.size) {
          throw new PlanCheckParserError('INVALID_FILE', 'Die DWG-Datei konnte nicht vollständig gelesen werden.');
        }
        const dwgVersion = inspectDwgHeader(buffer);
        try { onProgress?.({ stage: 'reading', value: 0.15 }); } catch { /* Observer only. */ }
        try {
          const parserWorker = ensureWorker();
          operation.posted = true;
          parserWorker.postMessage({
            type: 'parse',
            requestId,
            buffer,
            file: fileInfo,
            dwgVersion,
          }, [buffer]);
        } catch (error) {
          destroyWorker();
          if (error instanceof PlanCheckParserError) throw error;
          throw new PlanCheckParserError('WORKER_MESSAGE_FAILED',
            'Die DWG-Datei konnte nicht an den lokalen Pr\u00fcfprozess \u00fcbergeben werden.');
        }
      }).catch((error) => {
        if (active !== operation) return;
        endActive(operation);
        reject(error instanceof PlanCheckParserError ? error : new PlanCheckParserError('FILE_READ_FAILED',
          'Die DWG-Datei konnte nicht gelesen werden.', { cause: error?.message || String(error) }));
      });
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    rejectActive(new PlanCheckParserError('DISPOSED', 'Der DWG-Parser wurde freigegeben.'), true);
    destroyWorker();
  };

  return Object.freeze({ parse, dispose });
}
