/*
 * Offline mock of firebase/firestore, used only by `npm run dev:mock`.
 * It stores documents in localStorage and supports the subset of the API this app uses.
 * It does NOT enforce security rules; the real rules live in firestore.rules.
 */
const DB_KEY = 'quietink.mock.db';

let store = {};
try { store = JSON.parse(localStorage.getItem(DB_KEY) || '{}'); } catch (e) { store = {}; }
function persist() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
}

/* ---------- sentinels and timestamps ---------- */
const SENTINEL = '__mockSentinel';
export const serverTimestamp = () => ({ [SENTINEL]: 'ts' });
export const increment = (n) => ({ [SENTINEL]: 'inc', n });
export const arrayUnion = (...v) => ({ [SENTINEL]: 'union', v });
export const arrayRemove = (...v) => ({ [SENTINEL]: 'remove', v });
export const deleteField = () => ({ [SENTINEL]: 'delete' });

function makeTs(ms) {
  return { __ts: ms };
}
function revive(value) {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    if ('__ts' in value) {
      const ms = value.__ts;
      return { seconds: Math.floor(ms / 1000), toMillis: () => ms, toDate: () => new Date(ms) };
    }
    const out = {};
    for (const k of Object.keys(value)) out[k] = revive(value[k]);
    return out;
  }
  return value;
}
function plain(value) {
  // Convert revived timestamps back to storable form.
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    if (typeof value.toMillis === 'function') return makeTs(value.toMillis());
    if (value[SENTINEL]) return value;
    const out = {};
    for (const k of Object.keys(value)) if (value[k] !== undefined) out[k] = plain(value[k]);
    return out;
  }
  return value;
}
function resolveSentinel(current, s) {
  switch (s[SENTINEL]) {
    case 'ts': return makeTs(Date.now());
    case 'inc': return (typeof current === 'number' ? current : 0) + s.n;
    case 'union': {
      const arr = Array.isArray(current) ? current.slice() : [];
      s.v.forEach((x) => { if (!arr.some((y) => JSON.stringify(y) === JSON.stringify(x))) arr.push(x); });
      return arr;
    }
    case 'remove': {
      const arr = Array.isArray(current) ? current : [];
      return arr.filter((y) => !s.v.some((x) => JSON.stringify(x) === JSON.stringify(y)));
    }
    case 'delete': return undefined;
    default: return current;
  }
}
function resolveDeep(value) {
  if (value && typeof value === 'object' && value[SENTINEL]) return resolveSentinel(undefined, value);
  if (Array.isArray(value)) return value.map(resolveDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      const r = resolveDeep(value[k]);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return value;
}

/* ---------- references ---------- */
let autoId = 0;
function newId() {
  autoId += 1;
  return Date.now().toString(36) + autoId.toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getFirestore() {
  return { mock: true };
}

export function doc(base, ...segments) {
  let path;
  if (base && base.type === 'col') {
    path = [base.path, ...(segments.length ? segments : [newId()])].join('/');
  } else if (base && base.type === 'doc') {
    path = [base.path, ...segments].join('/');
  } else {
    path = segments.join('/');
  }
  const parts = path.split('/');
  return { type: 'doc', path, id: parts[parts.length - 1] };
}

export function collection(base, ...segments) {
  const prefix = base && base.type === 'doc' ? [base.path] : [];
  return { type: 'col', path: [...prefix, ...segments].join('/') };
}

export function collectionGroup(db, id) {
  return { type: 'group', id };
}

export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const limit = (n) => ({ kind: 'limit', n });
export const query = (ref, ...constraints) => ({ type: 'query', ref, constraints });

function snapshot(ref) {
  const raw = store[ref.path];
  return {
    id: ref.id,
    ref,
    exists: () => raw !== undefined,
    data: () => (raw === undefined ? undefined : revive(raw))
  };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

export async function getDoc(ref) {
  await tick();
  return snapshot(ref);
}
export const getDocFromServer = getDoc;

function getField(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function cmpVal(v) {
  if (v && typeof v === 'object' && '__ts' in v) return v.__ts;
  return v;
}

function runQuery(q) {
  const ref = q.type === 'query' ? q.ref : q;
  const constraints = q.type === 'query' ? q.constraints : [];
  let paths = Object.keys(store);
  if (ref.type === 'col') {
    const depth = ref.path.split('/').length + 1;
    paths = paths.filter((p) => p.startsWith(ref.path + '/') && p.split('/').length === depth);
  } else if (ref.type === 'group') {
    paths = paths.filter((p) => {
      const parts = p.split('/');
      return parts.length >= 2 && parts[parts.length - 2] === ref.id;
    });
  }
  let rows = paths.map((p) => ({ path: p, data: store[p] }));
  for (const c of constraints.filter((x) => x.kind === 'where')) {
    rows = rows.filter(({ data }) => {
      const v = cmpVal(getField(data, c.field));
      const t = cmpVal(c.value);
      switch (c.op) {
        case '==': return v === t;
        case '!=': return v !== t;
        case 'in': return c.value.includes(v);
        case 'array-contains': return Array.isArray(v) && v.includes(t);
        case '>=': return v >= t;
        case '<=': return v <= t;
        case '>': return v > t;
        case '<': return v < t;
        default: return true;
      }
    });
  }
  const orders = constraints.filter((x) => x.kind === 'orderBy');
  if (orders.length) {
    rows.sort((a, b) => {
      for (const o of orders) {
        const x = cmpVal(getField(a.data, o.field));
        const y = cmpVal(getField(b.data, o.field));
        if (x === y) continue;
        const r = x > y ? 1 : -1;
        return o.dir === 'desc' ? -r : r;
      }
      return 0;
    });
  }
  const lim = constraints.find((x) => x.kind === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  return rows.map((r) => snapshot(doc(null, ...r.path.split('/'))));
}

export async function getDocs(q) {
  await tick();
  const docs = runQuery(q);
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

export async function getCountFromServer(q) {
  await tick();
  const n = runQuery(q).length;
  return { data: () => ({ count: n }) };
}

/* ---------- writes ---------- */
function applySet(ref, data, opts) {
  const resolved = resolveDeep(plain(data));
  if (opts && opts.merge && store[ref.path]) {
    store[ref.path] = { ...store[ref.path], ...resolved };
  } else {
    store[ref.path] = resolved;
  }
}

function applyUpdate(ref, data) {
  if (store[ref.path] === undefined) {
    const err = new Error(`No document to update: ${ref.path}`);
    err.code = 'not-found';
    throw err;
  }
  const target = JSON.parse(JSON.stringify(store[ref.path]));
  for (const key of Object.keys(data)) {
    const parts = key.split('.');
    let o = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    const last = parts[parts.length - 1];
    const val = data[key];
    let next;
    if (val && typeof val === 'object' && val[SENTINEL]) next = resolveSentinel(o[last], val);
    else next = resolveDeep(plain(val));
    if (next === undefined) delete o[last];
    else o[last] = next;
  }
  store[ref.path] = target;
}

export async function setDoc(ref, data, opts) {
  await tick();
  applySet(ref, data, opts);
  persist();
}
export async function updateDoc(ref, data) {
  await tick();
  applyUpdate(ref, data);
  persist();
}
export async function deleteDoc(ref) {
  await tick();
  delete store[ref.path];
  persist();
}
export async function addDoc(colRef, data) {
  const ref = doc(colRef);
  await setDoc(ref, data);
  return ref;
}

export function writeBatch() {
  const ops = [];
  return {
    set(ref, data, opts) { ops.push(() => applySet(ref, data, opts)); return this; },
    update(ref, data) { ops.push(() => applyUpdate(ref, data)); return this; },
    delete(ref) { ops.push(() => { delete store[ref.path]; }); return this; },
    async commit() { await tick(); ops.forEach((f) => f()); persist(); }
  };
}

export async function runTransaction(db, fn) {
  const tx = {
    get: async (ref) => snapshot(ref),
    set(ref, data, opts) { applySet(ref, data, opts); return tx; },
    update(ref, data) { applyUpdate(ref, data); return tx; },
    delete(ref) { delete store[ref.path]; return tx; }
  };
  const before = JSON.stringify(store);
  try {
    const out = await fn(tx);
    persist();
    return out;
  } catch (e) {
    store = JSON.parse(before);
    throw e;
  }
}
