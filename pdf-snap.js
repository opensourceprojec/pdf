// ── PDF.js setup ─────────────────────────────────────────────────────────
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} else {
  console.error('PDF.js failed to load.');
}

// ── State ─────────────────────────────────────────────────────────────────
let pdfDoc         = null;
let currentPageNum = 1;
let totalPages     = 0;
let pdfFileName    = '';
let currentRender  = null;
let isBusy         = false;

// ── DOM refs ──────────────────────────────────────────────────────────────
const dropZone         = document.getElementById('dropZone');
const fileInput        = document.getElementById('fileInput');
const uploadSection    = document.getElementById('uploadSection');
const converterSection = document.getElementById('converterSection');

const fileNameEl    = document.getElementById('fileName');
const fileSizeEl    = document.getElementById('fileSize');
const pageCountText = document.getElementById('pageCountText');
const removeFileBtn = document.getElementById('removeFileBtn');

const pageInput        = document.getElementById('pageInput');
const maxPagesText     = document.getElementById('maxPagesText');
const btnPageNum       = document.getElementById('btnPageNum');
const prevPageBtn      = document.getElementById('prevPageBtn');
const nextPageBtn      = document.getElementById('nextPageBtn');
const pageSlider       = document.getElementById('pageSlider');
const resolutionSelect = document.getElementById('resolutionSelect');

const previewCanvas  = document.getElementById('previewCanvas');
const previewSpinner = document.getElementById('previewSpinner');
const previewEmpty   = document.getElementById('previewEmpty');
const previewWrapper = document.getElementById('previewWrapper');
const dimensionsText = document.getElementById('dimensionsText');
const downloadBtn    = document.getElementById('downloadBtn');
const toastContainer = document.getElementById('toastContainer');

// ── Init Lucide icons ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => lucide.createIcons());

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = { success: 'check-circle', danger: 'alert-triangle', info: 'info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
  toastContainer.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3500);
}

// ── Drag & Drop ───────────────────────────────────────────────────────────
dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// ── File Handling ─────────────────────────────────────────────────────────
function handleFile(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please select a valid PDF file.', 'danger');
    return;
  }

  pdfFileName = file.name;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = (file.size / 1048576).toFixed(2) + ' MB';

  // Switch to converter view, show spinner immediately
  uploadSection.classList.add('hidden');
  converterSection.classList.remove('hidden');
  setPreviewState('loading');

  const reader = new FileReader();
  reader.onload  = e => loadPdf(new Uint8Array(e.target.result));
  reader.onerror = () => { showToast('Could not read the file.', 'danger'); reset(); };
  reader.readAsArrayBuffer(file);
}

// ── Preview State Manager ─────────────────────────────────────────────────
// state: 'loading' | 'ready' | 'empty'
function setPreviewState(state) {
  previewSpinner.classList.toggle('hidden', state !== 'loading');
  previewEmpty.classList.toggle('hidden',   state !== 'empty');
  previewWrapper.classList.toggle('hidden', state !== 'ready');
}

// ── Load PDF ──────────────────────────────────────────────────────────────
function loadPdf(data) {
  pdfjsLib.getDocument({ data }).promise
    .then(pdf => {
      pdfDoc      = pdf;
      totalPages  = pdf.numPages;

      pageCountText.textContent = `${totalPages} page${totalPages > 1 ? 's' : ''}`;
      maxPagesText.textContent  = totalPages;
      pageInput.max             = totalPages;
      pageSlider.max            = totalPages;

      setPage(1);
      showToast(`PDF loaded — ${totalPages} pages found!`, 'success');
    })
    .catch(err => {
      console.error('PDF load error:', err);
      showToast('Failed to open PDF. It may be password-protected.', 'danger');
      reset();
    });
}

