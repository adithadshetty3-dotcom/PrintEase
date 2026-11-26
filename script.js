/* ---------- view router (keeps all state in memory, no page reloads) ---------- */
const views = ['welcome', 'upload', 'config'];
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
showView((location.hash || '#welcome').slice(1));

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
let copies = 1;
let paperSurcharge = 0;
let sides = 'double';
let photoLayout = 6;

async function buildDocSources() {
  const pageCounts = await Promise.all(pdfFiles.map(getPdfPageCount));
  docSources = pdfFiles.map((file, i) => ({ type: 'pdf', name: file.name, pages: pageCounts[i] }));
  if (photoFiles.length > 0) {
    docSources.push({ type: 'photo', name: `Photo Set (${photoFiles.length} image${photoFiles.length === 1 ? '' : 's'})`, count: photoFiles.length });
  }
  activeSourceIndex = 0;
}

function sheetsForSource(source) {
  if (!source) return [];
  if (source.type === 'pdf') {
    const perSheet = sides === 'double' ? 2 : 1;
    const count = Math.ceil(source.pages / perSheet);
    const defaultMode = colourCard.classList.contains('selected') ? 'colour' : 'bw';
    return Array.from({ length: count }, (_, i) => {
      const start = i * perSheet + 1;
      const end = Math.min(start + perSheet - 1, source.pages);
      return {
        name: `Sheet ${i + 1}`,
        doc: source.name,
        pages: start === end ? `p. ${start}` : `p. ${start}-${end}`,
        mode: defaultMode,
        checked: true,
      };
    });
  }
  // photo source
  const count = Math.ceil(source.count / photoLayout);
  return Array.from({ length: count }, (_, i) => {
    const start = i * photoLayout + 1;
    const end = Math.min(start + photoLayout - 1, source.count);
    return {
      name: `Sheet ${i + 1}`,
      doc: source.name,
      pages: start === end ? `Photo ${start}` : `Photos ${start}-${end}`,
      mode: 'colour',
      checked: true,
    };
  });
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
      : `<div class="fname">${src.name}</div><div class="fsub">Printed via Photo Layout setting</div>`;
    tab.addEventListener('click', () => { activeSourceIndex = idx; renderDocTabs(); });
    docTabs.appendChild(tab);
  });
  const active = docSources[activeSourceIndex];
  document.getElementById('activeDocBadge').textContent = active.name;
  document.getElementById('totalPagesHint').textContent = active.type === 'pdf'
    ? `${active.pages} Page${active.pages === 1 ? '' : 's'} Total`
    : `${active.count} Image${active.count === 1 ? '' : 's'} Total`;
  sheets = sheetsForSource(active);
  updateAll();
}

const sheetList = document.getElementById('sheetList');

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
    bwBtn.addEventListener('click', () => { sheets[idx].mode = 'bw'; renderSheets(); updateSummary(); });
    colourBtn.addEventListener('click', () => { sheets[idx].mode = 'colour'; renderSheets(); updateSummary(); });
    sheetList.appendChild(row);
  });
}

function updateSummary() {
  const enabled = sheets.filter(s => s.checked);
  const bwCount = enabled.filter(s => s.mode === 'bw').length;
  const colourCount = enabled.filter(s => s.mode === 'colour').length;
  const sheetCost = bwCount * BW_PRICE + colourCount * COLOUR_PRICE;
  const surchargeCost = paperSurcharge * enabled.length;
  const total = (sheetCost + surchargeCost) * copies;

  document.getElementById('selectedSummary').textContent = `${enabled.length} Selected (${sheets.length} Total)`;
  document.getElementById('sheetsEnabledFooter').textContent = `${enabled.length} sheet${enabled.length === 1 ? '' : 's'} enabled`;
  document.getElementById('sheetsQueuedBadge').textContent = enabled.length;

  let breakdown = `${enabled.length} sheet${enabled.length === 1 ? '' : 's'}: ${bwCount} B&W × ₹${BW_PRICE} + ${colourCount} colour × ₹${COLOUR_PRICE}`;
  if (surchargeCost > 0) breakdown += ` + paper +₹${paperSurcharge}×${enabled.length}`;
  document.getElementById('breakdownText').textContent = breakdown;
  document.getElementById('copiesMultiplierText').textContent = `× ${copies} set${copies === 1 ? '' : 's'}`;
  document.getElementById('totalValue').textContent = total;
}

function updateAll() { renderSheets(); updateSummary(); }

const bwCard = document.getElementById('bwCard');
const colourCard = document.getElementById('colourCard');
bwCard.addEventListener('click', () => { bwCard.classList.add('selected', 'violet'); colourCard.classList.remove('selected', 'violet'); });
colourCard.addEventListener('click', () => { colourCard.classList.add('selected', 'violet'); bwCard.classList.remove('selected', 'violet'); });

const singleSideCard = document.getElementById('singleSideCard');
const doubleSideCard = document.getElementById('doubleSideCard');
function refreshActiveSheets() {
  if (docSources.length === 0) return;
  sheets = sheetsForSource(docSources[activeSourceIndex]);
  updateAll();
}
singleSideCard.addEventListener('click', () => {
  singleSideCard.classList.add('selected', 'violet'); doubleSideCard.classList.remove('selected', 'violet');
  sides = 'single'; refreshActiveSheets();
});
doubleSideCard.addEventListener('click', () => {
  doubleSideCard.classList.add('selected', 'violet'); singleSideCard.classList.remove('selected', 'violet');
  sides = 'double'; refreshActiveSheets();
});

document.getElementById('copiesMinus').addEventListener('click', () => {
  copies = Math.max(1, copies - 1);
  document.getElementById('copiesValue').textContent = `${copies} set${copies === 1 ? '' : 's'}`;
  updateSummary();
});
document.getElementById('copiesPlus').addEventListener('click', () => {
  copies += 1;
  document.getElementById('copiesValue').textContent = `${copies} set${copies === 1 ? '' : 's'}`;
  updateSummary();
});

const a4Card = document.getElementById('a4Card');
const a3Card = document.getElementById('a3Card');
a4Card.addEventListener('click', () => { a4Card.classList.add('selected', 'teal'); a3Card.classList.remove('selected', 'teal'); paperSurcharge = 0; updateSummary(); });
a3Card.addEventListener('click', () => { a3Card.classList.add('selected', 'teal'); a4Card.classList.remove('selected', 'teal'); paperSurcharge = parseFloat(a3Card.dataset.surcharge); updateSummary(); });

document.getElementById('photoLayoutOptions').addEventListener('click', e => {
  const opt = e.target.closest('.photo-opt');
  if (!opt) return;
  document.querySelectorAll('.photo-opt').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
  photoLayout = parseInt(opt.dataset.layout, 10);
  if (docSources[activeSourceIndex] && docSources[activeSourceIndex].type === 'photo') refreshActiveSheets();
});

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
  const enabled = sheets.filter(s => s.checked).length;
  if (enabled === 0) { alert('Select at least one sheet to continue.'); return; }
  alert('Proceeding to payment (checkout page coming soon).');
});

updateAll();
