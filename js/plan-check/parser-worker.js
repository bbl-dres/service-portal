import {
  DWG_FILE_TYPE,
  LIMITS,
  MAX_FILE_SIZE,
  PlanCheckParserError,
  assertResultBudget,
  boundedString,
  finiteNumber,
  inspectDwgHeader,
  resourceLimit,
} from './config.js';
import { normalizeDrawing } from './normalize.js';
import { validateDrawing } from './rules.js';

const ENGINE_URL = new URL('../vendor/libredwg/dist/libredwg-web.js', import.meta.url).href;
let enginePromise = null;
let requestAccepted = false;

function sendProgress(requestId, stage, value) {
  self.postMessage({ type: 'progress', requestId, progress: { stage, value } });
}

async function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        const module = await import(ENGINE_URL);
        return await module.LibreDwg.create();
      } catch (error) {
        throw new PlanCheckParserError('ENGINE_LOAD_FAILED',
          'Die lokale DWG-Engine konnte nicht geladen werden.', {
            cause: error?.message || String(error),
          });
      }
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function validateInput(message) {
  const { buffer, file } = message;
  if (!(buffer instanceof ArrayBuffer)) {
    throw new PlanCheckParserError('INVALID_FILE',
      'Für die DWG-Prüfung fehlt der Dateiinhalt.');
  }
  if (buffer.byteLength <= 0) {
    throw new PlanCheckParserError('INVALID_FILE', 'Die DWG-Datei ist leer.');
  }
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new PlanCheckParserError('FILE_TOO_LARGE',
      'Die DWG-Datei darf höchstens 50 MiB gross sein.', {
        actual: buffer.byteLength,
        limit: MAX_FILE_SIZE,
      });
  }

  const name = boundedString(file?.name);
  if (!name.toLowerCase().endsWith('.dwg')) {
    throw new PlanCheckParserError('INVALID_FILE_TYPE',
      'Unterstützt werden ausschliesslich binäre DWG-Dateien.');
  }
  const size = Number(file?.size);
  if (!Number.isSafeInteger(size) || size <= 0 || size !== buffer.byteLength) {
    throw new PlanCheckParserError('INVALID_FILE',
      'Die Dateiangaben stimmen nicht mit dem eingelesenen DWG-Inhalt überein.');
  }
  const dwgVersion = inspectDwgHeader(buffer);
  if (message.dwgVersion !== dwgVersion) {
    throw new PlanCheckParserError('INVALID_DWG_HEADER',
      'Der DWG-Header hat sich vor der Verarbeitung verändert.');
  }
  return Object.freeze({ file: Object.freeze({ name, size }), dwgVersion });
}

function safeError(error) {
  const publicDetailKeys = new Set(['actual', 'limit', 'estimatedBytes', 'limitMs']);
  const details = error?.details && typeof error.details === 'object'
    ? Object.fromEntries(Object.entries(error.details)
      .filter(([key]) => publicDetailKeys.has(key))
      .slice(0, LIMITS.errorDetailEntries).map(([key, value]) => {
        const safeKey = boundedString(key).slice(0, 64);
        if (value == null || typeof value === 'number' || typeof value === 'boolean') {
          return [safeKey, value];
        }
        return [safeKey, boundedString(value).slice(0, LIMITS.errorMessageLength)];
      }))
    : undefined;
  return {
    name: boundedString(error?.name || 'Error').slice(0, 64),
    code: boundedString(error?.code || 'PARSER_FAILED').slice(0, 64),
    message: boundedString(error?.message || 'Die DWG-Datei konnte nicht verarbeitet werden.')
      .slice(0, LIMITS.errorMessageLength),
    ...(details ? { details } : {}),
  };
}

