/* My Membership Card Wallet App
   Private PWA MVP.
   Storage: IndexedDB on the current browser/device.
   Barcode generation: bwip-js.
   Barcode scanning: ZXing JS library when supported by browser/camera.
*/

const DB_NAME = 'membership-card-wallet-db';
const DB_VERSION = 1;
const STORE = 'cards';

let db;
let cards = [];
let editingId = null;
let activeCard = null;
let scanModeTarget = null;
let selectedPhotoDataUrl = '';

const views = {
  home: document.getElementById('homeView'),
  form: document.getElementById('formView'),
  detail: document.getElementById('detailView'),
  scanner: document.getElementById('scannerView'),
  fullscreen: document.getElementById('fullscreenView'),
};

const el = {
  cardsList: document.getElementById('cardsList'),
  addNewCardBtn: document.getElementById('addNewCardBtn'),
  backBtn: document.getElementById('backBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  form: document.getElementById('cardForm'),
  formTitle: document.getElementById('formTitle'),
  cardId: document.getElementById('cardId'),
  cardName: document.getElementById('cardName'),
  memberNumber: document.getElementById('memberNumber'),
  barcodeType: document.getElementById('barcodeType'),
  cardPhoto: document.getElementById('cardPhoto'),
  photoPreviewWrap: document.getElementById('photoPreviewWrap'),
  photoPreview: document.getElementById('photoPreview'),
  removePhotoBtn: document.getElementById('removePhotoBtn'),
  cardNotes: document.getElementById('cardNotes'),
  scanCameraBtn: document.getElementById('scanCameraBtn'),
  scanPhotoBtn: document.getElementById('scanPhotoBtn'),
  detailBackBtn: document.getElementById('detailBackBtn'),
  detailName: document.getElementById('detailName'),
  detailNumber: document.getElementById('detailNumber'),
  barcodeCanvas: document.getElementById('barcodeCanvas'),
  barcodeTypeLabel: document.getElementById('barcodeTypeLabel'),
  detailPhotoWrap: document.getElementById('detailPhotoWrap'),
  detailPhoto: document.getElementById('detailPhoto'),
  detailNotesWrap: document.getElementById('detailNotesWrap'),
  detailNotes: document.getElementById('detailNotes'),
  fullscreenBarcodeBtn: document.getElementById('fullscreenBarcodeBtn'),
  fullscreenName: document.getElementById('fullscreenName'),
  fullscreenNumber: document.getElementById('fullscreenNumber'),
  fullscreenCanvas: document.getElementById('fullscreenCanvas'),
  exitFullscreenBtn: document.getElementById('exitFullscreenBtn'),
  editBtn: document.getElementById('editBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  scannerBackBtn: document.getElementById('scannerBackBtn'),
  scannerVideo: document.getElementById('scannerVideo'),
  scannerStatus: document.getElementById('scannerStatus'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  installHelpBtn: document.getElementById('installHelpBtn'),
  installDialog: document.getElementById('installDialog'),
  closeInstallDialog: document.getElementById('closeInstallDialog'),
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txStore(mode = 'readonly') {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function getAllCards() {
  return new Promise((resolve, reject) => {
    const req = txStore().getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function putCard(card) {
  return new Promise((resolve, reject) => {
    const req = txStore('readwrite').put(card);
    req.onsuccess = () => resolve(card);
    req.onerror = () => reject(req.error);
  });
}

function deleteCard(id) {
  return new Promise((resolve, reject) => {
    const req = txStore('readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function refreshCards() {
  cards = await getAllCards();
  cards.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  renderCardsList();
}

function renderCardsList() {
  el.cardsList.innerHTML = '';

  if (!cards.length) {
    const div = document.createElement('div');
    div.className = 'empty-state hero-card';
    div.innerHTML = `<h3>No cards saved yet</h3><p>Tap “Add New Card” to create your first membership card.</p>`;
    el.cardsList.appendChild(div);
    return;
  }

  cards.forEach(card => {
    const btn = document.createElement('button');
    btn.className = 'card-tile';
    btn.type = 'button';
    btn.innerHTML = `
      <h3>${escapeHtml(card.name)}</h3>
      <p>${escapeHtml(maskNumber(card.number))}</p>
      <p class="muted">${displayBarcodeType(card.barcodeType)}</p>
    `;
    btn.addEventListener('click', () => openDetail(card.id));
    el.cardsList.appendChild(btn);
  });
}

function resetForm() {
  editingId = null;
  selectedPhotoDataUrl = '';
  el.form.reset();
  el.cardId.value = '';
  el.formTitle.textContent = 'Add New Card';
  el.photoPreviewWrap.classList.add('hidden');
  el.photoPreview.src = '';
}

function openAddForm() {
  resetForm();
  showView('form');
}

function openEditForm(card) {
  editingId = card.id;
  selectedPhotoDataUrl = card.photo || '';
  el.formTitle.textContent = 'Edit Card';
  el.cardId.value = card.id;
  el.cardName.value = card.name || '';
  el.memberNumber.value = card.number || '';
  el.barcodeType.value = card.barcodeType || 'auto';
  el.cardNotes.value = card.notes || '';

  if (selectedPhotoDataUrl) {
    el.photoPreview.src = selectedPhotoDataUrl;
    el.photoPreviewWrap.classList.remove('hidden');
  } else {
    el.photoPreviewWrap.classList.add('hidden');
  }
  showView('form');
}

function bestGuessBarcodeType(number) {
  const clean = String(number || '').replace(/\s+/g, '');
  if (/^\d{12}$/.test(clean)) return 'upca';
  if (/^\d{13}$/.test(clean)) return 'ean13';
  return 'code128';
}

function normalizeBarcodeType(type, number) {
  if (!type || type === 'auto') return bestGuessBarcodeType(number);
  return type;
}

function bcidForType(type) {
  const map = {
    code128: 'code128',
    ean13: 'ean13',
    upca: 'upca',
    qrcode: 'qrcode',
    pdf417: 'pdf417',
  };
  return map[type] || 'code128';
}

function displayBarcodeType(type) {
  const map = {
    auto: 'Auto / Best Guess',
    code128: 'Code 128',
    ean13: 'EAN-13',
    upca: 'UPC-A',
    qrcode: 'QR Code',
    pdf417: 'PDF417',
  };
  return map[type] || type || 'Code 128';
}

function drawBarcode(canvas, number, type) {
  const resolvedType = normalizeBarcodeType(type, number);
  const bcid = bcidForType(resolvedType);

  try {
    bwipjs.toCanvas(canvas, {
      bcid,
      text: String(number || ''),
      scale: 3,
      height: resolvedType === 'qrcode' ? 32 : 18,
      includetext: resolvedType !== 'qrcode' && resolvedType !== 'pdf417',
      textxalign: 'center',
      paddingwidth: 8,
      paddingheight: 8,
      backgroundcolor: 'FFFFFF',
    });
    return { ok: true, resolvedType };
  } catch (err) {
    console.warn('Barcode generation failed, falling back to Code 128.', err);
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: String(number || ''),
        scale: 3,
        height: 18,
        includetext: true,
        textxalign: 'center',
        paddingwidth: 8,
        paddingheight: 8,
        backgroundcolor: 'FFFFFF',
      });
      return { ok: true, resolvedType: 'code128', fallback: true };
    } catch (fallbackErr) {
      console.error(fallbackErr);
      return { ok: false, resolvedType };
    }
  }
}

function openDetail(id) {
  const card = cards.find(c => c.id === id);
  if (!card) return;
  activeCard = card;

  el.detailName.textContent = card.name;
  el.detailNumber.textContent = card.number;
  const result = drawBarcode(el.barcodeCanvas, card.number, card.barcodeType);
  el.barcodeTypeLabel.textContent = result.fallback
    ? `Could not generate ${displayBarcodeType(card.barcodeType)}. Showing Code 128 fallback.`
    : displayBarcodeType(result.resolvedType);

  if (card.photo) {
    el.detailPhoto.src = card.photo;
    el.detailPhotoWrap.classList.remove('hidden');
  } else {
    el.detailPhotoWrap.classList.add('hidden');
  }

  if (card.notes) {
    el.detailNotes.textContent = card.notes;
    el.detailNotesWrap.classList.remove('hidden');
  } else {
    el.detailNotesWrap.classList.add('hidden');
  }

  showView('detail');
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const name = el.cardName.value.trim();
  const number = el.memberNumber.value.trim();
  const barcodeType = el.barcodeType.value;

  if (!name) {
    alert('Please enter a card/store name.');
    return;
  }

  if (!number) {
    alert('Please enter or scan a membership number.');
    return;
  }

  const now = new Date().toISOString();
  const card = {
    id: editingId || crypto.randomUUID(),
    name,
    number,
    barcodeType,
    photo: selectedPhotoDataUrl || '',
    notes: el.cardNotes.value.trim(),
    createdAt: editingId ? (cards.find(c => c.id === editingId)?.createdAt || now) : now,
    updatedAt: now,
  };

  await putCard(card);
  await refreshCards();
  openDetail(card.id);
}

function readImageFile(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  selectedPhotoDataUrl = await readImageFile(file);
  el.photoPreview.src = selectedPhotoDataUrl;
  el.photoPreviewWrap.classList.remove('hidden');
}

function zxingFormatToAppType(formatText) {
  const f = String(formatText || '').toUpperCase();
  if (f.includes('EAN_13')) return 'ean13';
  if (f.includes('UPC_A')) return 'upca';
  if (f.includes('QR_CODE')) return 'qrcode';
  if (f.includes('PDF_417')) return 'pdf417';
  if (f.includes('CODE_128')) return 'code128';
  return 'auto';
}

async function scanWithCamera() {
  if (!window.ZXing) {
    alert('Barcode scanner library did not load. Try again with internet access or enter the number manually.');
    return;
  }

  showView('scanner');
  el.scannerStatus.textContent = 'Point your camera at the barcode. Good lighting helps.';

  const codeReader = new ZXing.BrowserMultiFormatReader();

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const backCamera = videoDevices.find(d => /back|rear|environment/i.test(d.label));
    const deviceId = backCamera?.deviceId || videoDevices[0]?.deviceId;

    let stopped = false;
    const stop = () => {
      stopped = true;
      try { codeReader.reset(); } catch (_) {}
      const stream = el.scannerVideo.srcObject;
      if (stream) stream.getTracks().forEach(t => t.stop());
    };

    el.scannerBackBtn.onclick = () => {
      stop();
      showView('form');
    };

    await codeReader.decodeFromVideoDevice(deviceId, el.scannerVideo, (result, err) => {
      if (stopped || !result) return;

      const text = result.getText();
      const format = result.getBarcodeFormat?.();
      const appType = zxingFormatToAppType(format);

      el.memberNumber.value = text;
      if (appType !== 'auto') el.barcodeType.value = appType;

      stop();
      showView('form');
      alert(`Scanned: ${text}\nDetected type: ${displayBarcodeType(appType)}`);
    });
  } catch (err) {
    console.error(err);
    alert('Camera scanning did not work on this device/browser. You can still take a photo and enter the membership number manually.');
    showView('form');
  }
}

async function scanFromPhoto() {
  if (!window.ZXing) {
    alert('Barcode scanner library did not load. Try again with internet access or enter the number manually.');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  // Do not set input.capture here.
  // On iPhone, capture='environment' forces the camera.
  // Without capture, iOS lets you choose Photo Library, Take Photo, or Files.

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const imgUrl = URL.createObjectURL(file);
      const codeReader = new ZXing.BrowserMultiFormatReader();
      const result = await codeReader.decodeFromImageUrl(imgUrl);
      URL.revokeObjectURL(imgUrl);

      const text = result.getText();
      const format = result.getBarcodeFormat?.();
      const appType = zxingFormatToAppType(format);

      el.memberNumber.value = text;
      if (appType !== 'auto') el.barcodeType.value = appType;
      alert(`Scanned: ${text}\nDetected type: ${displayBarcodeType(appType)}`);
    } catch (err) {
      console.error(err);
      alert('Could not read the barcode from that photo. Try a brighter, closer photo, or enter the number manually.');
    }
  };

  input.click();
}

function showFullscreenBarcode() {
  if (!activeCard) return;
  el.fullscreenName.textContent = activeCard.name;
  el.fullscreenNumber.textContent = activeCard.number;
  drawBarcode(el.fullscreenCanvas, activeCard.number, activeCard.barcodeType);
  showView('fullscreen');

  // Improve scanner readability while fullscreen is open.
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}

function exportBackup() {
  const payload = {
    app: 'My Membership Card Wallet App',
    exportedAt: new Date().toISOString(),
    cards,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `membership-card-wallet-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload.cards || !Array.isArray(payload.cards)) {
    throw new Error('Invalid backup format.');
  }
  for (const card of payload.cards) {
    if (card.id && card.name && card.number) {
      await putCard({ ...card, updatedAt: new Date().toISOString() });
    }
  }
  await refreshCards();
}

function maskNumber(number) {
  const s = String(number || '');
  if (s.length <= 4) return s;
  return '•••• ' + s.slice(-4);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[m]));
}

function setupEvents() {
  el.addNewCardBtn.addEventListener('click', openAddForm);
  el.backBtn.addEventListener('click', () => showView('home'));
  el.cancelBtn.addEventListener('click', () => showView('home'));
  el.detailBackBtn.addEventListener('click', () => showView('home'));
  el.form.addEventListener('submit', handleFormSubmit);
  el.cardPhoto.addEventListener('change', handlePhotoChange);
  el.removePhotoBtn.addEventListener('click', () => {
    selectedPhotoDataUrl = '';
    el.cardPhoto.value = '';
    el.photoPreview.src = '';
    el.photoPreviewWrap.classList.add('hidden');
  });

  el.scanCameraBtn.addEventListener('click', scanWithCamera);
  el.scanPhotoBtn.addEventListener('click', scanFromPhoto);

  el.fullscreenBarcodeBtn.addEventListener('click', showFullscreenBarcode);
  el.exitFullscreenBtn.addEventListener('click', () => showView('detail'));

  el.editBtn.addEventListener('click', () => activeCard && openEditForm(activeCard));
  el.deleteBtn.addEventListener('click', async () => {
    if (!activeCard) return;
    if (confirm(`Delete ${activeCard.name}?`)) {
      await deleteCard(activeCard.id);
      activeCard = null;
      await refreshCards();
      showView('home');
    }
  });

  el.exportBtn.addEventListener('click', exportBackup);
  el.importFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importBackup(file);
      alert('Backup imported.');
    } catch (err) {
      alert('Could not import backup: ' + err.message);
    }
    el.importFile.value = '';
  });

  el.installHelpBtn.addEventListener('click', () => el.installDialog.showModal());
  el.closeInstallDialog.addEventListener('click', () => el.installDialog.close());
}

async function init() {
  db = await openDb();
  setupEvents();
  await refreshCards();
  showView('home');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.warn);
  }
}

init().catch(err => {
  console.error(err);
  alert('App failed to start: ' + err.message);
});
