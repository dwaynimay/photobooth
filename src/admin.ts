// --- INISIALISASI ELEMEN ---
const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// UI Elements
const uploadContainer = document.getElementById('upload-container') as HTMLDivElement;
const uploadCard = document.getElementById('upload-card') as HTMLDivElement;
const btnUploadTrigger = document.getElementById('btn-upload-trigger') as HTMLButtonElement;
const imageInput = document.getElementById('tpl-image') as HTMLInputElement;
const canvasWrapper = document.getElementById('canvas-wrapper') as HTMLDivElement;
const workspace = document.getElementById('workspace') as HTMLElement;

// Toolbar Elements
const inputName = document.getElementById('tpl-name') as HTMLInputElement;
const inputId = document.getElementById('tpl-id') as HTMLInputElement;
const btnGenerateName = document.getElementById('btn-generate-name') as HTMLButtonElement;
const btnAutoDetect = document.getElementById('btn-autodetect') as HTMLButtonElement;
const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement;
const btnNew = document.getElementById('btn-new') as HTMLButtonElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;

// Zoom & Context Elements
const btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement;
const btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement;
const zoomInfo = document.getElementById('zoom-info') as HTMLSpanElement;
const slotToolbar = document.getElementById('slot-toolbar') as HTMLDivElement;
const btnDeleteSlot = document.getElementById('btn-delete-slot') as HTMLButtonElement;
const toastContainer = document.getElementById('toast-container') as HTMLDivElement;

// --- TIPE DATA ---
interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

type InteractionMode =
  | 'none'
  | 'draw'
  | 'move'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se';

// --- STATE KANVAS ---
let uploadedImage = new Image();
let slots: Slot[] = [];
let selectedSlotIndex = -1;
let hoveredSlotIndex = -1;
let interactionMode: InteractionMode = 'none';
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
let dragOffsetX = 0, dragOffsetY = 0;
let initialSlotState: Slot | null = null;

let zoomScale = 1;

// --- HISTORY STATE (UNDO/REDO) ---
let history: Slot[][] = [];
let historyIndex = -1;

function saveState(): void {
  history = history.slice(0, historyIndex + 1);
  history.push(JSON.parse(JSON.stringify(slots)));
  historyIndex++;
  updateHistoryButtons();
}

function undo(): void {
  if (historyIndex > 0) {
    historyIndex--;
    slots = JSON.parse(JSON.stringify(history[historyIndex]));
    selectedSlotIndex = -1;
    hoveredSlotIndex = -1;
    updateSlotToolbar();
    redraw();
    updateHistoryButtons();
  }
}

function redo(): void {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    slots = JSON.parse(JSON.stringify(history[historyIndex]));
    selectedSlotIndex = -1;
    hoveredSlotIndex = -1;
    updateSlotToolbar();
    redraw();
    updateHistoryButtons();
  }
}

function updateHistoryButtons(): void {
  btnUndo.disabled = historyIndex <= 0;
  btnRedo.disabled = historyIndex >= history.length - 1;
}

btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'y') { e.preventDefault(); redo(); }
  }
});

// --- FUNGSI TOAST ---
function showToast(message: string, isError = false): void {
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.innerText = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- ZOOM LOGIC ---
function updateZoom(newScale: number): void {
  zoomScale = Math.max(0.1, Math.min(newScale, 4));
  zoomInfo.innerText = `${Math.round(zoomScale * 100)}%`;
  if (uploadedImage.width > 0) {
    canvas.style.width = `${canvas.width * zoomScale}px`;
    canvas.style.height = `${canvas.height * zoomScale}px`;
    updateSlotToolbar();
    redraw();
  }
}

btnZoomIn.addEventListener('click', () => updateZoom(zoomScale + 0.1));
btnZoomOut.addEventListener('click', () => updateZoom(zoomScale - 0.1));

workspace.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.002;
    updateZoom(zoomScale + zoomDelta);
  }
}, { passive: false });

