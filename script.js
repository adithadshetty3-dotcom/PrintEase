/* ---------- view router (keeps all state in memory, no page reloads) ---------- */
const views = ['welcome', 'upload', 'config', 'pay'];
function showView(name) {
  if (!views.includes(name)) name = 'welcome';
  views.forEach(v => { document.getElementById('view-' + v).hidden = (v !== name); });
  history.replaceState(null, '', '#' + name);
  window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const link = e.target.closest('.nav-link');
  if (!link) return;
  e.preventDefault();
  showView(link.dataset.target);
});
document.getElementById('shopkeeperLink').addEventListener('click', e => {
  e.preventDefault();
  alert('Shopkeeper Terminal — coming soon.');
});
// after a refresh the files are gone, so the pay screen cannot be restored
const firstView = (location.hash || '#welcome').slice(1);
showView(firstView === 'pay' ? 'upload' : firstView);

/* ---------- UPLOAD VIEW LOGIC ---------- */
const dropzone = document.getElementById('dropzone');
const pdfInput = document.getElementById('pdfInput');
const photoInput = document.getElementById('photoInput');
const pdfList = document.getElementById('pdfList');
const pdfEmpty = document.getElementById('pdfEmpty');
const photoGrid = document.getElementById('photoGrid');
const addPhotoTile = document.getElementById('addPhotoTile');
const pdfCount = document.getElementById('pdfCount');
const photoCount = document.getElementById('photoCount');
const continueBtn = document.getElementById('continueBtn');

let pdfFiles = [];
let photoFiles = [];

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/* ---------- open an uploaded document in a new tab (eye button) ---------- */
const previewUrls = new Map();

async function openDocument(file) {
  const name = file.name.toLowerCase();
  const isPdf = name.endsWith('.pdf');
  const isDocx = name.endsWith('.docx');

  if (!isPdf && !isDocx && !file.type.startsWith('image/')) {
    alert('Preview is available for PDF, DOCX and image files. Please save this file as PDF or DOCX to view it.');
    return;
  }

  // open the tab immediately, so the browser does not block it as a pop-up
  const tab = window.open('', '_blank');
  if (!tab) { alert('Please allow pop-ups for this page to open the document.'); return; }

  try {
    let url = previewUrls.get(file);
    if (!url) {
      let blob = file;
      if (isPdf) blob = new Blob([file], { type: 'application/pdf' });
      if (isDocx) blob = await docxToPage(file);
      url = URL.createObjectURL(blob);
      previewUrls.set(file, url);
    }
    tab.location.href = url;
  } catch (err) {
    console.warn('Could not open', file.name, err);
    tab.close();
    alert('Sorry, this document could not be opened.');
  }
}

