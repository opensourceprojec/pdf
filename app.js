/* ==========================================================================
   AeroWatermark - Main Application Logic
   ========================================================================== */

// Global State
const state = {
  // PDF Document details
  pdfBytes: null,
  pdfDocLib: null, // pdf-lib document object
  pdfDocJs: null,  // pdf.js document object
  fileName: '',
  fileSizeStr: '',
  totalPages: 0,
  currentPage: 1,
  
  // Watermark Settings
  type: 'text', // 'text' | 'image'
  
  // Text settings
  text: 'CONFIDENTIAL',
  font: 'Helvetica', // 'Helvetica' | 'TimesRoman' | 'Courier'
  fontSize: 48,
  color: '#ff0000',
  bold: true,
  italic: false,
  
  // Image settings
  imageSrc: '', // DataURL for preview
  imageBytes: null, // ArrayBuffer for pdf-lib
  imageType: '', // 'image/png' | 'image/jpeg'
  imageNaturalWidth: 0,
  imageNaturalHeight: 0,
  imageScale: 50, // percentage (10% - 200%)
  
  // Shared positioning
  layoutMode: 'single', // 'single' | 'tiled' | 'free'
  position: 'MC', // TL, TC, TR, ML, MC, MR, BL, BC, BR
  offsetX: 0,
  offsetY: 0,
  dragPercentX: 50, // percentage for free placement
  dragPercentY: 50, // percentage for free placement
  opacity: 40, // 0 - 100
  rotation: -45, // -180 - 180
  
  // Page range
  pageScope: 'all', // 'all' | 'first' | 'last' | 'custom'
  customPagesStr: '',
  
  // Scaling conversion from PDF points to preview display pixels
  scaleFactor: 1.0,
  pdfPageWidth: 612, // default fallback (Letter)
  pdfPageHeight: 792 // default fallback (Letter)
};

// DOM Elements Cache
const elements = {
  dropzone: document.getElementById('dropzone'),
  pdfUpload: document.getElementById('pdf-upload'),
  previewContainer: document.getElementById('preview-container'),
  previewWorkspace: document.getElementById('preview-workspace'),
  canvas: document.getElementById('pdf-preview-canvas'),
  overlayContainer: document.getElementById('watermark-overlay-container'),
  overlayElement: document.getElementById('watermark-overlay-element'),
  overlayTiled: document.getElementById('watermark-overlay-tiled'),
  textPreview: document.getElementById('watermark-text-preview'),
  imagePreviewOverlay: document.getElementById('watermark-image-preview-overlay'),
  loadingMask: document.getElementById('preview-loading-mask'),
  
  // Header Meta
  pdfFilename: document.getElementById('pdf-filename'),
  pdfSize: document.getElementById('pdf-size'),
  currentPageSpan: document.getElementById('current-page'),
  totalPagesSpan: document.getElementById('total-pages'),
  btnPrevPage: document.getElementById('btn-prev-page'),
  btnNextPage: document.getElementById('btn-next-page'),
  btnRemovePdf: document.getElementById('btn-remove-pdf'),
  
  // Text Watermark Options
  inputWmText: document.getElementById('wm-text'),
  selectWmFont: document.getElementById('wm-font'),
  inputWmFontSize: document.getElementById('wm-font-size'),
  inputWmColor: document.getElementById('wm-color'),
  colorHexLabel: document.getElementById('color-hex'),
  btnBold: document.getElementById('btn-bold'),
  btnItalic: document.getElementById('btn-italic'),
  
  // Image Watermark Options
  inputWmImageFile: document.getElementById('wm-image-file'),
  imagePreviewContainer: document.getElementById('wm-image-preview-container'),
  imagePreview: document.getElementById('wm-image-preview'),
  btnClearImage: document.getElementById('btn-clear-image'),
  inputWmImageScale: document.getElementById('wm-image-scale'),
  wmImageScaleVal: document.getElementById('wm-image-scale-val'),
  
  // Layout Options
  modeSingle: document.getElementById('mode-single'),
  modeTiled: document.getElementById('mode-tiled'),
  modeFree: document.getElementById('mode-free'),
  positionGridContainer: document.getElementById('position-grid-container'),
  offsetSettings: document.getElementById('offset-settings'),
  inputOffsetX: document.getElementById('wm-offset-x'),
  inputOffsetY: document.getElementById('wm-offset-y'),
  valOffsetX: document.getElementById('wm-offset-x-val'),
  valOffsetY: document.getElementById('wm-offset-y-val'),
  inputOpacity: document.getElementById('wm-opacity'),
  valOpacity: document.getElementById('wm-opacity-val'),
  inputRotation: document.getElementById('wm-rotation'),
  valRotation: document.getElementById('wm-rotation-val'),
  
  // Page Range Options
  selectPageScope: document.getElementById('wm-page-scope'),
  customPagesGroup: document.getElementById('custom-pages-group'),
  inputCustomPages: document.getElementById('wm-custom-pages'),
  pageRangeError: document.getElementById('page-range-error'),
  
  // Action CTA
  btnDownload: document.getElementById('btn-download'),
  progressContainer: document.getElementById('progress-container'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  progressStatus: document.getElementById('progress-status')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initLucide();
});