// --- DRAG & DROP + UPLOAD FILE ---
btnUploadTrigger.addEventListener('click', () => imageInput.click());

uploadCard.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadCard.classList.add('drag-over');
});

uploadCard.addEventListener('dragleave', () => {
  uploadCard.classList.remove('drag-over');
});

uploadCard.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadCard.classList.remove('drag-over');
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    handleImageFile(e.dataTransfer.files[0]);
  }
});

imageInput.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleImageFile(target.files[0]);
  }
});

function handleImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    showToast('Format file tidak didukung.', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tempImg.width;
      tempCanvas.height = tempImg.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(tempImg, 0, 0);

      const data = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
      let minX = tempCanvas.width, minY = tempCanvas.height, maxX = 0, maxY = 0;
      let hasVisiblePixels = false;

      for (let y = 0; y < tempCanvas.height; y++) {
        for (let x = 0; x < tempCanvas.width; x++) {
          if (data[(y * tempCanvas.width + x) * 4 + 3] > 10) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            hasVisiblePixels = true;
          }
        }
      }

      if (!hasVisiblePixels) { showToast('Gambar sepenuhnya transparan.', true); return; }

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      cropCanvas.getContext('2d')!.drawImage(tempCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      uploadedImage = new Image();
      uploadedImage.onload = () => {
        canvas.width = uploadedImage.width;
        canvas.height = uploadedImage.height;

        uploadContainer.style.opacity = '0';
        setTimeout(() => {
          uploadContainer.style.display = 'none';
          canvasWrapper.style.display = 'block';
        }, 300);

        slots = [];
        history = [];
        historyIndex = -1;
        saveState();

        selectedSlotIndex = -1;
        hoveredSlotIndex = -1;

        btnAutoDetect.disabled = false;
        btnGenerateName.disabled = false;

        zoomScale = 1;
        updateZoom(zoomScale);
        showToast('Gambar dimuat! Silakan buat slot.');
      };
      uploadedImage.src = cropCanvas.toDataURL('image/png');
    };
    tempImg.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
}