// Word files cannot be shown by the browser directly, so convert them to a simple web page
async function docxToPage(file) {
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const body = new DOMParser().parseFromString(result.value, 'text/html').body;
  body.querySelectorAll('a[href]').forEach(a => {
    if (!/^(https?:|mailto:|#)/i.test(a.getAttribute('href'))) a.removeAttribute('href');
  });
  const title = file.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{max-width:800px;margin:0 auto;padding:40px;font-family:Calibri,Arial,sans-serif;line-height:1.5;background:#fff;color:#111}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}</style>
    </head><body>${body.innerHTML}</body></html>`], { type: 'text/html' });
}

function renderPdfs() {
  pdfList.querySelectorAll('.pdf-item').forEach(el => el.remove());
  pdfEmpty.style.display = pdfFiles.length ? 'none' : 'block';
  pdfFiles.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'pdf-item';
    row.innerHTML = `
      <span class="file-icon">📄</span>
      <span class="meta">
        <div class="fname">${file.name}</div>
        <div class="fsub">${formatSize(file.size)} • <span class="ready">Ready to Print</span></div>
      </span>
      <span class="actions">
        <button class="icon-action" type="button" aria-label="Preview ${file.name}" title="Open document">👁</button>
        <button class="icon-action" type="button" aria-label="Remove ${file.name}" data-idx="${idx}">✕</button>
      </span>`;
    row.querySelector('[aria-label^="Preview"]').addEventListener('click', () => openDocument(file));
    row.querySelector('[aria-label^="Remove"]').addEventListener('click', () => {
      pdfFiles.splice(idx, 1);
      renderPdfs();
    });
    pdfList.appendChild(row);
  });
  pdfCount.textContent = `${pdfFiles.length} file${pdfFiles.length === 1 ? '' : 's'} ready`;
  updateContinue();
}

function renderPhotos() {
  photoGrid.querySelectorAll('.photo-tile:not(.add-tile)').forEach(el => el.remove());
  photoFiles.forEach((file, idx) => {
    const tile = document.createElement('div');
    tile.className = 'photo-tile';
    const url = URL.createObjectURL(file);
    tile.innerHTML = `
      <img src="${url}" alt="${file.name}" />
      <button class="remove" type="button" aria-label="Remove ${file.name}">✕</button>
      <div class="caption">${file.name}</div>`;
    tile.querySelector('.remove').addEventListener('click', () => {
      photoFiles.splice(idx, 1);
      renderPhotos();
    });
    photoGrid.insertBefore(tile, addPhotoTile);
  });
  photoCount.textContent = `${photoFiles.length} image${photoFiles.length === 1 ? '' : 's'} attached`;
  updateContinue();
}

function updateContinue() {
  continueBtn.disabled = (pdfFiles.length + photoFiles.length) === 0;
}

document.getElementById('selectPdfBtn').addEventListener('click', () => pdfInput.click());
document.getElementById('addMorePdf').addEventListener('click', () => pdfInput.click());
document.getElementById('selectPhotoBtn').addEventListener('click', () => photoInput.click());
document.getElementById('addMorePhoto').addEventListener('click', () => photoInput.click());
addPhotoTile.addEventListener('click', () => photoInput.click());

pdfInput.addEventListener('change', e => {
  pdfFiles = pdfFiles.concat(Array.from(e.target.files));
  renderPdfs();
  pdfInput.value = '';
});
photoInput.addEventListener('change', e => {
  photoFiles = photoFiles.concat(Array.from(e.target.files));
  renderPhotos();
  photoInput.value = '';
});

['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
dropzone.addEventListener('drop', e => {
  const dropped = Array.from(e.dataTransfer.files);
  const imgs = dropped.filter(f => f.type.startsWith('image/'));
  const docs = dropped.filter(f => !f.type.startsWith('image/'));
  if (imgs.length) { photoFiles = photoFiles.concat(imgs); renderPhotos(); }
  if (docs.length) { pdfFiles = pdfFiles.concat(docs); renderPdfs(); }
});

continueBtn.addEventListener('click', async () => {
  continueBtn.disabled = true;
  continueBtn.textContent = 'Preparing…';
  await buildDocSources();
  continueBtn.textContent = 'Continue →';
  updateContinue();
  showView('config');
  renderDocTabs();
});

renderPdfs();
renderPhotos();

/* ---------- PRINT CONFIG VIEW LOGIC ---------- */
const BW_PRICE = 1;
const COLOUR_PRICE = 5;

// pdf.js — used to read the real page count of each uploaded PDF
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function getPdfPageCount(file) {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    return pdf.numPages;
  } catch (err) {
    console.warn('Could not read page count for', file.name, err);
    return 1;
  }
}

// docSources: one entry per uploaded PDF (real page count) plus one combined
// entry for all uploaded photos, if any. Nothing here is ever a placeholder —
// it is rebuilt from pdfFiles / photoFiles every time Continue is pressed.
let docSources = [];
let activeSourceIndex = 0;
let sheets = [];
const A3_EXTRA = 2;

// every document gets its OWN copy of these settings
function defaultSettings(type) {
  return { mode: type === 'photo' ? 'colour' : 'bw', sides: 'double', copies: 1, paper: 'a4', layout: 1 };
}
function activeSource() { return docSources[activeSourceIndex]; }

async function buildDocSources() {
  const pageCounts = await Promise.all(pdfFiles.map(getPdfPageCount));
  const previous = docSources;
  docSources = pdfFiles.map((file, i) => {
    // keep the choices already made for a file that is still uploaded
    const old = previous.find(s => s.file === file);
    return old || { type: 'pdf', file, name: file.name, pages: pageCounts[i], settings: defaultSettings('pdf') };
  });
  // every image is its own document, with its own settings (just like a PDF)
  photoFiles.forEach(file => {
    const old = previous.find(s => s.file === file);
    docSources.push(old || { type: 'photo', file, name: file.name, count: 1, settings: defaultSettings('photo') });
  });
  docSources.forEach(s => { if (!s.sheets) s.sheets = sheetsForSource(s); });
  activeSourceIndex = 0;
}

function sheetsForSource(source) {
  if (!source) return [];
  if (source.type === 'pdf') {
    const perSheet = source.settings.sides === 'double' ? 2 : 1;
    const count = Math.ceil(source.pages / perSheet);
    return Array.from({ length: count }, (_, i) => {
      const start = i * perSheet + 1;
      const end = Math.min(start + perSheet - 1, source.pages);
      return {
        name: `Sheet ${i + 1}`,
        doc: source.name,
        pages: start === end ? `p. ${start}` : `p. ${start}-${end}`,
        mode: source.settings.mode,
        checked: true,
      };
    });
  }
  // one image: one sheet, with the photo repeated as per the chosen layout
  const layout = source.settings.layout;
  return [{
    name: 'Sheet 1',
    doc: source.name,
    pages: layout === 1 ? '1 photo' : `photo repeated ${layout} times`,
    mode: source.settings.mode,
    checked: true,
  }];
}

function renderDocTabs() {
  const docTabs = document.getElementById('docTabs');
  docTabs.innerHTML = '';
  if (docSources.length === 0) {
    docTabs.innerHTML = '<div class="empty-note">No files uploaded yet — go back to Upload.</div>';
    document.getElementById('activeDocBadge').textContent = 'No document';
    document.getElementById('totalPagesHint').textContent = '—';
    sheets = [];
    renderSheets();
    updateSummary();
    return;
  }
  docSources.forEach((src, idx) => {
    const tab = document.createElement('button');
    tab.className = 'doc-tab' + (idx === activeSourceIndex ? ' active' : '');
    tab.innerHTML = src.type === 'pdf'
      ? `<div class="fname">${src.name}</div><div class="fsub">${src.pages} Page${src.pages === 1 ? '' : 's'}</div>`
      : `<div class="fname">${src.name}</div><div class="fsub">Image</div>`;
    tab.addEventListener('click', () => { activeSourceIndex = idx; renderDocTabs(); });
    docTabs.appendChild(tab);
  });
  const active = docSources[activeSourceIndex];
  document.getElementById('activeDocBadge').textContent = active.name;
  document.getElementById('totalPagesHint').textContent = active.type === 'pdf'
    ? `${active.pages} Page${active.pages === 1 ? '' : 's'} Total`
    : `${active.count} Image${active.count === 1 ? '' : 's'} Total`;
  sheets = active.sheets;
  updateAll();
}

const sheetList = document.getElementById('sheetList');

function setSheetMode(idx, mode) {
  sheets[idx].mode = mode;
  const src = activeSource();
  if (src.type === 'photo') src.settings.mode = mode; // an image has only one sheet
  renderSheets();
  updateSummary();
}

function renderSheets() {
  sheetList.innerHTML = '';
  sheets.forEach((s, idx) => {
    const row = document.createElement('div');
    row.className = 'sheet-row';
    row.innerHTML = `
      <input type="checkbox" ${s.checked ? 'checked' : ''} aria-label="Include ${s.name}" />
      <span class="sheet-num">${idx + 1}</span>
      <span class="sheet-meta">
        <div class="sname">${s.name}</div>
        <div class="ssub">${s.doc} (${s.pages})</div>
      </span>
      <span class="mode-toggle">
        <button class="bw ${s.mode === 'bw' ? 'on' : ''}" type="button">B&amp;W</button>
        <button class="colour ${s.mode === 'colour' ? 'on' : ''}" type="button">Colour</button>
      </span>`;
    row.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      sheets[idx].checked = e.target.checked;
      updateAll();
    });
    const [bwBtn, colourBtn] = row.querySelectorAll('.mode-toggle button');
    bwBtn.addEventListener('click', () => setSheetMode(idx, 'bw'));
    colourBtn.addEventListener('click', () => setSheetMode(idx, 'colour'));
    sheetList.appendChild(row);
  });
}

// price of ONE document, using only its own settings
function sourceTotals(src) {
  const s = src.settings;
  const enabled = src.sheets.filter(sheet => sheet.checked);
  const bw = enabled.filter(sheet => sheet.mode === 'bw').length;
  const colour = enabled.length - bw;
  const extra = s.paper === 'a3' ? A3_EXTRA * enabled.length : 0;
  const total = (bw * BW_PRICE + colour * COLOUR_PRICE + extra) * s.copies;
  return { count: enabled.length, bw, colour, total };
}

// the whole order is the sum of all documents (sheet numbers include copies)
function orderTotals() {
  const sum = { count: 0, bw: 0, colour: 0, a3: 0, total: 0 };
  docSources.forEach(src => {
    const t = sourceTotals(src);
    const n = src.settings.copies;
    sum.count += t.count * n;
    sum.bw += t.bw * n;
    sum.colour += t.colour * n;
    if (src.settings.paper === 'a3') sum.a3 += t.count * n;
    sum.total += t.total;
  });
  return sum;
}

// make the buttons show the settings of the selected document
function showActiveSettings() {
  const src = activeSource();
  const s = src ? src.settings : defaultSettings('pdf');
  const mark = (id, on, colourClass) => {
    const el = document.getElementById(id);
    el.classList.toggle('selected', on);
    el.classList.toggle(colourClass, on);
  };
  mark('bwCard', s.mode === 'bw', 'violet');
  mark('colourCard', s.mode === 'colour', 'violet');
  mark('singleSideCard', s.sides === 'single', 'violet');
  mark('doubleSideCard', s.sides === 'double', 'violet');
  mark('a4Card', s.paper === 'a4', 'teal');
  mark('a3Card', s.paper === 'a3', 'teal');
  document.querySelectorAll('.photo-opt').forEach(o => o.classList.toggle('selected', Number(o.dataset.layout) === s.layout));
  document.getElementById('copiesValue').textContent = `${s.copies} set${s.copies === 1 ? '' : 's'}`;
  const isPhoto = Boolean(src) && src.type === 'photo';
  document.getElementById('sidesBlock').hidden = isPhoto;
  document.getElementById('layoutBlock').hidden = !isPhoto;
}

function plural(n, word) { return `${n} ${n === 1 ? word : (word === 'copy' ? 'copies' : word + 's')}`; }

function updateSummary() {
  const t = orderTotals();
  const activeEnabled = sheets.filter(s => s.checked).length;

  document.getElementById('selectedSummary').textContent = `${activeEnabled} Selected (${sheets.length} Total)`;
  document.getElementById('sheetsEnabledFooter').textContent = `${plural(activeEnabled, 'sheet')} enabled in this document`;
  document.getElementById('sheetsQueuedBadge').textContent = t.count;

  let breakdown = `All files, ${plural(t.count, 'sheet')} including copies: ${t.bw} B&W × ₹${BW_PRICE} + ${t.colour} colour × ₹${COLOUR_PRICE}`;
  if (t.a3 > 0) breakdown += ` + A3 ₹${A3_EXTRA} × ${t.a3}`;
  document.getElementById('breakdownText').textContent = breakdown;
  document.getElementById('copiesMultiplierText').textContent = '';
  document.getElementById('totalValue').textContent = t.total;
  showActiveSettings();
}

function updateAll() { renderSheets(); updateSummary(); }

const bwCard = document.getElementById('bwCard');
const colourCard = document.getElementById('colourCard');
// change one setting on the SELECTED document only
function changeSetting(key, value, rebuild) {
  const src = activeSource();
  if (!src) return;
  src.settings[key] = value;
  if (rebuild) src.sheets = sheetsForSource(src);
  if (key === 'mode') src.sheets.forEach(s => s.mode = value);
  sheets = src.sheets;
  updateAll();
}
bwCard.addEventListener('click', () => changeSetting('mode', 'bw'));
colourCard.addEventListener('click', () => changeSetting('mode', 'colour'));
document.getElementById('singleSideCard').addEventListener('click', () => changeSetting('sides', 'single', true));
document.getElementById('doubleSideCard').addEventListener('click', () => changeSetting('sides', 'double', true));
document.getElementById('a4Card').addEventListener('click', () => changeSetting('paper', 'a4'));
document.getElementById('a3Card').addEventListener('click', () => changeSetting('paper', 'a3'));
document.getElementById('photoLayoutOptions').addEventListener('click', e => {
  const opt = e.target.closest('.photo-opt');
  if (opt) changeSetting('layout', Number(opt.dataset.layout), true);
});

function changeCopies(src, step) {
  if (!src) return;
  src.settings.copies = Math.max(1, src.settings.copies + step);
  updateSummary();
}
document.getElementById('copiesMinus').addEventListener('click', () => changeCopies(activeSource(), -1));
document.getElementById('copiesPlus').addEventListener('click', () => changeCopies(activeSource(), 1));

document.getElementById('selectAllBtn').addEventListener('click', () => {
  const allChecked = sheets.every(s => s.checked);
  sheets.forEach(s => s.checked = !allChecked);
  updateAll();
});
document.getElementById('allBwBtn').addEventListener('click', () => { sheets.forEach(s => s.mode = 'bw'); updateAll(); });
document.getElementById('allColourBtn').addEventListener('click', () => { sheets.forEach(s => s.mode = 'colour'); updateAll(); });
document.getElementById('applyRangeBtn').addEventListener('click', () => {
  const val = document.getElementById('rangeInput').value.trim();
  const match = val.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) { alert('Enter a range like 3-5'); return; }
  const start = parseInt(match[1], 10), end = parseInt(match[2], 10);
  const mode = bwCard.classList.contains('selected') ? 'bw' : 'colour';
  sheets.forEach((s, idx) => { const n = idx + 1; if (n >= start && n <= end) s.mode = mode; });
  updateAll();
});

document.getElementById('continuePaymentBtn').addEventListener('click', () => {
  if (orderTotals().count === 0) { alert('Select at least one sheet to continue.'); return; }
  renderPay();
  showView('pay');
});

/* ---------- CONFIRM AND PAY VIEW LOGIC ---------- */
const nameInput = document.getElementById('customerName');
const payNowBtn = document.getElementById('payNowBtn');
const payModal = document.getElementById('payModal');
let orderPaid = false;
let successOpen = false;

// the browser may block storage, so never let it break the page
function remember(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function recall(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }

function addLine(box, className, left, right, leftClass, rightClass) {
  const row = document.createElement('div');
  row.className = className;
  const a = document.createElement('span');
  const b = document.createElement('span');
  a.textContent = left;   // textContent keeps file names as plain text
  b.textContent = right;
  if (leftClass) a.className = leftClass;
  if (rightClass) b.className = rightClass;
  row.append(a, b);
  box.appendChild(row);
}

// remembers which files are opened on the pay screen
const openFiles = new Set();

function settingBox(label, value) {
  const box = document.createElement('div');
  box.className = 'meta-box';
  const a = document.createElement('span');
  const b = document.createElement('strong');
  a.textContent = label;
  b.textContent = value;
  box.append(a, b);
  return box;
}

function copiesBox(src) {
  const box = settingBox('COPIES', '');
  const stepper = document.createElement('div');
  stepper.className = 'mini-stepper';
  const button = (text, step, label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.setAttribute('aria-label', `${label} copies of ${src.name}`);
    btn.disabled = orderPaid;
    btn.addEventListener('click', () => { changeCopies(src, step); renderPay(); });
    return btn;
  };
  const value = box.querySelector('strong');
  value.textContent = plural(src.settings.copies, 'copy');
  stepper.append(button('−', -1, 'Fewer'), value, button('+', 1, 'More'));
  box.appendChild(stepper);
  return box;
}

function renderPay() {
  const t = orderTotals();
  const files = document.getElementById('orderFiles');
  files.innerHTML = '';
  docSources.forEach(src => {
    const on = src.sheets.filter(s => s.checked);
    if (on.length === 0) return;
    const modes = new Set(on.map(s => s.mode));
    const mode = modes.size > 1 ? 'Mixed' : (modes.has('bw') ? 'B&W' : 'Colour');
    const size = src.type === 'pdf' ? plural(src.pages, 'page') : plural(src.count, 'image');

    // <details> is a built-in HTML box that opens and closes when clicked
    const item = document.createElement('details');
    item.className = 'order-item';
    item.open = openFiles.has(src);
    item.addEventListener('toggle', () => { item.open ? openFiles.add(src) : openFiles.delete(src); });
    const head = document.createElement('summary');
    addLine(head, 'order-line', src.name, `${size} • ${plural(on.length, 'sheet')} • ${mode}`, 'oname', 'oinfo');

    const meta = document.createElement('div');
    meta.className = 'order-meta';
    meta.append(
      settingBox('PAPER', src.settings.paper.toUpperCase()),
      src.type === 'pdf'
        ? settingBox('SIDES', src.settings.sides === 'double' ? 'Double-sided' : 'Single-sided')
        : settingBox('LAYOUT', `${plural(src.settings.layout, 'photo')} per sheet`),
      copiesBox(src)
    );
    const subtotal = document.createElement('div');
    subtotal.className = 'order-subtotal';
    subtotal.textContent = `This file: ₹${sourceTotals(src).total}`;
    item.append(head, meta, subtotal);
    files.appendChild(item);
  });

  const rows = document.getElementById('priceRows');
  rows.innerHTML = '';
  const addPrice = (label, count, price) => {
    if (count > 0) addLine(rows, 'price-row', `${label} (${plural(count, 'sheet')} × ₹${price})`, `₹${count * price}`);
  };
  addPrice('Black & White', t.bw, BW_PRICE);
  addPrice('Colour', t.colour, COLOUR_PRICE);
  addPrice('A3 paper extra', t.a3, A3_EXTRA);

  document.getElementById('payTotal').textContent = `₹${t.total}`;
  payNowBtn.textContent = orderPaid ? '✓ Paid' : `🔒 Pay ₹${t.total}`;
  updatePayButton();
}

function updatePayButton() {
  payNowBtn.disabled = orderPaid || !nameInput.value.trim() || orderTotals().count === 0;
}

/* ---------- pop-up window ---------- */
function openModal({ icon, title, text, token, buttons }) {
  document.getElementById('modalIcon').textContent = icon;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  const tokenBox = document.getElementById('modalToken');
  tokenBox.hidden = !token;
  tokenBox.textContent = token || '';
  const actions = document.getElementById('modalActions');
  actions.innerHTML = '';
  buttons.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b.label;
    if (i === 0) btn.className = 'primary';
    btn.addEventListener('click', b.action);
    actions.appendChild(btn);
  });
  if (!payModal.open) payModal.showModal();
}

function askPaymentResult() {
  openModal({
    icon: '💳', title: 'Demo payment',
    text: `Amount: ₹${orderTotals().total}. No real money will be charged. Choose a result to test.`,
    buttons: [
      { label: 'Simulate success', action: paymentSuccess },
      { label: 'Simulate failure', action: paymentFailure },
    ],
  });
}

function paymentSuccess() {
  // temporary token made in the browser; later the backend must generate it
  const token = 'KS-' + Math.floor(1000 + Math.random() * 9000);
  orderPaid = true;
  successOpen = true;
  remember('printeaseToken', token);
  showToken(token);

  // lock the paid order
  nameInput.disabled = true;
  document.getElementById('payBack').hidden = true;
  document.getElementById('anotherBtn').hidden = false;
  renderPay();

  openModal({
    icon: '✅', title: 'Payment successful', token,
    text: `Thank you, ${nameInput.value.trim()}. Show this token at the counter.`,
    buttons: [{ label: 'Done', action: () => { successOpen = false; payModal.close(); } }],
  });
}

function paymentFailure() {
  openModal({
    icon: '❌', title: 'Payment failed',
    text: 'Your order has not been placed. Your details are still here.',
    buttons: [
      { label: 'Try again', action: askPaymentResult },
      { label: 'Cancel', action: () => payModal.close() },
    ],
  });
}

// the success pop-up closes only with the Done button, even if Esc is pressed
payModal.addEventListener('cancel', e => { if (successOpen) e.preventDefault(); });
payModal.addEventListener('close', () => { if (successOpen) payModal.showModal(); });

function showToken(token) {
  document.getElementById('latestToken').textContent = token;
  document.getElementById('tokenBanner').hidden = !token;
}

document.getElementById('payForm').addEventListener('submit', e => {
  e.preventDefault();
  if (payNowBtn.disabled) return;
  remember('printeaseName', nameInput.value.trim());
  askPaymentResult();
});
nameInput.addEventListener('input', updatePayButton);
document.getElementById('anotherBtn').addEventListener('click', () => {
  history.replaceState(null, '', '#upload');
  location.reload();   // starts a fresh order; name and token stay saved
});

nameInput.value = recall('printeaseName');
showToken(recall('printeaseToken'));

updateAll();