// ── Page Navigation ───────────────────────────────────────────────────────
function setPage(n) {
  currentPageNum = Math.max(1, Math.min(totalPages, n));
  pageInput.value        = currentPageNum;
  pageSlider.value       = currentPageNum;
  btnPageNum.textContent = currentPageNum;
  prevPageBtn.disabled   = currentPageNum <= 1;
  nextPageBtn.disabled   = currentPageNum >= totalPages;
  renderPreview();
}

prevPageBtn.addEventListener('click', () => setPage(currentPageNum - 1));
nextPageBtn.addEventListener('click', () => setPage(currentPageNum + 1));
pageInput.addEventListener('change', e => setPage(parseInt(e.target.value) || 1));
pageInput.addEventListener('keydown', e => { if (e.key === 'Enter') setPage(parseInt(pageInput.value) || 1); });
pageSlider.addEventListener('input',  e => setPage(parseInt(e.target.value)));

// ── Render Preview ────────────────────────────────────────────────────────
function renderPreview() {
  if (!pdfDoc) return;

  setPreviewState('loading');

  // Cancel any running render
  if (currentRender) {
    try { currentRender.cancel(); } catch (_) {}
    currentRender = null;
  }

  pdfDoc.getPage(currentPageNum)
    .then(page => {
      const vp  = page.getViewport({ scale: 1.5 });
      const ctx = previewCanvas.getContext('2d');

      // Set canvas internal resolution
      previewCanvas.width  = vp.width;
      previewCanvas.height = vp.height;

      dimensionsText.textContent = `${Math.round(vp.width)} × ${Math.round(vp.height)} px`;

      currentRender = page.render({ canvasContext: ctx, viewport: vp });

      currentRender.promise
        .then(() => {
          // ✅ Show the canvas wrapper — this was the bug
          setPreviewState('ready');
          currentRender = null;
        })
        .catch(err => {
          if (err?.name === 'RenderingCancelledException') {
            // Normal — a newer render started, ignore
          } else {
            console.error('Render error:', err);
            showToast('Preview failed to render.', 'danger');
            setPreviewState('empty');
          }
        });
    })
    .catch(err => {
      console.error('getPage error:', err);
      showToast('Could not load this page.', 'danger');
      setPreviewState('empty');
    });
}

// ── Download PNG ──────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', downloadPage);

function downloadPage() {
  if (!pdfDoc || isBusy) return;
  isBusy = true;

  const origHTML = downloadBtn.innerHTML;
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `<div class="spinner"></div><span>Exporting…</span>`;

  const scale = parseFloat(resolutionSelect.value) || 2;
  const pageN = currentPageNum;

  pdfDoc.getPage(pageN)
    .then(page => {
      const vp     = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(vp.width);
      canvas.height = Math.round(vp.height);

      return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        .then(() => {
          canvas.toBlob(blob => {
            if (!blob) {
              showToast('Failed to create image — try a lower resolution.', 'danger');
              restoreBtn();
              return;
            }
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href     = url;
            link.download = `${pdfFileName.replace(/\.[^/.]+$/, '')}_page${pageN}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            showToast(`Page ${pageN} downloaded successfully!`, 'success');
            restoreBtn();
          }, 'image/png');
        });
    })
    .catch(err => {
      console.error('Export error:', err);
      showToast('Export failed: ' + (err.message || 'unknown error'), 'danger');
      restoreBtn();
    });

  function restoreBtn() {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = origHTML;
    lucide.createIcons();
    isBusy = false;
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────
removeFileBtn.addEventListener('click', () => { reset(); showToast('PDF closed.', 'info'); });

function reset() {
  pdfDoc = null; totalPages = 0; pdfFileName = '';
  if (currentRender) { try { currentRender.cancel(); } catch (_) {} currentRender = null; }
  fileInput.value = '';
  converterSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  setPreviewState('empty');
  dimensionsText.textContent = '— × — px';
  previewCanvas.getContext('2d').clearRect(0, 0, previewCanvas.width, previewCanvas.height);
}