// Load icons
function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Event Listeners Binding
function setupEventListeners() {
  // Drag and drop handlers
  ['dragenter', 'dragover'].forEach(eventName => {
    elements.dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.dropzone.classList.add('drag-hover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    elements.dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.dropzone.classList.remove('drag-hover');
    }, false);
  });
  
  elements.dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file && file.type === 'application/pdf') {
      handlePdfFile(file);
    }
  });
  
  elements.pdfUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handlePdfFile(file);
  });
  
  elements.btnRemovePdf.addEventListener('click', resetApp);
  
  // Pagination
  elements.btnPrevPage.addEventListener('click', () => changePage(-1));
  elements.btnNextPage.addEventListener('click', () => changePage(1));
  
  // Text Watermark configuration bindings
  elements.inputWmText.addEventListener('input', (e) => {
    state.text = e.target.value;
    syncPreview();
  });
  
  elements.selectWmFont.addEventListener('change', (e) => {
    state.font = e.target.value;
    syncPreview();
  });
  
  elements.inputWmFontSize.addEventListener('input', (e) => {
    state.fontSize = parseInt(e.target.value) || 12;
    syncPreview();
  });
  
  elements.inputWmColor.addEventListener('input', (e) => {
    state.color = e.target.value;
    elements.colorHexLabel.textContent = e.target.value.toUpperCase();
    syncPreview();
  });
  
  elements.btnBold.addEventListener('click', () => {
    state.bold = !state.bold;
    elements.btnBold.classList.toggle('active', state.bold);
    syncPreview();
  });
  
  elements.btnItalic.addEventListener('click', () => {
    state.italic = !state.italic;
    elements.btnItalic.classList.toggle('active', state.italic);
    syncPreview();
  });
  
  // Image Watermark configuration bindings
  elements.inputWmImageFile.addEventListener('change', handleImageUpload);
  elements.btnClearImage.addEventListener('click', clearImageWatermark);
  elements.inputWmImageScale.addEventListener('input', (e) => {
    state.imageScale = parseInt(e.target.value);
    elements.wmImageScaleVal.textContent = `${state.imageScale}%`;
    syncPreview();
  });
  
  // Layout Options
  elements.modeSingle.addEventListener('click', () => switchLayoutMode('single'));
  elements.modeTiled.addEventListener('click', () => switchLayoutMode('tiled'));
  elements.modeFree.addEventListener('click', () => switchLayoutMode('free'));
  
  // Drag-and-drop / Free placement event handlers
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function onDragStart(e) {
    if (state.layoutMode !== 'free') return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    isDragging = true;
    startX = clientX;
    startY = clientY;
    
    const styleLeft = elements.overlayElement.style.left;
    const styleTop = elements.overlayElement.style.top;
    
    const displayWidth = parseFloat(elements.overlayContainer.style.width) || 400;
    const displayHeight = parseFloat(elements.overlayContainer.style.height) || 500;
    
    initialLeft = styleLeft ? parseFloat(styleLeft) : (displayWidth / 2);
    initialTop = styleTop ? parseFloat(styleTop) : (displayHeight / 2);
    
    if (!e.touches) {
      e.preventDefault();
    }
  }

  function onDragMove(e) {
    if (!isDragging) return;
    
    if (e.cancelable) {
      e.preventDefault();
    }
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;
    
    const displayWidth = parseFloat(elements.overlayContainer.style.width) || 400;
    const displayHeight = parseFloat(elements.overlayContainer.style.height) || 500;
    
    let newX = initialLeft + deltaX;
    let newY = initialTop + deltaY;
    
    // Constraint to container
    newX = Math.max(0, Math.min(displayWidth, newX));
    newY = Math.max(0, Math.min(displayHeight, newY));
    
    state.dragPercentX = (newX / displayWidth) * 100;
    state.dragPercentY = (newY / displayHeight) * 100;
    
    elements.overlayElement.style.left = `${newX}px`;
    elements.overlayElement.style.top = `${newY}px`;
  }

  function onDragEnd() {
    isDragging = false;
  }

  elements.overlayElement.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  elements.overlayElement.addEventListener('touchstart', onDragStart, { passive: true });
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
  
  // Position Grid Buttons
  document.querySelectorAll('.pos-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      document.querySelectorAll('.pos-cell').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      state.position = e.target.dataset.pos;
      syncPreview();
    });
  });
  
  // Sliders and Position Modifiers
  elements.inputOffsetX.addEventListener('input', (e) => {
    state.offsetX = parseInt(e.target.value);
    elements.valOffsetX.textContent = `${state.offsetX}px`;
    syncPreview();
  });
  
  elements.inputOffsetY.addEventListener('input', (e) => {
    state.offsetY = parseInt(e.target.value);
    elements.valOffsetY.textContent = `${state.offsetY}px`;
    syncPreview();
  });
  
  elements.inputOpacity.addEventListener('input', (e) => {
    state.opacity = parseInt(e.target.value);
    elements.valOpacity.textContent = `${state.opacity}%`;
    syncPreview();
  });
  
  elements.inputRotation.addEventListener('input', (e) => {
    state.rotation = parseInt(e.target.value);
    elements.valRotation.textContent = `${state.rotation}°`;
    syncPreview();
  });
  
  // Page Scope Selection
  elements.selectPageScope.addEventListener('change', (e) => {
    state.pageScope = e.target.value;
    if (state.pageScope === 'custom') {
      elements.customPagesGroup.classList.remove('hidden');
    } else {
      elements.customPagesGroup.classList.add('hidden');
    }
    validatePageRange();
  });
  
  elements.inputCustomPages.addEventListener('input', (e) => {
    state.customPagesStr = e.target.value;
    validatePageRange();
  });
  
  // Action Download Button
  elements.btnDownload.addEventListener('click', applyWatermarkAndDownload);
  
  // Re-adjust layouts on window resize to keep overlay synced
  window.addEventListener('resize', debounce(() => {
    if (state.pdfDocJs) {
      renderCurrentPage();
    }
  }, 250));
}

