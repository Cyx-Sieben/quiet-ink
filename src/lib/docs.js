/**
 * Export helpers: save a finished page to Google Docs (via the OAuth token from
 * the Google sign-in), with a .docx download as the everywhere-else fallback.
 */
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase.js';
import { esc } from './ui.js';

const DOCS_SCOPE = 'https://www.googleapis.com/auth/documents';

/** Get a fresh-enough access token that includes the documents scope. */
async function docsToken() {
  if (!auth || !auth.currentUser) throw new Error('Please sign in first.');
  let token = null;
  try {
    token = await auth.currentUser.getIdToken();
  } catch (e) { /* fall through */ }
  // accessToken is the OAuth2 token for Google APIs (getIdToken is for Firebase).
  try {
    const cred = GoogleAuthProvider.credentialFromResult(JSON.parse(sessionStorage.getItem('quietink.lastSignIn') || 'null'));
    if (cred && cred.accessToken) {
      const res = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(cred.accessToken));
      if (res.ok) {
        const info = await res.json();
        if ((info.scope || '').includes('documents') && info.expires_in > 30) return cred.accessToken;
      }
    }
  } catch (e) { /* re-auth needed */ }
  // Re-run the sign-in popup to mint a token with the documents scope.
  const provider = new GoogleAuthProvider();
  provider.addScope(DOCS_SCOPE);
  const result = await signInWithPopup(auth, provider);
  const fresh = GoogleAuthProvider.credentialFromResult(result);
  if (!fresh || !fresh.accessToken) throw new Error('Google did not return a Docs permission. Try again.');
  return fresh.accessToken;
}

/**
 * Create a Google Doc titled after the week's concept and insert the piece.
 * Opens the finished document in a new tab.
 */
export async function exportToGoogleDocs(page, concept) {
  const token = await docsToken();
  const title = `${page.title || concept.name} — Quiet Ink`;

  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  if (!createRes.ok) throw new Error(await apiError(createRes, 'creating the document'));
  const doc = await createRes.json();

  const paragraphs = String(page.draft || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const insertRes = await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: paragraphs.map((text) => ({
        insertText: { location: { index: 1 }, text: text + '\n' }
      }))
    })
  });
  if (!insertRes.ok) {
    // The doc exists but is empty; still open it rather than failing entirely.
    window.open(`https://docs.google.com/document/d/${doc.documentId}/edit`, '_blank', 'noopener');
    throw new Error(await apiError(insertRes, 'filling in the text'));
  }

  window.open(`https://docs.google.com/document/d/${doc.documentId}/edit`, '_blank', 'noopener');
  return doc.documentId;
}

async function apiError(res, what) {
  let msg = `Google Docs API error while ${what}.`;
  try {
    const body = await res.json();
    if (body.error && body.error.message) msg = `Google Docs: ${body.error.message}`;
  } catch (e) { /* keep default */ }
  return msg;
}

/* ---------------------------------------------------------- .docx fallback */
/**
 * Minimal WordprocessingML .docx: one title paragraph plus body paragraphs.
 * Opens correctly in Google Docs, Word, Pages and LibreOffice.
 */
export function downloadDocx(page, concept) {
  const paras = String(page.draft || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${titlePara(page.title || concept.name)}
    ${subPara(`Quiet Ink · week of ${page.weekKey || ''}`)}
    ${paras.map((p) => bodyPara(p)).join('\n    ')}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  downloadZip([
    { path: '[Content_Types].xml', data: contentTypes },
    { path: '_rels/.rels', data: rels },
    { path: 'word/document.xml', data: docXml }
  ], `${slug(page.title || concept.name)}-quiet-ink.docx`);
}

const xmlEsc = (s) => esc(s);
const titlePara = (t) => `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r></w:p>`;
const subPara = (t) => `<w:p><w:pPr><w:rPr><w:i/></w:rPr></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r></w:p>`;
const bodyPara = (t) => `<w:p>${t.split('\n').map((line) => `<w:r><w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r><w:r><w:br/></w:r>`).join('')}</w:p>`;

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'my-page';
}

/** Store a ZIP (with STORE compression) from text files and trigger a download. */
function downloadZip(files, name) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (bytes) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  for (const f of files) {
    const nameBytes = enc.encode(f.path);
    const data = enc.encode(f.data);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);      // version needed
    local.setUint16(6, 0, true);       // flags
    local.setUint16(8, 0, true);       // stored
    local.setUint16(10, 0, true);      // time
    local.setUint16(12, 0x21, true);   // date (1996-01-01-ish, deterministic)
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);

    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 20, true);
    head.setUint16(8, 0, true);
    head.setUint16(10, 0, true);
    head.setUint16(12, 0, true);
    head.setUint16(14, 0x21, true);
    head.setUint32(16, crc, true);
    head.setUint32(20, data.length, true);
    head.setUint32(24, data.length, true);
    head.setUint16(28, nameBytes.length, true);
    head.setUint32(42, offset, true);
    central.push(new Uint8Array(head.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const blob = new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