// --- INTEGRASI GEMINI API ---
async function callGeminiWithRetry(prompt: string, base64Image: string): Promise<string> {
  const apiKey = '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: base64Image } },
      ],
    }],
  };

  const delays = [1000, 2000, 4000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('HTTP error!');
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (error) {
      if (i === delays.length) throw error;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
  return '';
}

btnGenerateName.addEventListener('click', async () => {
  if (!uploadedImage.src) return;
  const base64Image = uploadedImage.src.split(',')[1];
  const prompt = 'Berikan 1 nama singkat yang kreatif (maksimal 3 kata) untuk desain bingkai photobooth ini. Tanpa tanda kutip. Contoh: Retro Strip, Blue Ocean, dll.';

  btnGenerateName.disabled = true;
  btnGenerateName.style.color = 'var(--primary)';
  showToast('Sedang berpikir...');

  try {
    const generatedName = await callGeminiWithRetry(prompt, base64Image);
    if (generatedName) {
      const cleanName = generatedName.replace(/["*]/g, '');
      inputName.value = cleanName;
      inputId.value = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      showToast('Nama dibuat oleh AI!');
    }
  } catch {
    showToast('Gagal menghubungi AI.', true);
  } finally {
    btnGenerateName.disabled = false;
    btnGenerateName.style.color = '';
  }
});

inputName.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  inputId.value = target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
});

// --- LOGIKA MENGGAMBAR KANVAS ---
function varColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawHandle(x: number, y: number): void {
  ctx.fillStyle = varColor('--handle-color');
  ctx.strokeStyle = varColor('--selected-outline');
  ctx.lineWidth = 1.5 / zoomScale;
  ctx.beginPath();
  const radius = 5 / zoomScale;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function redraw(): void {
  if (!uploadedImage.src) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(uploadedImage, 0, 0);

  const colorHover = varColor('--hover-outline');
  const colorSelected = varColor('--selected-outline');

  slots.forEach((s, i) => {
    const isSelected = (i === selectedSlotIndex);
    const isHovered = (i === hoveredSlotIndex && !isSelected);

    if (isSelected) {
      ctx.strokeStyle = colorSelected;
      ctx.lineWidth = 2 / zoomScale;
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
    } else if (isHovered) {
      ctx.strokeStyle = colorHover;
      ctx.lineWidth = 2 / zoomScale;
      ctx.fillStyle = 'transparent';
    } else {
      ctx.strokeStyle = 'transparent';
      ctx.lineWidth = 0;
      ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
    }

    ctx.fillRect(s.x, s.y, s.w, s.h);
    if (ctx.lineWidth > 0) {
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    }

    if (isSelected) {
      drawHandle(s.x, s.y);
      drawHandle(s.x + s.w, s.y);
      drawHandle(s.x, s.y + s.h);
      drawHandle(s.x + s.w, s.y + s.h);
    }
  });

  if (interactionMode === 'draw') {
    const w = currentX - startX;
    const h = currentY - startY;
    ctx.strokeStyle = varColor('--primary');
    ctx.lineWidth = 2 / zoomScale;
    const dashSize = 6 / zoomScale;
    ctx.setLineDash([dashSize, dashSize]);
    ctx.strokeRect(startX, startY, w, h);
    ctx.setLineDash([]);
  }
}

// --- FLOATING TOOLBAR LOGIC ---
function updateSlotToolbar(): void {
  if (selectedSlotIndex === -1) {
    slotToolbar.style.display = 'none';
    return;
  }
  const slot = slots[selectedSlotIndex];
  const visualX = slot.x * zoomScale;
  const visualY = slot.y * zoomScale;
  const visualW = slot.w * zoomScale;

  slotToolbar.style.display = 'flex';
  slotToolbar.style.left = `${visualX + (visualW / 2)}px`;
  slotToolbar.style.top = `${visualY}px`;
}

btnDeleteSlot.addEventListener('click', () => {
  if (selectedSlotIndex !== -1) {
    slots.splice(selectedSlotIndex, 1);
    selectedSlotIndex = -1;
    updateSlotToolbar();
    saveState();
    redraw();
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSlotIndex !== -1) {
    if ((document.activeElement as HTMLElement).tagName === 'INPUT') return;
    slots.splice(selectedSlotIndex, 1);
    selectedSlotIndex = -1;
    updateSlotToolbar();
    saveState();
    redraw();
  }
});

// --- HIT DETECTION & INTERACTION ---
function getMousePos(e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function checkHandleHit(x: number, y: number, slot: Slot): InteractionMode | null {
  const hitRadius = 12 / zoomScale;
  const dist = (px: number, py: number, hx: number, hy: number) =>
    Math.sqrt(Math.pow(px - hx, 2) + Math.pow(py - hy, 2));

  if (dist(x, y, slot.x, slot.y) <= hitRadius) return 'resize-nw';
  if (dist(x, y, slot.x + slot.w, slot.y) <= hitRadius) return 'resize-ne';
  if (dist(x, y, slot.x, slot.y + slot.h) <= hitRadius) return 'resize-sw';
  if (dist(x, y, slot.x + slot.w, slot.y + slot.h) <= hitRadius) return 'resize-se';
  return null;
}

function checkSlotHit(x: number, y: number): number {
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      return i;
    }
  }
  return -1;
}

// --- EVENT LISTENERS CANVAS ---
canvas.addEventListener('mousedown', (e) => {
  const pos = getMousePos(e);
  startX = pos.x;
  startY = pos.y;
  currentX = startX;
  currentY = startY;

  if (selectedSlotIndex !== -1) {
    const hitHandle = checkHandleHit(startX, startY, slots[selectedSlotIndex]);
    if (hitHandle) {
      interactionMode = hitHandle;
      initialSlotState = { ...slots[selectedSlotIndex] };
      slotToolbar.style.display = 'none';
      return;
    }
  }

  const hitSlot = checkSlotHit(startX, startY);
  if (hitSlot !== -1) {
    selectedSlotIndex = hitSlot;
    hoveredSlotIndex = -1;
    interactionMode = 'move';
    dragOffsetX = startX - slots[hitSlot].x;
    dragOffsetY = startY - slots[hitSlot].y;
    slotToolbar.style.display = 'none';
    redraw();
    return;
  }

  selectedSlotIndex = -1;
  interactionMode = 'draw';
  updateSlotToolbar();
  redraw();
});

canvas.addEventListener('mousemove', (e) => {
  const pos = getMousePos(e);
  currentX = pos.x;
  currentY = pos.y;

  if (interactionMode === 'none') {
    let cursor = 'crosshair';
    let hitHandle: InteractionMode | null = null;
    const hitSlot = checkSlotHit(currentX, currentY);

    if (selectedSlotIndex !== -1) {
      hitHandle = checkHandleHit(currentX, currentY, slots[selectedSlotIndex]);
      if (hitHandle === 'resize-nw' || hitHandle === 'resize-se') cursor = 'nwse-resize';
      else if (hitHandle === 'resize-ne' || hitHandle === 'resize-sw') cursor = 'nesw-resize';
      else if (hitSlot === selectedSlotIndex) cursor = 'move';
    } else if (hitSlot !== -1) {
      cursor = 'pointer';
    }

    canvas.style.cursor = cursor;

    if (hoveredSlotIndex !== hitSlot && !hitHandle) {
      hoveredSlotIndex = hitSlot;
      redraw();
    } else if (hitHandle && hoveredSlotIndex !== -1) {
      hoveredSlotIndex = -1;
      redraw();
    }
    return;
  }

  if (interactionMode === 'draw') {
    redraw();
  } else if (interactionMode === 'move') {
    const slot = slots[selectedSlotIndex];
    slot.x = Math.round(currentX - dragOffsetX);
    slot.y = Math.round(currentY - dragOffsetY);
    redraw();
  } else if (interactionMode.startsWith('resize')) {
    const slot = slots[selectedSlotIndex];
    const state = initialSlotState!;

    if (interactionMode === 'resize-nw') {
      slot.w = Math.round(state.w + (state.x - currentX));
      slot.h = Math.round(state.h + (state.y - currentY));
      slot.x = Math.round(currentX);
      slot.y = Math.round(currentY);
    } else if (interactionMode === 'resize-ne') {
      slot.w = Math.round(currentX - state.x);
      slot.h = Math.round(state.h + (state.y - currentY));
      slot.y = Math.round(currentY);
    } else if (interactionMode === 'resize-sw') {
      slot.w = Math.round(state.w + (state.x - currentX));
      slot.h = Math.round(currentY - state.y);
      slot.x = Math.round(currentX);
    } else if (interactionMode === 'resize-se') {
      slot.w = Math.round(currentX - state.x);
      slot.h = Math.round(currentY - state.y);
    }

    if (slot.w < 10) slot.w = 10;
    if (slot.h < 10) slot.h = 10;
    redraw();
  }
});

canvas.addEventListener('mouseleave', () => {
  if (hoveredSlotIndex !== -1) {
    hoveredSlotIndex = -1;
    redraw();
  }
});

canvas.addEventListener('mouseup', () => {
  let stateChanged = false;

  if (interactionMode === 'draw') {
    const w = currentX - startX;
    const h = currentY - startY;
    const x = Math.round(w < 0 ? startX + w : startX);
    const y = Math.round(h < 0 ? startY + h : startY);
    const finalW = Math.round(Math.abs(w));
    const finalH = Math.round(Math.abs(h));

    if (finalW > 15 && finalH > 15) {
      slots.push({ x, y, w: finalW, h: finalH });
      selectedSlotIndex = slots.length - 1;
      stateChanged = true;
    }
  } else if (interactionMode !== 'none') {
    stateChanged = true;
  }

  if (stateChanged) saveState();

  interactionMode = 'none';
  initialSlotState = null;
  hoveredSlotIndex = checkSlotHit(currentX, currentY);

  updateSlotToolbar();
  redraw();
});

// --- FITUR AUTO-DETECT ---
btnAutoDetect.addEventListener('click', () => {
  if (!uploadedImage.src) return;

  const width = canvas.width;
  const height = canvas.height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  tempCanvas.getContext('2d')!.drawImage(uploadedImage, 0, 0);

  const data = tempCanvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const visited = new Uint8Array(width * height);
  const newSlots: Slot[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx]) {
        visited[idx] = 1;
        if (data[idx * 4 + 3] < 20) {
          let minX = x, maxX = x, minY = y, maxY = y;
          const queue = [idx];
          let head = 0;

          while (head < queue.length) {
            const curr = queue[head++];
            const cx = curr % width;
            const cy = Math.floor(curr / width);

            if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;

            const neighbors = [curr - 1, curr + 1, curr - width, curr + width];
            for (const n of neighbors) {
              if (n >= 0 && n < visited.length && !visited[n]) {
                if (Math.abs((n % width) - cx) <= 1) {
                  if (data[n * 4 + 3] < 20) {
                    visited[n] = 1;
                    queue.push(n);
                  }
                }
              }
            }
          }

          const slotW = maxX - minX + 1;
          const slotH = maxY - minY + 1;

          if (slotW > 50 && slotH > 50 && (slotW < width * 0.99 || slotH < height * 0.99)) {
            newSlots.push({ x: minX, y: minY, w: slotW, h: slotH });
          }
        }
      }
    }
  }

  if (newSlots.length > 0) {
    slots = newSlots;
    selectedSlotIndex = -1;
    hoveredSlotIndex = -1;
    updateSlotToolbar();
    saveState();
    showToast(`Ditemukan ${newSlots.length} slot transparan!`);
    redraw();
  } else {
    showToast('Tidak ditemukan area transparan.', true);
  }
});