// Switch between Text and Image Tabs
function switchTab(type) {
  state.type = type;
  document.getElementById('tab-text').classList.toggle('active', type === 'text');
  document.getElementById('tab-image').classList.toggle('active', type === 'image');
  document.getElementById('options-text').classList.toggle('active', type === 'text');
  document.getElementById('options-image').classList.toggle('active', type === 'image');
  
  // If switching to image and image not uploaded yet, disable download button
  validateDownloadState();
  syncPreview();
}

// Calculate pixel coords for single layout based on state grid position and offsets
function getGridPositionCoords(displayWidth, displayHeight) {
  const margin = displayWidth * 0.05; // 5% border margin
  let x = displayWidth / 2;
  let y = displayHeight / 2;
  
  switch (state.position) {
    case 'TL': x = margin; y = margin; break;
    case 'TC': x = displayWidth / 2; y = margin; break;
    case 'TR': x = displayWidth - margin; y = margin; break;
    case 'ML': x = margin; y = displayHeight / 2; break;
    case 'MC': x = displayWidth / 2; y = displayHeight / 2; break;
    case 'MR': x = displayWidth - margin; y = displayHeight / 2; break;
    case 'BL': x = margin; y = displayHeight - margin; break;
    case 'BC': x = displayWidth / 2; y = displayHeight - margin; break;
    case 'BR': x = displayWidth - margin; y = displayHeight - margin; break;
  }
  
  x += state.offsetX;
  y += state.offsetY;
  
  return { x, y };
}

// Switch Layout Modes: Single or Tiled Pattern or Free Drag
function switchLayoutMode(mode) {
  state.layoutMode = mode;
  elements.modeSingle.classList.toggle('active', mode === 'single');
  elements.modeTiled.classList.toggle('active', mode === 'tiled');
  elements.modeFree.classList.toggle('active', mode === 'free');
  
  if (mode === 'tiled') {
    elements.positionGridContainer.classList.add('hidden');
    elements.offsetSettings.classList.add('hidden');
    elements.overlayElement.classList.remove('draggable');
  } else if (mode === 'free') {
    elements.positionGridContainer.classList.add('hidden');
    elements.offsetSettings.classList.add('hidden');
    elements.overlayElement.classList.add('draggable');
    
    // Maintain visually matching position starting point from grid settings
    const displayWidth = parseFloat(elements.overlayContainer.style.width) || 400;
    const displayHeight = parseFloat(elements.overlayContainer.style.height) || 500;
    const coords = getGridPositionCoords(displayWidth, displayHeight);
    state.dragPercentX = (coords.x / displayWidth) * 100;
    state.dragPercentY = (coords.y / displayHeight) * 100;
  } else {
    elements.positionGridContainer.classList.remove('hidden');
    elements.offsetSettings.classList.remove('hidden');
    elements.overlayElement.classList.remove('draggable');
  }
  
  syncPreview();
}

// Parse PDF File Upload
async function handlePdfFile(file) {
  state.fileName = file.name;
  state.fileSizeStr = formatBytes(file.size);
  
  showLoading(true, 'Reading PDF file...');
  
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    state.pdfBytes = new Uint8Array(arrayBuffer);
    
    // Load with PDF.js for preview rendering (slice a copy to prevent worker from detaching the main buffer)
    const loadingTask = pdfjsLib.getDocument({ data: state.pdfBytes.slice(0) });
    state.pdfDocJs = await loadingTask.promise;
    state.totalPages = state.pdfDocJs.numPages;
    state.currentPage = 1;
    
    // Update Document Meta Info
    elements.pdfFilename.textContent = state.fileName;
    elements.pdfSize.textContent = state.fileSizeStr;
    elements.totalPagesSpan.textContent = state.totalPages;
    elements.currentPageSpan.textContent = state.currentPage;
    
    // UI Layout Updates
    elements.dropzone.classList.add('hidden');
    elements.previewContainer.classList.remove('hidden');
    
    validateDownloadState();
    
    // Render first page
    await renderCurrentPage();
  } catch (error) {
    console.error('Error loading PDF file:', error);
    alert('Failed to load PDF. Please make sure it is a valid, unencrypted PDF.');
    resetApp();
  } finally {
    showLoading(false);
  }
}