async function parseRequest(message) {
  const startedAt = performance.now();
  const { requestId, buffer } = message;

  // Repeat the cheap size, metadata and AC10xx gates inside the Worker before
  // importing the comparatively large parser runtime.
  const { file, dwgVersion } = validateInput(message);
  sendProgress(requestId, 'loading-engine', 0.25);
  const engine = await getEngine();
  sendProgress(requestId, 'parsing', 0.4);

  let pointer = null;
  let converted;
  try {
    try {
      pointer = engine.dwg_read_data(buffer, DWG_FILE_TYPE);
    } catch {
      throw new PlanCheckParserError('DWG_READ_FAILED',
        'LibreDWG konnte die Datei nicht als unterstützte DWG-Zeichnung lesen.');
    }
    if (pointer == null) {
      throw new PlanCheckParserError('DWG_READ_FAILED',
        'LibreDWG konnte die Datei nicht als unterstützte DWG-Zeichnung lesen.');
    }
    try {
      converted = engine.convertEx(pointer);
    } catch (error) {
      throw new PlanCheckParserError('DWG_CONVERSION_FAILED',
        'Die DWG-Daten konnten nicht in das Prüfmodell umgewandelt werden.', {
          cause: error?.message || String(error),
        });
    }
  } finally {
    if (pointer != null) {
      try { engine.dwg_free(pointer); } catch { /* The Worker owns the remaining WASM heap. */ }
    }
  }

  const database = converted?.database;
  if (!database || typeof database !== 'object') {
    throw new PlanCheckParserError('DWG_CONVERSION_FAILED',
      'Die DWG-Engine lieferte kein gültiges Datenmodell.');
  }
  const entities = Array.isArray(database.entities) ? database.entities : [];
  const tableLayers = Array.isArray(database.tables?.LAYER?.entries)
    ? database.tables.LAYER.entries : [];
  // Even an otherwise empty DWG contains its mandatory layer table (at least
  // layer 0). Do not present a recovered header as a parsed drawing.
  if (!entities.length && !tableLayers.length) {
    throw new PlanCheckParserError('DWG_READ_FAILED',
      'Die DWG-Datei enthält keine gültige Zeichnungs- und Layerstruktur.');
  }
  if (entities.length > LIMITS.entities) {
    throw resourceLimit(`Die Zeichnung enthält mehr als ${LIMITS.entities} Entitäten.`, {
      actual: entities.length,
      limit: LIMITS.entities,
    });
  }

  const unknownEntityCount = Math.min(LIMITS.entities, Math.max(
    0, Math.trunc(finiteNumber(converted?.stats?.unknownEntityCount)),
  ));
  sendProgress(requestId, 'normalizing', 0.68);
  const drawing = normalizeDrawing(database, { unknownEntityCount });
  const layers = drawing.layerInfo;
  sendProgress(requestId, 'validating', 0.86);
  const validation = validateDrawing(drawing, layers);
  const reportedVersion = boundedString(
    database.header?.version || database.header?.$ACADVER
      || database.header?.ACADVER || dwgVersion || 'unbekannt',
  );

  const result = {
    file,
    elapsedMs: Math.max(0, finiteNumber(performance.now() - startedAt)),
    database: {
      version: reportedVersion,
      layerCount: tableLayers.length,
      entityCount: entities.length,
      unknownEntityCount,
    },
    drawing,
    layers,
    validation,
  };
  assertResultBudget(result);
  sendProgress(requestId, 'complete', 1);
  self.postMessage({ type: 'result', requestId, result });
}

self.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || message.type !== 'parse' || !Number.isSafeInteger(message.requestId)) return;
  if (requestAccepted) {
    self.postMessage({
      type: 'error',
      requestId: message.requestId,
      error: safeError(new PlanCheckParserError('WORKER_BUSY',
        'Dieser DWG-Prüfprozess verarbeitet bereits eine Datei.')),
    });
    return;
  }
  requestAccepted = true;
  parseRequest(message).catch((error) => {
    self.postMessage({ type: 'error', requestId: message.requestId, error: safeError(error) });
  });
});