// --- RESET / NEW TEMPLATE ---
btnNew.addEventListener('click', () => {
  if (slots.length > 0 || uploadedImage.width > 0) {
    const confirmReset = confirm('Apakah Anda yakin ingin memulai dari awal? Semua perubahan akan hilang.');
    if (!confirmReset) return;
  }
  window.location.reload();
});

// --- SIMPAN TEMPLATE ---
btnSave.addEventListener('click', async () => {
  if (!uploadedImage.src || slots.length === 0) {
    return showToast('Unggah gambar dan buat slot.', true);
  }
  if (!inputId.value || !inputName.value) {
    return showToast('Isi Nama Template atau gunakan AI.', true);
  }

  const res = await fetch(uploadedImage.src);
  const blob = await res.blob();
  const fileToUpload = new File([blob], `template_${Date.now()}.png`, { type: blob.type });

  const config = {
    id: inputId.value,
    name: inputName.value,
    width: canvas.width,
    height: canvas.height,
    slots,
  };
  const formData = new FormData();
  formData.append('image', fileToUpload);
  formData.append('config', JSON.stringify(config));

  btnSave.disabled = true;
  btnSave.innerText = 'Saving...';

  try {
    const response = await fetch('http://localhost:3000/api/templates', {
      method: 'POST',
      body: formData,
    });
    if (response.ok) {
      showToast('Template berhasil disimpan!');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast('Gagal menyimpan ke server.', true);
    }
  } catch {
    showToast(`SIMULASI SIMPAN: ${config.slots.length} slot tersimpan.`, true);
    setTimeout(() => window.location.reload(), 2000);
  } finally {
    btnSave.disabled = false;
    btnSave.innerText = 'Save';
  }
});