// Handle Image Watermark File Upload
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPEG).');
    return;
  }
  
  state.imageType = file.type;
  
  // Read file as ArrayBuffer (used by PDF-lib)
  const bufferReader = new FileReader();
  bufferReader.onload = function(event) {
    state.imageBytes = new Uint8Array(event.target.result);
    // Now that both src and bytes are ready, enable download
    validateDownloadState();
  };
  bufferReader.readAsArrayBuffer(file);
  
  // Read file as DataURL for HTML preview
  const dataReader = new FileReader();
  dataReader.onload = function(event) {
    state.imageSrc = event.target.result;
    
    // Load image element to extract natural dimensions
    const img = new Image();
    img.onload = function() {
      state.imageNaturalWidth = img.naturalWidth;
      state.imageNaturalHeight = img.naturalHeight;
      
      elements.imagePreview.src = state.imageSrc;
      elements.imagePreviewContainer.classList.remove('hidden');
      
      // Show overlay on PDF preview immediately
      syncPreview();
      
      // If overlay container dimensions aren't set yet (PDF not rendered),
      // force a re-render so the overlay appears correctly
      if (state.pdfDocJs && !elements.overlayContainer.style.width) {
        renderCurrentPage();
      }
    };
    img.src = state.imageSrc;
  };
  dataReader.readAsDataURL(file);
}

// Clear Image Watermark
function clearImageWatermark() {
  state.imageSrc = '';
  state.imageBytes = null;
  state.imageType = '';
  state.imageNaturalWidth = 0;
  state.imageNaturalHeight = 0;
  
  elements.inputWmImageFile.value = '';
  elements.imagePreviewContainer.classList.add('hidden');
  elements.imagePreview.src = '';
  
  validateDownloadState();
  syncPreview();
}

// Helper to format file size
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Read File Promise Wrapper
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Pagination Controls
async function changePage(offset) {
  const targetPage = state.currentPage + offset;
  if (targetPage >= 1 && targetPage <= state.totalPages) {
    state.currentPage = targetPage;
    elements.currentPageSpan.textContent = state.currentPage;
    await renderCurrentPage();
  }
}

// Render the selected PDF page via Canvas
async function renderCurrentPage() {
  if (!state.pdfDocJs) return;
  
  showLoading(true, 'Rendering page...');
  
  try {
    const page = await state.pdfDocJs.getPage(state.currentPage);
    
    // Calculate display dimensions to fit container WIDTH (scroll vertically for height)
    const container = elements.previewWorkspace.parentElement;
    const padding = 48; // 24px each side
    const maxWidth = container.clientWidth - padding;
    
    // Get natural page viewport at 1.0 scale
    let viewport = page.getViewport({ scale: 1.0 });
    
    // Keep record of original points scale
    state.pdfPageWidth = viewport.width;
    state.pdfPageHeight = viewport.height;
    
    // Scale to fill the full width of the preview area (like a real PDF viewer)
    // Cap at 2.5x for performance. Vertical overflow will scroll.
    const scale = Math.min(maxWidth / viewport.width, 2.5);
    
    // Re-render viewport at sharp ratio (1.5x of layout dimension)
    const renderScale = scale * 1.5;
    const renderViewport = page.getViewport({ scale: renderScale });
    
    // Match Canvas parameters
    elements.canvas.width = renderViewport.width;
    elements.canvas.height = renderViewport.height;
    
    // Match CSS sizes (what the browser actually displays)
    const displayWidth = renderViewport.width / 1.5;
    const displayHeight = renderViewport.height / 1.5;
    elements.canvas.style.width = `${displayWidth}px`;
    elements.canvas.style.height = `${displayHeight}px`;
    
    // Match overlay dimensions
    elements.overlayContainer.style.width = `${displayWidth}px`;
    elements.overlayContainer.style.height = `${displayHeight}px`;
    
    // Calculate the conversion factor from Points to HTML pixels
    // scaleFactor = PDF Points / HTML pixels
    state.scaleFactor = state.pdfPageWidth / displayWidth;
    
    // Render PDF onto Canvas
    const canvasContext = elements.canvas.getContext('2d');
    const renderContext = {
      canvasContext: canvasContext,
      viewport: renderViewport
    };
    
    await page.render(renderContext).promise;
    
    // Enable pagination buttons dynamically
    elements.btnPrevPage.disabled = state.currentPage === 1;
    elements.btnNextPage.disabled = state.currentPage === state.totalPages;
    
    // Sync watermark preview layer placement
    syncPreview();
  } catch (error) {
    console.error('Error rendering page:', error);
  } finally {
    showLoading(false);
  }
}

