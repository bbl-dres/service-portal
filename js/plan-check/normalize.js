// DWG database to bounded, renderer-compatible primitives.

import {
    LIMITS,
    aciToHex,
    boundedString,
    finiteNumber,
} from './config.js';
import { normalizeVertices } from './geometry.js';

function trueColorToHex(value) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xFFFFFF) return null;
    return `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
}

function explicitAciIndex(value) {
    const index = Number(value);
    return Number.isInteger(index) && index >= 1 && index <= 255 ? index : null;
}

function layerColorHex(layer) {
    // The converter emits a default RGB alongside indexed layer colors, so a
    // real ACI 1..255 remains authoritative. A sentinel index plus RGB denotes
    // a layer TrueColor; without either, foreground ACI 7 is the safe fallback.
    const index = explicitAciIndex(layer?.colorIndex);
    if (index != null) return aciToHex(index);
    return trueColorToHex(layer?.color) || aciToHex(7);
}

function normalizePrimitive(item, vertexBudget) {
    const base = {
        t: boundedString(item?.t, 'unknown'),
        l: boundedString(item?.l, '0'),
        et: boundedString(item?.et, 'UNKNOWN'),
        handle: boundedString(item?.handle),
        c: boundedString(item?.c, '#CCCCCC'),
        byLayer: item?.byLayer !== false,
    };
    const points = (values) => {
        const normalized = normalizeVertices(values);
        vertexBudget.count += normalized.length;
        return normalized;
    };
    switch (base.t) {
        case 'line':
            return { ...base, x1: finiteNumber(item.x1), y1: finiteNumber(item.y1),
                x2: finiteNumber(item.x2), y2: finiteNumber(item.y2) };
        case 'poly': {
            const primitive = {
                ...base,
                verts: points(item.verts),
                closed: !!item.closed,
                sourceHasBulges: item?.sourceHasBulges === true,
            };
            if (item.width != null) primitive.width = Math.abs(finiteNumber(item.width));
            return primitive;
        }
        case 'circle':
            return { ...base, cx: finiteNumber(item.cx), cy: finiteNumber(item.cy), r: Math.abs(finiteNumber(item.r)) };
        case 'arc':
            return { ...base, cx: finiteNumber(item.cx), cy: finiteNumber(item.cy), r: Math.abs(finiteNumber(item.r)),
                sa: finiteNumber(item.sa), ea: finiteNumber(item.ea) };
        case 'ellipse':
            return { ...base, cx: finiteNumber(item.cx), cy: finiteNumber(item.cy), rx: Math.abs(finiteNumber(item.rx)),
                ry: Math.abs(finiteNumber(item.ry)), rot: finiteNumber(item.rot) };
        case 'text': {
            const primitive = { ...base, x: finiteNumber(item.x), y: finiteNumber(item.y), text: boundedString(item.text),
                h: Math.abs(finiteNumber(item.h, 2.5)), rot: finiteNumber(item.rot), fontName: boundedString(item.fontName) };
            if (item.usesAlignmentPoint === true
                && Number.isFinite(Number(item.sourceBaseX))
                && Number.isFinite(Number(item.sourceBaseY))) {
                primitive.usesAlignmentPoint = true;
                primitive.sourceBaseX = finiteNumber(item.sourceBaseX);
                primitive.sourceBaseY = finiteNumber(item.sourceBaseY);
            }
            return primitive;
        }
        case 'point':
            return { ...base, x: finiteNumber(item.x), y: finiteNumber(item.y) };
        case 'solid':
            return { ...base, pts: points(item.pts) };
        case 'hatchfill': {
            const sourcePaths = Array.isArray(item.paths) ? item.paths : [];
            return { ...base, paths: sourcePaths.map(points), patternName: boundedString(item.patternName) };
        }
        default:
            return null;
    }
}

function computeBounds(renderList) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const expand = (x, y) => {
        const safeX = finiteNumber(x, NaN);
        const safeY = finiteNumber(y, NaN);
        if (!Number.isFinite(safeX) || !Number.isFinite(safeY)) return;
        minX = Math.min(minX, safeX);
        minY = Math.min(minY, safeY);
        maxX = Math.max(maxX, safeX);
        maxY = Math.max(maxY, safeY);
    };
    for (const item of renderList) {
        if (item.t === 'line') {
            expand(item.x1, item.y1); expand(item.x2, item.y2);
        } else if (item.t === 'poly') {
            item.verts.forEach((vertex) => expand(vertex.x, vertex.y));
        } else if (item.t === 'circle' || item.t === 'arc') {
            expand(item.cx - item.r, item.cy - item.r); expand(item.cx + item.r, item.cy + item.r);
        } else if (item.t === 'ellipse') {
            const cos = Math.cos(finiteNumber(item.rot));
            const sin = Math.sin(finiteNumber(item.rot));
            const extentX = Math.hypot(item.rx * cos, item.ry * sin);
            const extentY = Math.hypot(item.rx * sin, item.ry * cos);
            expand(item.cx - extentX, item.cy - extentY);
            expand(item.cx + extentX, item.cy + extentY);
        } else if (item.t === 'text' || item.t === 'point') {
            expand(item.x, item.y);
        } else if (item.t === 'solid') {
            item.pts.forEach((vertex) => expand(vertex.x, vertex.y));
        } else if (item.t === 'hatchfill') {
            item.paths.forEach((path) => path.forEach((vertex) => expand(vertex.x, vertex.y)));
        }
    }
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };
    return { minX, minY, maxX, maxY, width: finiteNumber(maxX - minX), height: finiteNumber(maxY - minY) };
}

export function normalizeDrawing(database, options = {}) {
    const db = database && typeof database === 'object' ? database : {};
    const entities = Array.isArray(db.entities) ? db.entities : [];
    const layers = Array.isArray(db.tables?.LAYER?.entries) ? db.tables.LAYER.entries : [];

    const state = {
        insunits: null,
        nonZeroZEntities: [],
        nonZeroZEntityCount: 0,
        xrefBlocks: [],
        paperSpaceLayouts: [],
        styleFontMap: Object.create(null),
        dimensionInfo: [],
        hatchInfo: [],
        unsupportedEntities: [],
    };
    const diagnostics = {
        blockDefinitions: 0,
        insertReferences: 0,
        skippedCyclicInserts: 0,
        skippedDepthLimitedInserts: 0,
        skippedMalformedInserts: 0,
        unresolvedBlockReferences: 0,
        skippedUnsupportedEntities: 0,
        skippedNonRenderableEntities: 0,
        truncatedValidationMetadata: 0,
        truncatedHatchDiagnostics: 0,
        truncatedDimensionDiagnostics: 0,
        truncatedStyleMetadata: 0,
        truncatedLayoutMetadata: 0,
        invalidCoordinateEntities: 0,
        invalidTransformedPrimitives: 0,
        skippedInvisibleEntities: 0,
        xrefReferenceCount: 0,
        converterUnknownEntityCount: Math.min(LIMITS.entities, Math.max(
            0, Math.trunc(finiteNumber(options?.unknownEntityCount)),
        )),
        sourceEntityCount: entities.length,
        hatchCount: 0,
        approximatedNonUniformArcs: 0,
        approximatedNonUniformPolylines: 0,
        approximatedNonUniformText: 0,
    };
    const layerColorMap = Object.create(null);
    for (const l of layers) {
        const name = boundedString(l?.name, '0');
        layerColorMap[name] = layerColorHex(l);
    }

    function isByBlock(e) {
        const value = e?.colorIndex;
        return !trueColorToHex(e?.color) && value != null && String(value).trim() !== '' && Number(value) === 0;
    }

    function getColor(e, effectiveLayer, parentColor) {
        // Entity `color` is emitted only for the converter's TrueColor method,
        // and therefore overrides even a simultaneous ByLayer/ByBlock index.
        const trueColor = trueColorToHex(e?.color);
        if (trueColor) return trueColor;
        const colorIndex = explicitAciIndex(e?.colorIndex);
        if (colorIndex != null) return aciToHex(colorIndex);
        if (isByBlock(e) && parentColor) return parentColor;
        return layerColorMap[effectiveLayer] || '#CCCCCC';
    }

    // Enhancement 3: $INSUNITS from header
    const rawUnits = db.header?.$INSUNITS ?? db.header?.INSUNITS ?? null;
    state.insunits = rawUnits == null ? null : finiteNumber(rawUnits, null);

    // Enhancement 8: STYLE table → styleFontMap
    state.styleFontMap = Object.create(null);
    const styleEntries = Array.isArray(db.tables?.STYLE?.entries) ? db.tables.STYLE.entries : [];
    diagnostics.truncatedStyleMetadata = Math.max(0, styleEntries.length - LIMITS.metadataEntries);
    for (const s of styleEntries.slice(0, LIMITS.metadataEntries)) {
        if (s.name) {
            state.styleFontMap[boundedString(s.name).toUpperCase()]
                = boundedString(s.fontName || s.bigFontName || s.fileName || '');
        }
    }

    // Enhancement 6: LAYOUT table → paperSpaceLayouts
    state.paperSpaceLayouts = [];
    const layoutEntries = Array.isArray(db.tables?.LAYOUT?.entries) ? db.tables.LAYOUT.entries : [];
    diagnostics.truncatedLayoutMetadata = Math.max(0, layoutEntries.length - LIMITS.metadataEntries);
    for (const lay of layoutEntries.slice(0, LIMITS.metadataEntries)) {
        const name = boundedString(lay.name || lay.layoutName || '');
        if (name && name.toUpperCase() !== 'MODEL') {
            state.paperSpaceLayouts.push(name);
        }
    }

    // Helper: check if entity uses ByLayer color
    function isByLayer(e) {
        return !trueColorToHex(e?.color) && explicitAciIndex(e?.colorIndex) == null && !isByBlock(e);
    }

    // Extension dictionaries, keyed by handle. A DIMENSION is associative when
    // its own extension dictionary holds an ACAD_DIMASSOC entry; that object is
    // what AutoCAD writes when the dimension is attached to geometry.
    const dictionaries = new Map();
    for (const dictionary of Array.isArray(db.objects?.DICTIONARY) ? db.objects.DICTIONARY : []) {
        const handle = boundedString(dictionary?.handle);
        if (handle) dictionaries.set(handle, dictionary);
    }
    const hasDictionaries = dictionaries.size > 0;
    function dimensionAssociativity(entity) {
        // Without a dictionary table the question cannot be answered from this
        // file; `null` keeps DIM_002 unevaluated instead of guessing "not
        // associative" for every dimension.
        if (!hasDictionaries) return null;
        const ownerHandle = boundedString(entity?.ownerDictionaryHardId);
        if (!ownerHandle || ownerHandle === '0') return false;
        const entries = dictionaries.get(ownerHandle)?.entries;
        if (!entries || typeof entries !== 'object') return false;
        return Object.keys(entries).some((key) => /^ACAD_DIMASSOC$/i.test(key));
    }

    const blockMap = Object.create(null);
    let blockCount = 0;
    const blockRecords = Array.isArray(db.tables?.BLOCK_RECORD?.entries) ? db.tables.BLOCK_RECORD.entries : [];
    // Enhancement 5: XREF detection
    state.xrefBlocks = [];
    for (const br of blockRecords) {
        if (br.name && Array.isArray(br.entities)) {
            blockMap[boundedString(br.name)] = br;
            blockCount++;
        }
        if (br.xrefPath || (br.flags && (br.flags & 4))) {
            diagnostics.xrefReferenceCount += 1;
            if (state.xrefBlocks.length < LIMITS.reportedItems) {
                state.xrefBlocks.push({ name: boundedString(br.name), xrefPath: boundedString(br.xrefPath) });
            }
        }
    }
    diagnostics.blockDefinitions = blockCount;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function expand(x, y) {
        x = finiteNumber(x, NaN);
        y = finiteNumber(y, NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }

    function strictGeometryNumber(value) {
        if (value == null || value === '' || typeof value === 'boolean') return NaN;
        const numeric = Number(value);
        return Number.isFinite(numeric) && Math.abs(numeric) <= LIMITS.coordinateMagnitude
            ? numeric : NaN;
    }

    function sourceHasInvalidGeometry(entity) {
        let invalid = false;
        let remaining = LIMITS.totalVertices;
        const inspectScalar = (value, predicate = () => true) => {
            if (invalid || value == null) return;
            const numeric = strictGeometryNumber(value);
            if (!Number.isFinite(numeric) || !predicate(numeric)) invalid = true;
        };
        const inspectPoint = (point) => {
            if (invalid || remaining <= 0 || !point || typeof point !== 'object') return;
            const candidate = point.point && typeof point.point === 'object' ? point.point : point;
            const hasX = Object.hasOwn(candidate, 'x');
            const hasY = Object.hasOwn(candidate, 'y');
            if (!hasX && !hasY) return;
            remaining -= 1;
            if (!hasX || !hasY
                || !Number.isFinite(strictGeometryNumber(candidate.x))
                || !Number.isFinite(strictGeometryNumber(candidate.y))
                || (Object.hasOwn(candidate, 'z') && !Number.isFinite(strictGeometryNumber(candidate.z)))) {
                invalid = true;
            }
            for (const field of ['bulge', 'startWidth', 'start_width', 'endWidth', 'end_width']) {
                inspectScalar(point?.[field], field === 'bulge' ? undefined : (value) => value >= 0);
            }
        };
        const inspectPoints = (values) => {
            if (!Array.isArray(values)) return;
            for (const point of values) {
                inspectPoint(point);
                if (invalid || remaining <= 0) break;
            }
        };
        for (const field of [
            'startPoint', 'endPoint', 'insertionPoint', 'alignmentPoint', 'textPoint', 'center',
            'definitionPoint', 'subDefinitionPoint1', 'subDefinitionPoint2', 'basePoint',
            'majorAxisEndPoint', 'firstCorner', 'secondCorner', 'thirdCorner', 'fourthCorner',
            'location', 'point', 'point1', 'point2', 'point3', 'point4', 'direction',
        ]) inspectPoint(entity?.[field]);
        if (entity?.type === 'POINT') inspectPoint(entity);
        if (entity?.text && typeof entity.text === 'object') {
            inspectPoint(entity.text.startPoint);
            inspectPoint(entity.text.endPoint);
            inspectScalar(entity.text.textHeight, (value) => value > 0);
            inspectScalar(entity.text.rotation);
        }
        for (const field of ['startAngle', 'endAngle', 'rotation', 'measurement']) {
            inspectScalar(entity?.[field]);
        }
        for (const field of ['radius', 'textHeight', 'length']) {
            inspectScalar(entity?.[field], (value) => value > 0);
        }
        for (const field of ['constantWidth', 'width']) {
            inspectScalar(entity?.[field], (value) => value >= 0);
        }
        for (const field of ['xScale', 'yScale', 'zScale']) {
            inspectScalar(entity?.[field], (value) => Math.abs(value) > 1e-12);
        }
        inspectScalar(entity?.axisRatio ?? entity?.minorToMajorRatio,
            (value) => value > 0 && value <= 1);
        for (const field of ['vertices', 'fitPoints', 'controlPoints']) inspectPoints(entity?.[field]);
        if (Array.isArray(entity?.boundaryPaths)) {
            for (const path of entity.boundaryPaths) {
                inspectPoints(path?.vertices);
                if (Array.isArray(path?.edges)) {
                    for (const edge of path.edges) {
                        inspectPoint(edge?.startPoint || edge?.start);
                        inspectPoint(edge?.endPoint || edge?.end);
                        inspectPoint(edge?.center);
                        inspectPoint(edge?.majorAxisEndPoint || edge?.endMajorAxis);
                        inspectScalar(edge?.radius, (value) => value > 0);
                        inspectScalar(edge?.startAngle);
                        inspectScalar(edge?.endAngle);
                        inspectScalar(edge?.lengthOfMinorAxis, (value) => value > 0);
                        inspectPoints(edge?.fitPoints);
                        inspectPoints(edge?.['fitDatum']);
                        inspectPoints(edge?.controlPoints);
                        if (invalid || remaining <= 0) break;
                    }
                }
                if (invalid || remaining <= 0) break;
            }
        }
        return invalid;
    }

    function primitiveHasInvalidGeometry(item) {
        const stack = [item];
        while (stack.length) {
            const value = stack.pop();
            if (typeof value === 'number') {
                if (!Number.isFinite(value) || Math.abs(value) > LIMITS.coordinateMagnitude) return true;
            } else if (Array.isArray(value)) {
                stack.push(...value);
            } else if (value && typeof value === 'object') {
                stack.push(...Object.values(value));
            }
        }
        return false;
    }

    const renderList = [];
    let emittedVertexCount = 0;
    function pushRender(item) {
        if (primitiveHasInvalidGeometry(item)) {
            diagnostics.invalidTransformedPrimitives += 1;
            return;
        }
        const arrays = [];
        if (Array.isArray(item?.verts)) arrays.push(item.verts);
        if (Array.isArray(item?.pts)) arrays.push(item.pts);
        if (Array.isArray(item?.paths)) arrays.push(...item.paths);
        emittedVertexCount += arrays.reduce((sum, values) => sum + (Array.isArray(values) ? values.length : 0), 0);
        renderList.push(item);
    }
    let expandedEntityCount = 0;
    let generatedHatchVertexCount = 0;
    const forbiddenValidationTypes = new Set(['MLINE', 'ELLIPSE', 'SPLINE', 'OLE', 'OLE2FRAME', 'OLEFRAME']);
    function preserveValidationMetadata(item) {
        if (state.unsupportedEntities.length < LIMITS.reportedItems) {
            state.unsupportedEntities.push(item);
        } else {
            diagnostics.truncatedValidationMetadata += 1;
        }
    }
    function appendHatchVertex(target, vertex) {
        generatedHatchVertexCount += 1;
        target.push(vertex);
    }

    function appendGeneratedVertex(target, vertex) {
        target.push(vertex);
    }

    function sourcePolylineWidth(entity) {
        let maximum = Math.max(
            Math.abs(finiteNumber(entity?.constantWidth)),
            Math.abs(finiteNumber(entity?.width)),
        );
        for (const vertex of (Array.isArray(entity?.vertices) ? entity.vertices : [])) {
            maximum = Math.max(
                maximum,
                Math.abs(finiteNumber(vertex?.startWidth ?? vertex?.start_width)),
                Math.abs(finiteNumber(vertex?.endWidth ?? vertex?.end_width)),
            );
        }
        return maximum;
    }

    function transformPolylineVertices(source, closed, transform, metrics) {
        const vertices = Array.isArray(source) ? source : [];
        const hasBulges = vertices.some((vertex) => Math.abs(finiteNumber(vertex?.bulge)) > 1e-12);
        if (!transform || metrics.similarity || !hasBulges) {
            return vertices.map((vertex) => {
                const point = transformPoint(vertex?.x, vertex?.y, transform);
                return {
                    x: point.x,
                    y: point.y,
                    bulge: metrics.determinant < 0 ? -finiteNumber(vertex?.bulge) : finiteNumber(vertex?.bulge),
                };
            });
        }

        diagnostics.approximatedNonUniformPolylines += 1;
        const transformed = [];
        if (!vertices.length) return transformed;
        const first = transformPoint(vertices[0]?.x, vertices[0]?.y, transform);
        appendGeneratedVertex(transformed, { ...first, bulge: 0 });
        const segmentCount = closed ? vertices.length : vertices.length - 1;
        for (let index = 0; index < segmentCount; index += 1) {
            const start = vertices[index];
            const end = vertices[(index + 1) % vertices.length];
            const bulge = finiteNumber(start?.bulge);
            const dx = finiteNumber(end?.x) - finiteNumber(start?.x);
            const dy = finiteNumber(end?.y) - finiteNumber(start?.y);
            const chord = Math.hypot(dx, dy);
            if (Math.abs(bulge) > 1e-12 && chord > 1e-12) {
                const theta = 4 * Math.atan(bulge);
                const centerOffset = chord * (1 - bulge * bulge) / (4 * bulge);
                const centerX = (finiteNumber(start?.x) + finiteNumber(end?.x)) / 2 - (dy / chord) * centerOffset;
                const centerY = (finiteNumber(start?.y) + finiteNumber(end?.y)) / 2 + (dx / chord) * centerOffset;
                const radius = Math.hypot(finiteNumber(start?.x) - centerX, finiteNumber(start?.y) - centerY);
                const startAngle = Math.atan2(finiteNumber(start?.y) - centerY, finiteNumber(start?.x) - centerX);
                const steps = Math.min(64, Math.max(4, Math.ceil(Math.abs(theta) / (Math.PI / 18))));
                for (let step = 1; step <= steps; step += 1) {
                    if (closed && index === segmentCount - 1 && step === steps) break;
                    const angle = startAngle + theta * (step / steps);
                    const point = transformPoint(
                        centerX + radius * Math.cos(angle),
                        centerY + radius * Math.sin(angle),
                        transform,
                    );
                    appendGeneratedVertex(transformed, { ...point, bulge: 0 });
                }
            } else if (!(closed && index === segmentCount - 1)) {
                const point = transformPoint(end?.x, end?.y, transform);
                appendGeneratedVertex(transformed, { ...point, bulge: 0 });
            }
        }
        return transformed;
    }

    function transformedTextMetrics(rotation, transform) {
        const angle = finiteNumber(rotation);
        const xAxis = transformVector(Math.cos(angle), Math.sin(angle), transform);
        const yAxis = transformVector(-Math.sin(angle), Math.cos(angle), transform);
        return {
            rotation: Math.atan2(xAxis.y, xAxis.x),
            heightScale: Math.hypot(yAxis.x, yAxis.y),
        };
    }

    function transformPoint(px, py, transform) {
        const x = strictGeometryNumber(px);
        const y = strictGeometryNumber(py);
        if (!transform) return { x, y };
        return {
            x: strictGeometryNumber(transform.a * x + transform.c * y + transform.e),
            y: strictGeometryNumber(transform.b * x + transform.d * y + transform.f),
        };
    }

    function transformVector(x, y, transform) {
        const vx = strictGeometryNumber(x);
        const vy = strictGeometryNumber(y);
        if (!transform) return { x: vx, y: vy };
        return {
            x: strictGeometryNumber(transform.a * vx + transform.c * vy),
            y: strictGeometryNumber(transform.b * vx + transform.d * vy),
        };
    }

    function insertTransform(insertionPoint, xScale, yScale, rotation, basePoint) {
        const sx = finiteNumber(xScale, 1);
        const sy = finiteNumber(yScale, 1);
        // libredwg-web returns rotation in radians (not degrees).
        const angle = finiteNumber(rotation);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const a = cos * sx;
        const b = sin * sx;
        const c = -sin * sy;
        const d = cos * sy;
        const baseX = basePoint ? strictGeometryNumber(basePoint.x) : 0;
        const baseY = basePoint ? strictGeometryNumber(basePoint.y) : 0;
        const insertX = strictGeometryNumber(insertionPoint?.x);
        const insertY = strictGeometryNumber(insertionPoint?.y);
        return {
            a, b, c, d,
            e: insertX - a * baseX - c * baseY,
            f: insertY - b * baseX - d * baseY,
        };
    }

    function composeTransforms(parent, child) {
        if (!parent) return child;
        return {
            a: parent.a * child.a + parent.c * child.b,
            b: parent.b * child.a + parent.d * child.b,
            c: parent.a * child.c + parent.c * child.d,
            d: parent.b * child.c + parent.d * child.d,
            e: parent.a * child.e + parent.c * child.f + parent.e,
            f: parent.b * child.e + parent.d * child.f + parent.f,
        };
    }

    function transformMetrics(transform) {
        if (!transform) return { determinant: 1, similarity: true };
        const scaleX = Math.hypot(transform.a, transform.b);
        const scaleY = Math.hypot(transform.c, transform.d);
        const dot = transform.a * transform.c + transform.b * transform.d;
        const reference = Math.max(scaleX, scaleY, 1);
        const orthogonal = Math.abs(dot) <= 1e-10 * reference * reference;
        const uniform = Math.abs(scaleX - scaleY) <= 1e-10 * reference;
        return {
            determinant: transform.a * transform.d - transform.b * transform.c,
            similarity: orthogonal && uniform,
        };
    }

    function ellipseFromAxes(center, axisX, axisY) {
        const xx = axisX.x * axisX.x + axisY.x * axisY.x;
        const xy = axisX.x * axisX.y + axisY.x * axisY.y;
        const yy = axisX.y * axisX.y + axisY.y * axisY.y;
        const discriminant = Math.hypot(xx - yy, 2 * xy);
        const majorSquared = Math.max(0, (xx + yy + discriminant) / 2);
        const minorSquared = Math.max(0, (xx + yy - discriminant) / 2);
        return {
            cx: center.x,
            cy: center.y,
            rx: Math.sqrt(majorSquared),
            ry: Math.sqrt(minorSquared),
            rot: discriminant > 1e-12 ? 0.5 * Math.atan2(2 * xy, xx - yy) : 0,
            extentX: Math.sqrt(Math.max(0, xx)),
            extentY: Math.sqrt(Math.max(0, yy)),
        };
    }

    // Enhancement 4: collect non-zero Z entities
    state.nonZeroZEntities = [];
    // Enhancement 9: collect DIMENSION info
    state.dimensionInfo = [];

    function recordNonZeroZ(e, layer, type, handle) {
        let remaining = LIMITS.verticesPerPrimitive;
        let nonZeroZ = null;
        const inspectPoint = (point) => {
            if (nonZeroZ != null || remaining <= 0 || !point || typeof point !== 'object') return;
            remaining -= 1;
            const z = Number(point.z);
            if (Number.isFinite(z) && Math.abs(z) > 1e-6) nonZeroZ = z;
        };
        const inspectPoints = (values) => {
            if (!Array.isArray(values)) return;
            for (const point of values) {
                inspectPoint(point?.point || point);
                if (nonZeroZ != null || remaining <= 0) break;
            }
        };
        for (const field of [
            'startPoint', 'endPoint', 'insertionPoint', 'alignmentPoint', 'textPoint', 'center',
            'definitionPoint', 'subDefinitionPoint1', 'subDefinitionPoint2', 'basePoint',
            'majorAxisEndPoint', 'firstCorner', 'secondCorner', 'thirdCorner', 'fourthCorner',
            'location', 'point', 'point1', 'point2', 'point3', 'point4',
        ]) inspectPoint(e[field]);
        if (e.text && typeof e.text === 'object') {
            inspectPoint(e.text.startPoint);
            inspectPoint(e.text.endPoint);
        }
        for (const field of ['vertices', 'fitPoints', 'controlPoints']) inspectPoints(e[field]);
        if (Array.isArray(e.boundaryPaths)) {
            for (const path of e.boundaryPaths) {
                inspectPoints(path?.vertices);
                if (Array.isArray(path?.edges)) {
                    for (const edge of path.edges) {
                        inspectPoint(edge?.startPoint || edge?.start);
                        inspectPoint(edge?.endPoint || edge?.end);
                        inspectPoint(edge?.center);
                        inspectPoints(edge?.fitPoints);
                        inspectPoints(edge?.['fitDatum']);
                        inspectPoints(edge?.controlPoints);
                        if (nonZeroZ != null || remaining <= 0) break;
                    }
                }
                if (nonZeroZ != null || remaining <= 0) break;
            }
        }
        if (nonZeroZ == null) return;
        state.nonZeroZEntityCount += 1;
        if (state.nonZeroZEntities.length < LIMITS.reportedItems) {
            state.nonZeroZEntities.push({ handle, layer, type, z: nonZeroZ });
        }
    }

    function addEntity(e, tf, parentLayer, parentColor = null, depth = 0, blockPath = []) {
        if (!e || typeof e !== 'object') return;
        expandedEntityCount += 1;
        const ownLayer = boundedString(e.layer || '0');
        const l = ownLayer === '0' && parentLayer ? boundedString(parentLayer) : ownLayer;
        const et = boundedString(e.type || 'UNKNOWN');
        const handle = boundedString(e.handle || '');
        recordNonZeroZ(e, l, et, handle);
        // @mlightcad/libredwg-web 0.7.9 converts LibreDWG's invisibility bit to
        // a real `isVisible` boolean, so true is visible and false is hidden.
        // Preserve the older numeric adapter convention where 1 meant hidden.
        if (e.isVisible === false || (typeof e.isVisible === 'number' && e.isVisible === 1)) {
            diagnostics.skippedInvisibleEntities += 1;
            return;
        }
        if (sourceHasInvalidGeometry(e)) {
            diagnostics.invalidCoordinateEntities += 1;
            return;
        }

        const color = getColor(e, l, parentColor);
        const byLayer = isByLayer(e);
        const renderCountBefore = renderList.length;
        const invalidPrimitiveCountBefore = diagnostics.invalidTransformedPrimitives;
        const validationDiagnosticCountBefore = state.unsupportedEntities.length
            + diagnostics.truncatedValidationMetadata;
        let usedDefaultUnsupportedBranch = false;
        let emptyResultIsRepresented = false;

        function tp(px, py) {
            if (!tf) return { x: strictGeometryNumber(px), y: strictGeometryNumber(py) };
            return transformPoint(px, py, tf);
        }

        const metrics = transformMetrics(tf);
        const tfMirrored = metrics.determinant < 0;

        switch (e.type) {
            case 'LINE':
                if (e.startPoint && e.endPoint) {
                    const p1 = tp(e.startPoint.x, e.startPoint.y);
                    const p2 = tp(e.endPoint.x, e.endPoint.y);
                    expand(p1.x, p1.y); expand(p2.x, p2.y);
                    pushRender({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                }
                break;

            case 'LWPOLYLINE':
                if (e.vertices && e.vertices.length > 1) {
                    let closed = !!(e.flag & 512) || !!(e.flag & 1);
                    const sourceHasBulges = e.vertices.some((vertex) => Math.abs(finiteNumber(vertex?.bulge)) > 1e-6);
                    const verts = transformPolylineVertices(e.vertices, closed, tf, metrics);
                    for (const v of verts) expand(v.x, v.y);
                    if (!closed && verts.length > 2) {
                        const f = verts[0], la = verts[verts.length - 1];
                        if (Math.abs(f.x - la.x) < 1e-6 && Math.abs(f.y - la.y) < 1e-6) closed = true;
                    }
                    const width = sourcePolylineWidth(e);
                    pushRender({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer, width, sourceHasBulges });
                } else if (l === 'R_RAUMPOLYGON' || l === 'R_GESCHOSSPOLYGON') {
                    const closed = !!(e.flag & 512) || !!(e.flag & 1);
                    const verts = (Array.isArray(e.vertices) ? e.vertices : []).map((vertex) => {
                        const point = tp(vertex?.x, vertex?.y);
                        return { x: point.x, y: point.y, bulge: finiteNumber(vertex?.bulge) };
                    });
                    preserveValidationMetadata({
                        t: 'poly', l, et, handle, verts, closed, validationOnly: true,
                        width: sourcePolylineWidth(e),
                        sourceHasBulges: verts.some((vertex) => Math.abs(vertex.bulge) > 1e-6),
                    });
                }
                break;

            case 'POLYLINE2D': {
                if (e.vertices && e.vertices.length > 1) {
                    const closed = !!(e.flag & 512) || !!(e.flag & 1);
                    const sourceHasBulges = e.vertices.some((vertex) => Math.abs(finiteNumber(vertex?.bulge)) > 1e-6);
                    const verts = transformPolylineVertices(e.vertices, closed, tf, metrics);
                    for (const v of verts) expand(v.x, v.y);
                    const width = sourcePolylineWidth(e);
                    pushRender({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer, width, sourceHasBulges });
                }
                break;
            }

            case 'POLYLINE3D': {
                if (e.vertices && e.vertices.length > 1) {
                    const verts = e.vertices.map(v => {
                        const p = tp(v.x, v.y);
                        return { x: p.x, y: p.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    const closed = !!(e.flag & 512) || !!(e.flag & 1);
                    pushRender({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer });
                }
                break;
            }

            case 'CIRCLE':
                if (e.center && e.radius) {
                    const center = tp(e.center.x, e.center.y);
                    const radius = Math.abs(finiteNumber(e.radius));
                    const ellipse = ellipseFromAxes(
                        center,
                        transformVector(radius, 0, tf),
                        transformVector(0, radius, tf),
                    );
                    expand(center.x - ellipse.extentX, center.y - ellipse.extentY);
                    expand(center.x + ellipse.extentX, center.y + ellipse.extentY);
                    if (metrics.similarity) {
                        pushRender({ t: 'circle', l, et, handle, cx: center.x, cy: center.y,
                            r: (ellipse.rx + ellipse.ry) / 2, c: color, byLayer });
                    } else {
                        pushRender({ t: 'ellipse', l, et, handle, cx: center.x, cy: center.y,
                            rx: ellipse.rx, ry: ellipse.ry, rot: ellipse.rot, c: color, byLayer });
                    }
                }
                break;

            case 'ARC':
                if (e.center && e.radius != null && e.startAngle != null && e.endAngle != null) {
                    const sourceCenter = { x: finiteNumber(e.center.x), y: finiteNumber(e.center.y) };
                    const center = tp(sourceCenter.x, sourceCenter.y);
                    const radius = Math.abs(finiteNumber(e.radius));
                    const startAngle = finiteNumber(e.startAngle);
                    const endAngle = finiteNumber(e.endAngle);
                    if (metrics.similarity) {
                        const start = tp(sourceCenter.x + radius * Math.cos(startAngle),
                            sourceCenter.y + radius * Math.sin(startAngle));
                        const end = tp(sourceCenter.x + radius * Math.cos(endAngle),
                            sourceCenter.y + radius * Math.sin(endAngle));
                        const transformedRadius = Math.hypot(start.x - center.x, start.y - center.y);
                        let sa = Math.atan2(start.y - center.y, start.x - center.x);
                        let ea = Math.atan2(end.y - center.y, end.x - center.x);
                        if (tfMirrored) [sa, ea] = [ea, sa];
                        expand(center.x - transformedRadius, center.y - transformedRadius);
                        expand(center.x + transformedRadius, center.y + transformedRadius);
                        pushRender({ t: 'arc', l, et, handle, cx: center.x, cy: center.y,
                            r: transformedRadius, sa, ea, c: color, byLayer });
                    } else {
                        diagnostics.approximatedNonUniformArcs += 1;
                        let sweep = endAngle - startAngle;
                        while (sweep <= 0) sweep += Math.PI * 2;
                        sweep = Math.min(sweep, Math.PI * 2);
                        const steps = Math.min(64, Math.max(12, Math.ceil(sweep / (Math.PI / 36))));
                        const verts = [];
                        for (let step = 0; step <= steps; step += 1) {
                            const angle = startAngle + sweep * (step / steps);
                            const point = tp(sourceCenter.x + radius * Math.cos(angle),
                                sourceCenter.y + radius * Math.sin(angle));
                            appendGeneratedVertex(verts, { ...point, bulge: 0 });
                            expand(point.x, point.y);
                        }
                        pushRender({ t: 'poly', l, et, handle, verts, closed: false, c: color, byLayer });
                    }
                }
                break;

            case 'ELLIPSE':
                if (e.center && e.majorAxisEndPoint) {
                    const center = tp(e.center.x, e.center.y);
                    const majorX = finiteNumber(e.majorAxisEndPoint.x);
                    const majorY = finiteNumber(e.majorAxisEndPoint.y);
                    const ratio = Math.abs(finiteNumber(e.axisRatio ?? e.minorToMajorRatio, 0.5));
                    const ellipse = ellipseFromAxes(
                        center,
                        transformVector(majorX, majorY, tf),
                        transformVector(-majorY * ratio, majorX * ratio, tf),
                    );
                    expand(center.x - ellipse.extentX, center.y - ellipse.extentY);
                    expand(center.x + ellipse.extentX, center.y + ellipse.extentY);
                    pushRender({ t: 'ellipse', l, et, handle, cx: center.x, cy: center.y,
                        rx: ellipse.rx, ry: ellipse.ry, rot: ellipse.rot, c: color, byLayer });
                }
                break;

            case 'SPLINE': {
                let pts = null;
                if (e.fitPoints && e.fitPoints.length > 1) {
                    pts = e.fitPoints;
                } else if (e.controlPoints && e.controlPoints.length > 1) {
                    pts = e.controlPoints;
                }
                if (pts) {
                    const verts = pts.map(p => {
                        const tp2 = tp(p.x, p.y);
                        return { x: tp2.x, y: tp2.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    const closed = !!(e.flag & 512) || !!(e.flag & 1);
                    pushRender({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer });
                }
                break;
            }

            case 'TEXT': {
                if (!e.text) break;
                const useEnd = ((e.halign || 0) > 0 || (e.valign || 0) > 0);
                const sourceBasePoint = e.startPoint || e.insertionPoint;
                const alignmentPoint = useEnd ? (e.alignmentPoint || e.endPoint) : null;
                const pt = alignmentPoint || sourceBasePoint || e.endPoint;
                if (!pt) break;
                const p = tp(pt.x, pt.y);
                const textMetrics = transformedTextMetrics(e.rotation, tf);
                if (tf && !metrics.similarity) diagnostics.approximatedNonUniformText += 1;
                expand(p.x, p.y);
                const fontName = state.styleFontMap[boundedString(e.styleName || e.style || '').toUpperCase()] || '';
                const primitive = { t: 'text', l, et, handle, x: p.x, y: p.y, text: e.text,
                    h: (e.textHeight || 2.5) * textMetrics.heightScale, rot: textMetrics.rotation,
                    c: color, byLayer, fontName };
                if (alignmentPoint && sourceBasePoint) {
                    const basePoint = tp(sourceBasePoint.x, sourceBasePoint.y);
                    primitive.usesAlignmentPoint = true;
                    primitive.sourceBaseX = basePoint.x;
                    primitive.sourceBaseY = basePoint.y;
                }
                pushRender(primitive);
                break;
            }

            case 'MTEXT': {
                const pt = e.insertionPoint;
                if (pt && e.text) {
                    const p = tp(pt.x, pt.y);
                    const textMetrics = transformedTextMetrics(e.rotation, tf);
                    if (tf && !metrics.similarity) diagnostics.approximatedNonUniformText += 1;
                    expand(p.x, p.y);
                    const clean = boundedString(e.text)
                        .replace(/\\P/g, '\n')
                        .replace(/\\~/g, ' ')
                        .replace(/\\[fFHWACcTQpq][^;]*;/g, '')
                        .replace(/\\S([^^;]*)\^([^;]*);/g, '$1/$2')
                        .replace(/\\[LlOoKk]/g, '')
                        .replace(/[{}]/g, '')
                        .replace(/\\\\/g, '\\');
                    const fontName = state.styleFontMap[boundedString(e.styleName || e.style || '').toUpperCase()] || '';
                    pushRender({ t: 'text', l, et: 'MTEXT', handle, x: p.x, y: p.y, text: clean,
                        h: (e.textHeight || 2.5) * textMetrics.heightScale, rot: textMetrics.rotation,
                        c: color, byLayer, fontName });
                }
                break;
            }

            case 'ATTRIB': {
                if (e.flags && (e.flags & 1)) {
                    emptyResultIsRepresented = true;
                    break;
                }
                // libredwg-web: e.text is a DwgTextBase object with .text, .startPoint, .endPoint, .textHeight, etc.
                const tb = (typeof e.text === 'object' && e.text !== null) ? e.text : null;
                const textStr = tb ? tb.text : (typeof e.text === 'string' ? e.text : null);
                if (!textStr) break;
                const halign = tb ? (tb.halign || 0) : (e.halign || 0);
                const valign = tb ? (tb.valign || 0) : (e.valign || 0);
                const useEnd = (halign > 0 || valign > 0);
                const sourceBasePoint = (tb && tb.startPoint) || e.insertionPoint || e.startPoint;
                const alignmentPoint = useEnd ? (e.alignmentPoint || (tb && tb.endPoint) || e.endPoint) : null;
                const pt = alignmentPoint || sourceBasePoint || (tb && tb.endPoint) || e.endPoint;
                if (!pt) break;
                const p = tp(pt.x, pt.y);
                const rotation = (tb && tb.rotation) || e.rotation || 0;
                const textMetrics = transformedTextMetrics(rotation, tf);
                if (tf && !metrics.similarity) diagnostics.approximatedNonUniformText += 1;
                expand(p.x, p.y);
                const sName = (tb && tb.styleName) || e.styleName || e.style || '';
                const fontName = state.styleFontMap[boundedString(sName).toUpperCase()] || '';
                const tHeight = (tb && tb.textHeight) || e.textHeight || 2.5;
                const primitive = { t: 'text', l, et: 'ATTRIB', handle, x: p.x, y: p.y, text: textStr,
                    h: tHeight * textMetrics.heightScale, rot: textMetrics.rotation,
                    c: color, byLayer, fontName };
                if (alignmentPoint && sourceBasePoint) {
                    const basePoint = tp(sourceBasePoint.x, sourceBasePoint.y);
                    primitive.usesAlignmentPoint = true;
                    primitive.sourceBaseX = basePoint.x;
                    primitive.sourceBaseY = basePoint.y;
                }
                pushRender(primitive);
                break;
            }

            case 'POINT': {
                const pt = e.location || e.point || e;
                if (pt && pt.x != null) {
                    const p = tp(pt.x, pt.y);
                    expand(p.x, p.y);
                    pushRender({ t: 'point', l, et, handle, x: p.x, y: p.y, c: color, byLayer });
                }
                break;
            }

            case 'SOLID':
            case '3DSOLID':
            case 'TRACE': {
                const pts = [e.firstCorner || e.point1, e.secondCorner || e.point2,
                             e.thirdCorner || e.point3, e.fourthCorner || e.point4].filter(Boolean);
                if (pts.length >= 3) {
                    const tpts = pts.map(p => tp(p.x, p.y));
                    for (const p of tpts) expand(p.x, p.y);
                    pushRender({ t: 'solid', l, et, handle, pts: tpts, c: color, byLayer });
                }
                break;
            }

            case 'HATCH': {
                emptyResultIsRepresented = true;
                const boundaries = e.boundaryPaths || [];
                const patternName = boundedString(e.patternName).trim();
                // DXF group 75 / `style` controls island handling, not whether
                // the hatch is solid. Rendering may trust the dedicated flag,
                // while HATCH_001 separately requires the SOLID pattern name.
                const isSolidFill = e.isSolidFill === true || Number(e.isSolidFill) === 1
                    || patternName.toUpperCase() === 'SOLID';
                diagnostics.hatchCount += 1;
                if (state.hatchInfo.length < LIMITS.reportedItems) {
                    state.hatchInfo.push({
                        handle,
                        layer: l,
                        patternName,
                        solid: !!isSolidFill,
                    });
                } else {
                    diagnostics.truncatedHatchDiagnostics += 1;
                }
                const paths = [];
                for (const bp of boundaries) {
                    if (bp.edges && bp.edges.length > 0) {
                        const verts = [];
                        for (const edge of bp.edges) {
                            const etype = edge.type ?? edge.edgeType ?? -1;
                            if (etype === 1) {
                                const sp = tp(edge.startPoint?.x ?? edge.start?.x, edge.startPoint?.y ?? edge.start?.y);
                                const ep = tp(edge.endPoint?.x ?? edge.end?.x, edge.endPoint?.y ?? edge.end?.y);
                                if (verts.length === 0) appendHatchVertex(verts, sp);
                                appendHatchVertex(verts, ep);
                            } else if (etype === 2) {
                                const cx = edge.center?.x ?? 0, cy = edge.center?.y ?? 0;
                                const r = edge.radius ?? 0;
                                const sa = finiteNumber(edge.startAngle);
                                const ea = finiteNumber(edge.endAngle, Math.PI * 2);
                                const ccw = tfMirrored ? (edge.isCCW === false) : (edge.isCCW !== false);
                                let sweep = ccw ? (ea - sa) : (sa - ea);
                                if (sweep <= 0) sweep += Math.PI * 2;
                                const steps = Math.min(256, Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 16))));
                                for (let si = 0; si <= steps; si++) {
                                    const frac = si / steps;
                                    const angle = ccw ? (sa + sweep * frac) : (sa - sweep * frac);
                                    const pt = tp(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
                                    if (si === 0 && verts.length > 0) {
                                        const last = verts[verts.length - 1];
                                        if (Math.abs(last.x - pt.x) < 1e-4 && Math.abs(last.y - pt.y) < 1e-4) continue;
                                    }
                                    appendHatchVertex(verts, pt);
                                }
                            } else if (etype === 3) {
                                const cx = edge.center?.x ?? 0, cy = edge.center?.y ?? 0;
                                const majorEnd = edge.majorAxisEndPoint || edge.endMajorAxis || { x: 1, y: 0 };
                                const majorLen = Math.hypot(majorEnd.x, majorEnd.y);
                                const minorLen = (edge.lengthOfMinorAxis || 0.5) * (majorLen || 1);
                                const rot = Math.atan2(majorEnd.y, majorEnd.x);
                                const sa = finiteNumber(edge.startAngle);
                                const ea = finiteNumber(edge.endAngle, Math.PI * 2);
                                const ccw = edge.isCCW !== false;
                                let sweep = ccw ? (ea - sa) : (sa - ea);
                                if (sweep <= 0) sweep += Math.PI * 2;
                                const steps = Math.min(256, Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 16))));
                                for (let si = 0; si <= steps; si++) {
                                    const frac = si / steps;
                                    const angle = ccw ? (sa + sweep * frac) : (sa - sweep * frac);
                                    const lx = majorLen * Math.cos(angle);
                                    const ly = minorLen * Math.sin(angle);
                                    const px = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
                                    const py = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
                                    const pt = tp(px, py);
                                    if (si === 0 && verts.length > 0) {
                                        const last = verts[verts.length - 1];
                                        if (Math.abs(last.x - pt.x) < 1e-4 && Math.abs(last.y - pt.y) < 1e-4) continue;
                                    }
                                    appendHatchVertex(verts, pt);
                                }
                            } else if (etype === 4) {
                                const pts = edge['fitDatum'] || edge.controlPoints || [];
                                for (let si = 0; si < pts.length; si++) {
                                    const sp = pts[si];
                                    const pt = tp(sp.x, sp.y);
                                    if (si === 0 && verts.length > 0) {
                                        const last = verts[verts.length - 1];
                                        if (Math.abs(last.x - pt.x) < 1e-4 && Math.abs(last.y - pt.y) < 1e-4) continue;
                                    }
                                    appendHatchVertex(verts, pt);
                                }
                            }
                        }
                        if (verts.length > 1) {
                            for (const v of verts) expand(v.x, v.y);
                            const polyVerts = verts.map(v => ({ x: v.x, y: v.y, bulge: 0 }));
                            pushRender({ t: 'poly', l, et, handle, verts: polyVerts, closed: true, c: color, byLayer });
                            if (isSolidFill) paths.push(polyVerts);
                        }
                    }
                    if (bp.vertices && bp.vertices.length > 1) {
                        const closed = bp.isClosed !== false;
                        const verts = transformPolylineVertices(bp.vertices, closed, tf, metrics);
                        for (const v of verts) expand(v.x, v.y);
                        pushRender({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer });
                        if (isSolidFill) paths.push(verts);
                    }
                }
                if (isSolidFill && paths.length > 0) {
                    pushRender({ t: 'hatchfill', l, et, handle, paths, c: color, byLayer, patternName });
                }
                break;
            }

            case 'DIMENSION': {
                emptyResultIsRepresented = true;
                if (state.dimensionInfo.length < LIMITS.reportedItems) {
                    state.dimensionInfo.push({
                        handle,
                        layer: l,
                        // Group code 70 encodes the dimension TYPE, not
                        // associativity — bit 32 is set on every dimension that
                        // owns an anonymous block, so testing it would report
                        // every dimension as non-associative. Real associativity
                        // lives in the ACAD_DIMASSOC entry of the dimension's
                        // extension dictionary; `dimensionAssociativity` resolves
                        // exactly that, and returns null when the drawing carries
                        // no dictionary to read.
                        associative: dimensionAssociativity(e),
                    });
                } else {
                    diagnostics.truncatedDimensionDiagnostics += 1;
                }
                if (e.name && blockMap[e.name]) {
                    const blockName = boundedString(e.name);
                    if (blockPath.includes(blockName)) {
                        diagnostics.skippedCyclicInserts += 1;
                        break;
                    }
                    if (depth >= LIMITS.blockExpansionDepth) {
                        diagnostics.skippedDepthLimitedInserts += 1;
                        break;
                    }
                    const block = blockMap[e.name];
                    for (const be of (Array.isArray(block.entities) ? block.entities : [])) {
                        addEntity(be, tf, l, color, depth + 1, [...blockPath, blockName]);
                    }
                } else {
                    if (e.name) diagnostics.unresolvedBlockReferences += 1;
                    const pts = [];
                    if (e.definitionPoint) pts.push(e.definitionPoint);
                    if (e.subDefinitionPoint1) pts.push(e.subDefinitionPoint1);
                    if (e.subDefinitionPoint2) pts.push(e.subDefinitionPoint2);
                    for (let i = 0; i + 1 < pts.length; i++) {
                        const p1 = tp(pts[i].x, pts[i].y);
                        const p2 = tp(pts[i + 1].x, pts[i + 1].y);
                        expand(p1.x, p1.y); expand(p2.x, p2.y);
                        pushRender({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                    }
                    if (e.textPoint && e.measurement != null) {
                        const p = tp(e.textPoint.x, e.textPoint.y);
                        expand(p.x, p.y);
                        const txt = e.text || finiteNumber(e.measurement).toFixed(0);
                        pushRender({ t: 'text', l, et, handle, x: p.x, y: p.y, text: txt, h: 2.5, rot: 0, c: color, byLayer });
                    }
                }
                break;
            }

            case 'LEADER': {
                if (e.vertices && e.vertices.length > 1) {
                    const verts = e.vertices.map(v => {
                        const p = tp(v.x, v.y);
                        return { x: p.x, y: p.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    pushRender({ t: 'poly', l, et, handle, verts, closed: false, c: color, byLayer });
                }
                break;
            }

            case 'MLINE': {
                if (e.vertices && e.vertices.length > 1) {
                    const verts = e.vertices.map(v => {
                        const pt = v.point || v;
                        const p = tp(pt.x, pt.y);
                        return { x: p.x, y: p.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    pushRender({ t: 'poly', l, et, handle, verts, closed: false, c: color, byLayer });
                }
                break;
            }

            case '3DFACE': {
                const pts = [e.firstCorner, e.secondCorner, e.thirdCorner, e.fourthCorner].filter(Boolean);
                if (pts.length >= 3) {
                    const tpts = pts.map(p => tp(p.x, p.y));
                    for (const p of tpts) expand(p.x, p.y);
                    const verts = tpts.map(p => ({ x: p.x, y: p.y, bulge: 0 }));
                    pushRender({ t: 'poly', l, et, handle, verts, closed: true, c: color, byLayer });
                }
                break;
            }

            case 'RAY': {
                if (e.basePoint && e.direction) {
                    const p1 = tp(e.basePoint.x, e.basePoint.y);
                    const len = 1e6;
                    const p2 = tp(e.basePoint.x + e.direction.x * len, e.basePoint.y + e.direction.y * len);
                    expand(p1.x, p1.y);
                    pushRender({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                }
                break;
            }

            case 'XLINE': {
                if (e.basePoint && e.direction) {
                    const len = 1e6;
                    const p1 = tp(e.basePoint.x - e.direction.x * len, e.basePoint.y - e.direction.y * len);
                    const p2 = tp(e.basePoint.x + e.direction.x * len, e.basePoint.y + e.direction.y * len);
                    pushRender({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                }
                break;
            }

            case 'INSERT': {
                emptyResultIsRepresented = true;
                diagnostics.insertReferences += 1;
                if (!e.insertionPoint || !e.name) {
                    diagnostics.skippedMalformedInserts += 1;
                    break;
                }
                const blockName = boundedString(e.name);
                const block = blockMap[blockName];
                if (!block || !block.entities) {
                    diagnostics.unresolvedBlockReferences += 1;
                    break;
                }
                if (blockPath.includes(blockName)) {
                    diagnostics.skippedCyclicInserts += 1;
                    break;
                }
                if (depth >= LIMITS.blockExpansionDepth) {
                    diagnostics.skippedDepthLimitedInserts += 1;
                    break;
                }

                // Handle OCS extrusion: when normal is (0,0,-1), the X-axis is negated
                // Normalize into equivalent scale/rotation so downstream mirroring logic works
                let ipx = e.insertionPoint.x;
                let ipy = e.insertionPoint.y;
                let eXScale = e.xScale ?? 1;
                let eYScale = e.yScale ?? 1;
                let eRotation = e.rotation || 0;
                const ez = e.extrusionDirection?.z;
                if (ez != null && ez < 0) {
                    ipx = -ipx;
                    eYScale = -eYScale;
                    eRotation = Math.PI - eRotation;
                }

                const origin = block.origin || block.basePoint;
                if (origin && sourceHasInvalidGeometry({ basePoint: origin })) {
                    diagnostics.invalidCoordinateEntities += 1;
                    break;
                }
                const localTransform = insertTransform(
                    { x: ipx, y: ipy },
                    eXScale,
                    eYScale,
                    eRotation,
                    origin,
                );
                const ins = composeTransforms(tf, localTransform);

                const hasAttribs = e.attribs && e.attribs.length > 0;

                for (const be of (Array.isArray(block.entities) ? block.entities : [])) {
                    if (be.type === 'ATTDEF' || be.type === 'ATTRIB') continue;
                    addEntity(be, ins, l, color, depth + 1, [...blockPath, blockName]);
                }

                if (hasAttribs) {
                    for (const attr of e.attribs) {
                        addEntity(attr, tf, l, color, depth + 1, [...blockPath, blockName]);
                    }
                }
                break;
            }

            default:
                usedDefaultUnsupportedBranch = true;
                diagnostics.skippedUnsupportedEntities += 1;
                if (l === 'R_RAUMPOLYGON' || l === 'R_GESCHOSSPOLYGON' || l === 'R_AOID'
                    || forbiddenValidationTypes.has(et)) {
                    preserveValidationMetadata({ t: 'unsupported', l, et, handle });
                }
                break;
        }
        if (renderList.length === renderCountBefore
            && diagnostics.invalidTransformedPrimitives === invalidPrimitiveCountBefore
            && !usedDefaultUnsupportedBranch && !emptyResultIsRepresented) {
            if (state.unsupportedEntities.length + diagnostics.truncatedValidationMetadata
                    === validationDiagnosticCountBefore
                && (l === 'R_RAUMPOLYGON' || l === 'R_GESCHOSSPOLYGON' || l === 'R_AOID'
                    || forbiddenValidationTypes.has(et))) {
                preserveValidationMetadata({ t: 'unsupported', l, et, handle });
            }
            diagnostics.skippedNonRenderableEntities += 1;
        }
    }

    for (const e of entities) {
        if (e.type === 'ATTRIB' || e.type === 'ATTDEF') continue;
        addEntity(e, null, null, null);
    }

    const vertexBudget = { count: 0 };
    const safeRenderList = renderList.map((item) => normalizePrimitive(item, vertexBudget)).filter(Boolean);
    const bounds = computeBounds(safeRenderList);
    const layerInfo = buildLayerInfo(safeRenderList, layers);
    const entitySummary = buildEntitySummary(entities);
    diagnostics.expandedEntityCount = expandedEntityCount;
    diagnostics.renderPrimitiveCount = safeRenderList.length;
    diagnostics.totalVertices = vertexBudget.count;
    diagnostics.nonZeroZEntityCount = state.nonZeroZEntityCount;
    const incompletenessReasons = [];
    const addIncompleteness = (code, count, message) => {
        if (count > 0) incompletenessReasons.push({ code, count, message });
    };
    addIncompleteness('CYCLIC_BLOCK_REFERENCE', diagnostics.skippedCyclicInserts,
        'Zyklische Blockreferenzen wurden nicht aufgelöst.');
    addIncompleteness('BLOCK_EXPANSION_DEPTH_LIMIT', diagnostics.skippedDepthLimitedInserts,
        'Blockreferenzen jenseits der maximalen Verschachtelungstiefe wurden nicht aufgelöst.');
    addIncompleteness('MALFORMED_BLOCK_REFERENCE', diagnostics.skippedMalformedInserts,
        'Blockreferenzen ohne Namen oder Einfügepunkt wurden nicht aufgelöst.');
    addIncompleteness('UNRESOLVED_BLOCK_REFERENCE', diagnostics.unresolvedBlockReferences,
        'Blockreferenzen mit fehlender Blockdefinition wurden nicht aufgelöst.');
    addIncompleteness('UNSUPPORTED_ENTITY', diagnostics.skippedUnsupportedEntities,
        'Nicht unterstützte oder unbekannte CAD-Objekte wurden nicht ausgewertet.');
    addIncompleteness('NON_RENDERABLE_ENTITY', diagnostics.skippedNonRenderableEntities,
        'CAD-Objekte ohne auswertbare Geometrie wurden nicht ausgewertet.');
    addIncompleteness('DIAGNOSTIC_OUTPUT_LIMIT', diagnostics.truncatedValidationMetadata,
        'Zusätzliche Objektdiagnosen konnten wegen des Ausgabelimits nicht einzeln aufgeführt werden.');
    addIncompleteness('HATCH_DIAGNOSTIC_OUTPUT_LIMIT', diagnostics.truncatedHatchDiagnostics,
        'Zusätzliche Schraffuren konnten wegen des Diagnoselimits nicht einzeln ausgewertet werden.');
    addIncompleteness('DIMENSION_DIAGNOSTIC_OUTPUT_LIMIT', diagnostics.truncatedDimensionDiagnostics,
        'Zusätzliche Masselemente konnten wegen des Diagnoselimits nicht einzeln ausgewertet werden.');
    addIncompleteness('STYLE_METADATA_OUTPUT_LIMIT', diagnostics.truncatedStyleMetadata,
        'Zusätzliche Textstile konnten wegen des Metadatenlimits nicht ausgewertet werden.');
    addIncompleteness('LAYOUT_METADATA_OUTPUT_LIMIT', diagnostics.truncatedLayoutMetadata,
        'Zusätzliche Layouts konnten wegen des Metadatenlimits nicht ausgewertet werden.');
    addIncompleteness('INVALID_GEOMETRY_VALUE',
        diagnostics.invalidCoordinateEntities + diagnostics.invalidTransformedPrimitives,
        'CAD-Objekte mit ungültigen oder nicht darstellbaren Geometriewerten wurden nicht ausgewertet.');
    addIncompleteness('INVISIBLE_ENTITY_NOT_VALIDATED', diagnostics.skippedInvisibleEntities,
        'Unsichtbare CAD-Objekte wurden nicht vollständig fachlich ausgewertet.');
    addIncompleteness('CONVERTER_UNKNOWN_ENTITY', diagnostics.converterUnknownEntityCount,
        'Die DWG-Konvertierung meldet unbekannte CAD-Objekte, die nicht ausgewertet wurden.');
    const completeness = {
        status: incompletenessReasons.length ? 'incomplete' : 'complete',
        complete: incompletenessReasons.length === 0,
        reasons: incompletenessReasons,
    };

    return {
        renderList: safeRenderList,
        bounds,
        insunits: state.insunits,
        styleFontMap: state.styleFontMap,
        paperSpaceLayouts: state.paperSpaceLayouts,
        xrefBlocks: state.xrefBlocks,
        nonZeroZEntities: state.nonZeroZEntities,
        dimensionInfo: state.dimensionInfo,
        hatchInfo: state.hatchInfo,
        validationMetadata: state.unsupportedEntities,
        entitySummary,
        diagnostics,
        completeness,
        layerInfo,
    };
}

export function buildLayerInfo(entities, layers) {
    const counts = Object.create(null);
    const fallbackColors = Object.create(null);
    for (const entity of entities) {
        const name = boundedString(entity?.l ?? entity?.layer ?? '0', '0');
        counts[name] = (counts[name] || 0) + 1;
        if (!fallbackColors[name] && entity?.c) fallbackColors[name] = boundedString(entity.c, '#CCCCCC');
    }
    const records = new Map();
    for (const layer of layers) records.set(boundedString(layer?.name, '0'), layer);
    for (const name of Object.keys(counts)) {
        if (!records.has(name)) records.set(name, { name });
    }
    return [...records].map(([name, layer]) => ({
        name,
        colorHex: layer?.colorIndex != null || layer?.color != null
            ? layerColorHex(layer)
            : (fallbackColors[name] || '#CCCCCC'),
        colorIndex: Number.isFinite(Number(layer?.colorIndex)) ? Number(layer.colorIndex) : null,
        count: counts[name] || 0,
    }));
}

export function buildEntitySummary(entities) {
    const typeCounts = Object.create(null);
    const typeLayers = Object.create(null);
    for (const e of entities) {
        const entityType = boundedString(e?.type, 'UNKNOWN');
        typeCounts[entityType] = (typeCounts[entityType] || 0) + 1;
        if (!typeLayers[entityType]) typeLayers[entityType] = new Set();
        if (e?.layer && typeLayers[entityType].size < LIMITS.reportedItems) {
            typeLayers[entityType].add(boundedString(e.layer));
        }
    }
    return Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, LIMITS.metadataEntries)
        .map(([type, count]) => ({
            type,
            count,
            layers: typeLayers[type] ? Array.from(typeLayers[type]) : [],
        }));
}