// Sync visual watermark overlay matching the user config sliders
function syncPreview() {
  if (!state.pdfDocJs) return;
  
  const displayWidth = parseFloat(elements.overlayContainer.style.width) || 400;
  const displayHeight = parseFloat(elements.overlayContainer.style.height) || 500;
  
  // Handle Single vs Tiled Layout Preview
  if (state.layoutMode === 'single' || state.layoutMode === 'free') {
    elements.overlayElement.classList.remove('hidden');
    elements.overlayTiled.classList.add('hidden');
    
    let x, y;
    if (state.layoutMode === 'free') {
      x = (state.dragPercentX / 100) * displayWidth;
      y = (state.dragPercentY / 100) * displayHeight;
    } else {
      // Calculate baseline coordinate anchor in pixels
      const margin = displayWidth * 0.05; // 5% border margin
      x = displayWidth / 2;
      y = displayHeight / 2;
      
      switch (state.position) {
        case 'TL': x = margin; y = margin; break;
        case 'TC': x = displayWidth / 2; y = margin; break;
        case 'TR': x = displayWidth - margin; y = margin; break;
        case 'ML': x = margin; y = displayHeight / 2; break;
        case 'MC': x = displayWidth / 2; y = displayHeight / 2; break;
        case 'MR': x = displayWidth - margin; y = displayHeight / 2; break;
        case 'BL': x = margin; y = displayHeight - margin; break;
        case 'BC': x = displayWidth / 2; y = displayHeight - margin; break;
        case 'BR': x = displayWidth - margin; y = displayHeight - margin; break;
      }
      
      // Apply offsets
      x += state.offsetX;
      y += state.offsetY;
    }
    
    elements.overlayElement.style.left = `${x}px`;
    elements.overlayElement.style.top = `${y}px`;
    elements.overlayElement.style.opacity = state.opacity / 100;
    
    // Handle Text vs Image Inside Element
    if (state.type === 'text') {
      elements.textPreview.classList.remove('hidden');
      elements.imagePreviewOverlay.classList.add('hidden');
      
      elements.textPreview.textContent = state.text;
      
      // Compute scaling font size
      const htmlFontSize = state.fontSize / state.scaleFactor;
      elements.textPreview.style.fontSize = `${htmlFontSize}px`;
      
      // Font mapping
      elements.textPreview.style.fontFamily = 
        state.font === 'Helvetica' ? 'sans-serif' : 
        state.font === 'TimesRoman' ? 'serif' : 'monospace';
      
      elements.textPreview.style.fontWeight = state.bold ? 'bold' : 'normal';
      elements.textPreview.style.fontStyle = state.italic ? 'italic' : 'normal';
      elements.textPreview.style.color = state.color;
      
      // Center rotation transform
      elements.overlayElement.style.transform = `translate(-50%, -50%) rotate(${state.rotation}deg)`;
    } else {
      // Image type
      if (state.imageSrc) {
        elements.textPreview.classList.add('hidden');
        elements.imagePreviewOverlay.classList.remove('hidden');
        
        elements.imagePreviewOverlay.src = state.imageSrc;
        
        // Calculate image size relative to display
        // Baseline is 40% of page width scaled
        const baseWidthDisplay = (displayWidth * 0.4);
        const htmlImageWidth = baseWidthDisplay * (state.imageScale / 100);
        const htmlImageHeight = htmlImageWidth * (state.imageNaturalHeight / state.imageNaturalWidth);
        
        elements.imagePreviewOverlay.style.width = `${htmlImageWidth}px`;
        elements.imagePreviewOverlay.style.height = `${htmlImageHeight}px`;
        
        elements.overlayElement.style.transform = `translate(-50%, -50%) rotate(${state.rotation}deg)`;
      } else {
        elements.textPreview.classList.add('hidden');
        elements.imagePreviewOverlay.classList.add('hidden');
      }
    }
  } else {
    // Tiled layout mode
    elements.overlayElement.classList.add('hidden');
    elements.overlayTiled.classList.remove('hidden');
    
    elements.overlayTiled.innerHTML = '';
    elements.overlayTiled.style.opacity = state.opacity / 100;
    
    // Create 16 items in a grid layout (4x4)
    for (let i = 0; i < 16; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile-item';
      
      if (state.type === 'text') {
        const span = document.createElement('span');
        span.textContent = state.text;
        
        const htmlFontSize = state.fontSize / state.scaleFactor;
        span.style.fontSize = `${htmlFontSize}px`;
        span.style.fontFamily = 
          state.font === 'Helvetica' ? 'sans-serif' : 
          state.font === 'TimesRoman' ? 'serif' : 'monospace';
        span.style.fontWeight = state.bold ? 'bold' : 'normal';
        span.style.fontStyle = state.italic ? 'italic' : 'normal';
        span.style.color = state.color;
        span.style.transform = `rotate(${state.rotation}deg)`;
        span.style.display = 'inline-block';
        
        tile.appendChild(span);
      } else if (state.type === 'image' && state.imageSrc) {
        const img = document.createElement('img');
        img.src = state.imageSrc;
        
        const baseWidthDisplay = (displayWidth * 0.25); // slightly smaller tiles
        const htmlImageWidth = baseWidthDisplay * (state.imageScale / 100);
        const htmlImageHeight = htmlImageWidth * (state.imageNaturalHeight / state.imageNaturalWidth);
        
        img.style.width = `${htmlImageWidth}px`;
        img.style.height = `${htmlImageHeight}px`;
        img.style.transform = `rotate(${state.rotation}deg)`;
        
        tile.appendChild(img);
      }
      
      elements.overlayTiled.appendChild(tile);
    }
  }
}

// Switch Loading States
function showLoading(show, message = 'Processing...') {
  if (show) {
    elements.loadingMask.querySelector('p').textContent = message;
    elements.loadingMask.classList.remove('hidden');
  } else {
    elements.loadingMask.classList.add('hidden');
  }
}

// Show/Hide Download Processing Bar
function showProgress(show, message = 'Processing PDF...') {
  if (show) {
    elements.progressContainer.classList.remove('hidden');
    elements.progressStatus.textContent = message;
    elements.progressBarFill.style.width = '0%';
  } else {
    elements.progressContainer.classList.add('hidden');
  }
}

// Update Download Progress Value
function updateProgress(percentage, message) {
  elements.progressBarFill.style.width = `${percentage}%`;
  if (message) {
    elements.progressStatus.textContent = message;
  }
}

// Reset App State
function resetApp() {
  state.pdfBytes = null;
  state.pdfDocJs = null;
  state.fileName = '';
  state.fileSizeStr = '';
  state.totalPages = 0;
  state.currentPage = 1;
  
  elements.pdfUpload.value = '';
  elements.dropzone.classList.remove('hidden');
  elements.previewContainer.classList.add('hidden');
  
  clearImageWatermark();
  validateDownloadState();
}

// Validate Custom Page Range Expression
function validatePageRange() {
  let isValid = true;
  elements.pageRangeError.classList.add('hidden');
  
  if (state.pageScope === 'custom') {
    if (!state.customPagesStr.trim()) {
      isValid = false;
    } else {
      const parsed = parsePageRange(state.customPagesStr, state.totalPages);
      if (parsed === null || parsed.length === 0) {
        isValid = false;
        elements.pageRangeError.classList.remove('hidden');
      }
    }
  }
  
  validateDownloadState(isValid);
}

// Parse string range expression e.g. "1, 3-5, 10" to array
function parsePageRange(rangeStr, totalPages) {
  const pages = new Set();
  const parts = rangeStr.split(',');
  
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    
    if (part.includes('-')) {
      const bounds = part.split('-');
      if (bounds.length !== 2) return null;
      const start = parseInt(bounds[0].trim(), 10);
      const end = parseInt(bounds[1].trim(), 10);
      
      if (isNaN(start) || isNaN(end) || start < 1 || end < 1 || start > end) {
        return null;
      }
      
      for (let i = start; i <= Math.min(end, totalPages); i++) {
        pages.add(i);
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return null;
      }
      if (pageNum <= totalPages) {
        pages.add(pageNum);
      }
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b);
}

// Enable/Disable Download button based on validation constraints
function validateDownloadState(isRangeValid = true) {
  const hasPDF = !!state.pdfBytes;
  const hasWatermarkData = state.type === 'text' ? !!state.text : !!state.imageBytes;
  
  const canDownload = hasPDF && hasWatermarkData && isRangeValid;
  elements.btnDownload.disabled = !canDownload;
}

// Main PDF Watermark Generation & Download Trigger
async function applyWatermarkAndDownload() {
  // Defensive defaults for critical state values
  state.offsetX = Number(state.offsetX) || 0;
  state.offsetY = Number(state.offsetY) || 0;
  state.opacity = Number(state.opacity) || 100;
  state.scaleFactor = (typeof state.scaleFactor === 'number' && state.scaleFactor > 0) ? state.scaleFactor : 1;

  // Debug logging – will appear in the browser console
  console.log('applyWatermarkAndDownload – state values:', {
    scaleFactor: state.scaleFactor,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    opacity: state.opacity,
    pdfBytesPresent: !!state.pdfBytes,
    imageBytesPresent: !!state.imageBytes,
    watermarkType: state.type
  });

  state.offsetY = state.offsetY || 0;
  // Ensure scaleFactor and offsets are valid numbers
  if (!state.scaleFactor || typeof state.scaleFactor !== 'number') {
    state.scaleFactor = 1;
  }
  state.offsetX = Number(state.offsetX) || 0;
  state.offsetY = Number(state.offsetY) || 0;
  state.opacity = Number(state.opacity) || 100;
  if (!state.pdfBytes) return;
  
  elements.btnDownload.disabled = true;
  showProgress(true, 'Loading libraries...');
  
  try {
    updateProgress(10, 'Initializing PDF-Lib...');
    
    // Load PDF Document inside pdf-lib (ignore edit/copy permissions to allow watermarking)
    const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes, { ignoreEncryption: true });
    const totalPdfPages = pdfDoc.getPageCount();
    
    // Calculate targeted pages to watermark
    let pagesToWatermark = [];
    if (state.pageScope === 'all') {
      for (let i = 0; i < totalPdfPages; i++) pagesToWatermark.push(i);
    } else if (state.pageScope === 'first') {
      pagesToWatermark.push(0);
    } else if (state.pageScope === 'last') {
      pagesToWatermark.push(totalPdfPages - 1);
    } else if (state.pageScope === 'custom') {
      const parsedIndices = parsePageRange(state.customPagesStr, totalPdfPages);
      if (parsedIndices) {
        pagesToWatermark = parsedIndices.map(p => p - 1); // 0-indexed conversion
      }
    }
    
    if (pagesToWatermark.length === 0) {
      alert('No pages found matching selection criteria.');
      showProgress(false);
      validateDownloadState();
      return;
    }
    
    updateProgress(25, 'Loading assets...');
    
    // Load Font reference
    let fontRef = null;
    if (state.type === 'text') {
      let standardFontName = PDFLib.StandardFonts.Helvetica;
      
      if (state.font === 'Helvetica') {
        if (state.bold && state.italic) standardFontName = PDFLib.StandardFonts.HelveticaBoldOblique;
        else if (state.bold) standardFontName = PDFLib.StandardFonts.HelveticaBold;
        else if (state.italic) standardFontName = PDFLib.StandardFonts.HelveticaOblique;
        else standardFontName = PDFLib.StandardFonts.Helvetica;
      } else if (state.font === 'TimesRoman') {
        if (state.bold && state.italic) standardFontName = PDFLib.StandardFonts.TimesRomanBoldItalic;
        else if (state.bold) standardFontName = PDFLib.StandardFonts.TimesRomanBold;
        else if (state.italic) standardFontName = PDFLib.StandardFonts.TimesRomanItalic;
        else standardFontName = PDFLib.StandardFonts.TimesRoman;
      } else if (state.font === 'Courier') {
        if (state.bold && state.italic) standardFontName = PDFLib.StandardFonts.CourierBoldOblique;
        else if (state.bold) standardFontName = PDFLib.StandardFonts.CourierBold;
        else if (state.italic) standardFontName = PDFLib.StandardFonts.CourierOblique;
        else standardFontName = PDFLib.StandardFonts.Courier;
      }
      
      fontRef = await pdfDoc.embedFont(standardFontName);
    }
    
    // Load Image reference
    let imageRef = null;
    if (state.type === 'image' && state.imageBytes) {
      if (state.imageType === 'image/png') {
        imageRef = await pdfDoc.embedPng(state.imageBytes);
      } else {
        imageRef = await pdfDoc.embedJpg(state.imageBytes);
      }
    }
    
    // Convert hex color to PDF-lib RGB colors
    const rgbColor = hexToRgbPdfLib(state.color);
    const opacityVal = state.opacity / 100;
    
    updateProgress(40, 'Adding watermarks...');
    
    // Loop pages to inject watermarks
    const pagesList = pdfDoc.getPages();
    for (let index = 0; index < pagesToWatermark.length; index++) {
      const pageIndex = pagesToWatermark[index];
      const page = pagesList[pageIndex];
      const { width, height } = page.getSize();
      
      if (state.layoutMode === 'single' || state.layoutMode === 'free') {
        let targetX, targetY;
        
        if (state.layoutMode === 'free') {
          targetX = (state.dragPercentX / 100) * width;
          targetY = height - (state.dragPercentY / 100) * height;
        } else {
          // Compute anchor positions in Points
          const margin = width * 0.05;
          let tx = width / 2;
          let ty = height / 2;
          
          switch (state.position) {
            case 'TL': tx = margin; ty = height - margin; break;
            case 'TC': tx = width / 2; ty = height - margin; break;
            case 'TR': tx = width - margin; ty = height - margin; break;
            case 'ML': tx = margin; ty = height / 2; break;
            case 'MC': tx = width / 2; ty = height / 2; break;
            case 'MR': tx = width - margin; ty = height / 2; break;
            case 'BL': tx = margin; ty = margin; break;
            case 'BC': tx = width / 2; ty = margin; break;
            case 'BR': tx = width - margin; ty = margin; break;
          }
          
          // Convert screen coordinates adjustments to PDF scale points
          // X moves left to right (same in HTML and PDF)
          const pdfOffsetX = state.offsetX * state.scaleFactor;
          // Y moves top to bottom in HTML (positive means down),
          // which matches subtraction in PDF points (since 0 is at the bottom).
          const pdfOffsetY = state.offsetY * state.scaleFactor;
          
          targetX = tx + pdfOffsetX;
          targetY = ty - pdfOffsetY;
        }
        
        if (state.type === 'text') {
          const textW = fontRef.widthOfTextAtSize(state.text, state.fontSize);
          const textH = fontRef.heightAtSize(state.fontSize);
          
          // Rotation math
          const rad = (state.rotation * Math.PI) / 180;
          const rx = (textW / 2) * Math.cos(rad) - (textH / 2) * Math.sin(rad);
          const ry = (textW / 2) * Math.sin(rad) + (textH / 2) * Math.cos(rad);
          
          page.drawText(state.text, {
            x: targetX - rx,
            y: targetY - ry,
            size: state.fontSize,
            font: fontRef,
            color: rgbColor,
            opacity: opacityVal,
            rotate: PDFLib.degrees(state.rotation)
          });
        } else if (state.type === 'image' && imageRef) {
          const baseWidth = width * 0.4;
          const imageW = baseWidth * (state.imageScale / 100);
          const imageH = imageW * (state.imageNaturalHeight / state.imageNaturalWidth);
          
          const rad = (state.rotation * Math.PI) / 180;
          const rx = (imageW / 2) * Math.cos(rad) - (imageH / 2) * Math.sin(rad);
          const ry = (imageW / 2) * Math.sin(rad) + (imageH / 2) * Math.cos(rad);
          
          page.drawImage(imageRef, {
            x: targetX - rx,
            y: targetY - ry,
            width: imageW,
            height: imageH,
            opacity: opacityVal,
            rotate: PDFLib.degrees(state.rotation)
          });
        }
      } else {
        // Tiled mode injection (4x4 pattern)
        const cols = 4;
        const rows = 4;
        
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const tx = (width / cols) * (c + 0.5);
            const ty = (height / rows) * (r + 0.5);
            
            if (state.type === 'text') {
              const textW = fontRef.widthOfTextAtSize(state.text, state.fontSize);
              const textH = fontRef.heightAtSize(state.fontSize);
              
              const rad = (state.rotation * Math.PI) / 180;
              const rx = (textW / 2) * Math.cos(rad) - (textH / 2) * Math.sin(rad);
              const ry = (textW / 2) * Math.sin(rad) + (textH / 2) * Math.cos(rad);
              
              page.drawText(state.text, {
                x: tx - rx,
                y: ty - ry,
                size: state.fontSize,
                font: fontRef,
                color: rgbColor,
                opacity: opacityVal,
                rotate: PDFLib.degrees(state.rotation)
              });
            } else if (state.type === 'image' && imageRef) {
              const baseWidth = width * 0.25; // slightly smaller tiled image width
              const imageW = baseWidth * (state.imageScale / 100);
              const imageH = imageW * (state.imageNaturalHeight / state.imageNaturalWidth);
              
              const rad = (state.rotation * Math.PI) / 180;
              const rx = (imageW / 2) * Math.cos(rad) - (imageH / 2) * Math.sin(rad);
              const ry = (imageW / 2) * Math.sin(rad) + (imageH / 2) * Math.cos(rad);
              
              page.drawImage(imageRef, {
                x: tx - rx,
                y: ty - ry,
                width: imageW,
                height: imageH,
                opacity: opacityVal,
                rotate: PDFLib.degrees(state.rotation)
              });
            }
          }
        }
      }
      
      const percent = Math.floor(40 + (index / pagesToWatermark.length) * 40);
      updateProgress(percent, `Watermarking page ${pageIndex + 1}...`);
    }
    
    updateProgress(85, 'Compiling file bytes...');
    const modifiedBytes = await pdfDoc.save();
    
    updateProgress(95, 'Initiating download...');
    triggerDownload(modifiedBytes);
    
    updateProgress(100, 'Successfully completed!');
    
    setTimeout(() => {
      showProgress(false);
      validateDownloadState();
    }, 1500);
    
  } catch (error) {
    console.error('Error applying watermark:', error);
    const errMsg = `${error.name || 'Error'}: ${error.message || error}\n\nStack Trace:\n${error.stack || 'No stack trace available'}`;
    alert('An error occurred while generating the PDF:\n\n' + errMsg);
    showProgress(false);
    validateDownloadState();
  }
}

// Convert Hex String e.g. "#FF0000" to PDF-Lib's rgb() format
function hexToRgbPdfLib(hex) {
  if (typeof hex !== 'string') {
    hex = '#ff0000';
  }
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) {
    return PDFLib.rgb(1, 0, 0); // Safe fallback to red
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return PDFLib.rgb(r, g, b);
}

// Download byte stream as browser attachment
function triggerDownload(bytes) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  
  // Format filename e.g. doc-watermarked.pdf
  const baseName = state.fileName.endsWith('.pdf') ? state.fileName.slice(0, -4) : state.fileName;
  a.download = `${baseName}-watermarked.pdf`;
  
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Simple debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
