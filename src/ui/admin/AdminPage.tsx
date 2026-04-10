import { useRef, useState, useEffect, useCallback } from 'react';
import type { Slot } from '../../types';
import { TOAST_DURATION_MS } from '../../constants';
import { ApiService } from '../../services/api-service';
import { useAdminHistory } from './useAdminHistory';
import { renderCanvas, type InteractionMode } from './canvas-renderer';
import { generateTemplateName } from './gemini';

const apiService = new ApiService();

interface Toast {
  id: number;
  message: string;
  isError: boolean;
}

export function AdminPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const initialSlotState = useRef<Slot | null>(null);

  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(-1);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState(-1);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none');
  const [zoomScale, setZoomScale] = useState(1);
  const [templateName, setTemplateName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const history = useAdminHistory();

  const showToast = useCallback((message: string, isError = false) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, isError }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedImage) return;
    const ctx = canvas.getContext('2d')!;
    renderCanvas(ctx, uploadedImage, slots, {
      selectedSlotIndex, hoveredSlotIndex, interactionMode,
      startPos: startPos.current, currentPos: currentPos.current, zoomScale,
    });
  }, [slots, selectedSlotIndex, hoveredSlotIndex, interactionMode, zoomScale, uploadedImage]);

  const handleZoom = useCallback((delta: number) => {
    setZoomScale(prev => Math.max(0.1, Math.min(prev + delta, 4)));
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleZoom(e.deltaY * -0.002); }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [handleZoom]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isInput = (document.activeElement as HTMLElement).tagName === 'INPUT';
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const prev = history.undo();
        if (prev) { setSlots(prev); setSelectedSlotIndex(-1); setHoveredSlotIndex(-1); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        const next = history.redo();
        if (next) { setSlots(next); setSelectedSlotIndex(-1); setHoveredSlotIndex(-1); }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput && selectedSlotIndex !== -1) {
        setSlots(prev => { const updated = prev.filter((_, i) => i !== selectedSlotIndex); history.saveState(updated); return updated; });
        setSelectedSlotIndex(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSlotIndex, history]);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { showToast('Format file tidak didukung.', true); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const tempImg = new Image();
      tempImg.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tempImg.width; tempCanvas.height = tempImg.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(tempImg, 0, 0);
        const data = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        let minX = tempCanvas.width, minY = tempCanvas.height, maxX = 0, maxY = 0, hasVisible = false;
        for (let y = 0; y < tempCanvas.height; y++) {
          for (let x = 0; x < tempCanvas.width; x++) {
            if (data[(y * tempCanvas.width + x) * 4 + 3] > 10) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
              hasVisible = true;
            }
          }
        }
        if (!hasVisible) { showToast('Gambar sepenuhnya transparan.', true); return; }
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = maxX - minX + 1; cropCanvas.height = maxY - minY + 1;
        cropCanvas.getContext('2d')!.drawImage(tempCanvas, minX, minY, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);
        const img = new Image();
        img.onload = () => { setUploadedImage(img); setSlots([]); setSelectedSlotIndex(-1); setZoomScale(1); history.saveState([]); showToast('Gambar dimuat! Silakan buat slot.'); };
        img.src = cropCanvas.toDataURL('image/png');
      };
      tempImg.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [history, showToast]);

  const handleAutoDetect = useCallback(() => {
    if (!uploadedImage) return;
    const w = uploadedImage.width, h = uploadedImage.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    tempCanvas.getContext('2d')!.drawImage(uploadedImage, 0, 0);
    const data = tempCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
    const visited = new Uint8Array(w * h);
    const found: Slot[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!visited[idx] && data[idx * 4 + 3] < 20) {
          visited[idx] = 1;
          let minX = x, maxX = x, minY = y, maxY = y;
          const queue = [idx]; let head = 0;
          while (head < queue.length) {
            const curr = queue[head++];
            const cx = curr % w, cy = Math.floor(curr / w);
            if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
            for (const n of [curr - 1, curr + 1, curr - w, curr + w]) {
              if (n >= 0 && n < visited.length && !visited[n] && Math.abs((n % w) - cx) <= 1 && data[n * 4 + 3] < 20) { visited[n] = 1; queue.push(n); }
            }
          }
          const sw = maxX - minX + 1, sh = maxY - minY + 1;
          if (sw > 50 && sh > 50 && (sw < w * 0.99 || sh < h * 0.99)) found.push({ x: minX, y: minY, w: sw, h: sh });
        }
      }
    }
    if (found.length > 0) { setSlots(found); setSelectedSlotIndex(-1); history.saveState(found); showToast(`Ditemukan ${found.length} slot transparan!`); }
    else showToast('Tidak ditemukan area transparan.', true);
  }, [uploadedImage, history, showToast]);

  const handleGenerateName = useCallback(async () => {
    if (!uploadedImage) return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
    if (!apiKey) { showToast('VITE_GEMINI_API_KEY tidak ditemukan di .env', true); return; }
    setIsGeneratingName(true); showToast('Sedang berpikir...');
    try {
      const name = await generateTemplateName(uploadedImage.src.split(',')[1], apiKey);
      if (name) { setTemplateName(name); setTemplateId(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); showToast('Nama dibuat oleh AI!'); }
    } catch { showToast('Gagal menghubungi AI.', true); }
    finally { setIsGeneratingName(false); }
  }, [uploadedImage, showToast]);

  const handleNameChange = useCallback((value: string) => {
    setTemplateName(value);
    setTemplateId(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }, []);

  const handleSave = useCallback(async () => {
    if (!uploadedImage || slots.length === 0) { showToast('Unggah gambar dan buat slot.', true); return; }
    if (!templateId || !templateName) { showToast('Isi Nama Template atau gunakan AI.', true); return; }
    setIsSaving(true);
    try {
      const blob = await (await fetch(uploadedImage.src)).blob();
      const file = new File([blob], `template_${Date.now()}.png`, { type: blob.type });
      await apiService.saveTemplate({ id: templateId, name: templateName, image: '', width: uploadedImage.width, height: uploadedImage.height, slots }, file);
      showToast('Template berhasil disimpan!');
      setTimeout(() => window.location.href = '/admin', 1500);
    } catch { showToast('Gagal menyimpan ke server.', true); }
    finally { setIsSaving(false); }
  }, [uploadedImage, slots, templateId, templateName, showToast]);

  function getMousePos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width), y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height) };
  }

  function checkHandleHit(x: number, y: number, slot: Slot): InteractionMode | null {
    const r = 12 / zoomScale;
    const d = (px: number, py: number, hx: number, hy: number) => Math.hypot(px - hx, py - hy);
    if (d(x, y, slot.x, slot.y) <= r) return 'resize-nw';
    if (d(x, y, slot.x + slot.w, slot.y) <= r) return 'resize-ne';
    if (d(x, y, slot.x, slot.y + slot.h) <= r) return 'resize-sw';
    if (d(x, y, slot.x + slot.w, slot.y + slot.h) <= r) return 'resize-se';
    return null;
  }

  function checkSlotHit(x: number, y: number): number {
    for (let i = slots.length - 1; i >= 0; i--) {
      const s = slots[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return i;
    }
    return -1;
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    startPos.current = pos; currentPos.current = pos;
    if (selectedSlotIndex !== -1) {
      const hit = checkHandleHit(pos.x, pos.y, slots[selectedSlotIndex]);
      if (hit) { setInteractionMode(hit); initialSlotState.current = { ...slots[selectedSlotIndex] }; return; }
    }
    const hitSlot = checkSlotHit(pos.x, pos.y);
    if (hitSlot !== -1) { setSelectedSlotIndex(hitSlot); setHoveredSlotIndex(-1); setInteractionMode('move'); dragOffset.current = { x: pos.x - slots[hitSlot].x, y: pos.y - slots[hitSlot].y }; return; }
    setSelectedSlotIndex(-1); setInteractionMode('draw');
  }, [selectedSlotIndex, slots, zoomScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    currentPos.current = pos;
    if (interactionMode === 'none') {
      let cursor = 'crosshair';
      const hitSlot = checkSlotHit(pos.x, pos.y);
      if (selectedSlotIndex !== -1) {
        const hit = checkHandleHit(pos.x, pos.y, slots[selectedSlotIndex]);
        if (hit === 'resize-nw' || hit === 'resize-se') cursor = 'nwse-resize';
        else if (hit === 'resize-ne' || hit === 'resize-sw') cursor = 'nesw-resize';
        else if (hitSlot === selectedSlotIndex) cursor = 'move';
      } else if (hitSlot !== -1) cursor = 'pointer';
      canvasRef.current!.style.cursor = cursor;
      setHoveredSlotIndex(hitSlot);
      return;
    }
    if (interactionMode === 'move') {
      setSlots(prev => prev.map((s, i) => i === selectedSlotIndex ? { ...s, x: Math.round(pos.x - dragOffset.current.x), y: Math.round(pos.y - dragOffset.current.y) } : s));
    } else if (interactionMode.startsWith('resize')) {
      const state = initialSlotState.current!;
      setSlots(prev => prev.map((s, i) => {
        if (i !== selectedSlotIndex) return s;
        let { x, y, w, h } = s;
        if (interactionMode === 'resize-nw') { w = Math.max(10, Math.round(state.w + (state.x - pos.x))); h = Math.max(10, Math.round(state.h + (state.y - pos.y))); x = Math.round(pos.x); y = Math.round(pos.y); }
        if (interactionMode === 'resize-ne') { w = Math.max(10, Math.round(pos.x - state.x)); h = Math.max(10, Math.round(state.h + (state.y - pos.y))); y = Math.round(pos.y); }
        if (interactionMode === 'resize-sw') { w = Math.max(10, Math.round(state.w + (state.x - pos.x))); h = Math.max(10, Math.round(pos.y - state.y)); x = Math.round(pos.x); }
        if (interactionMode === 'resize-se') { w = Math.max(10, Math.round(pos.x - state.x)); h = Math.max(10, Math.round(pos.y - state.y)); }
        return { x, y, w, h };
      }));
    }
    setInteractionMode(prev => prev);
  }, [interactionMode, selectedSlotIndex, slots, zoomScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => {
    if (interactionMode === 'draw') {
      const { x: sx, y: sy } = startPos.current, { x: cx, y: cy } = currentPos.current;
      const w = Math.round(Math.abs(cx - sx)), h = Math.round(Math.abs(cy - sy));
      if (w > 15 && h > 15) {
        const newSlot: Slot = { x: Math.round(Math.min(sx, cx)), y: Math.round(Math.min(sy, cy)), w, h };
        setSlots(prev => { const updated = [...prev, newSlot]; history.saveState(updated); setSelectedSlotIndex(updated.length - 1); return updated; });
      }
    } else if (interactionMode !== 'none') { history.saveState(slots); }
    setInteractionMode('none'); initialSlotState.current = null;
  }, [interactionMode, slots, history]);

  const handleDeleteSlot = useCallback(() => {
    setSlots(prev => { const updated = prev.filter((_, i) => i !== selectedSlotIndex); history.saveState(updated); return updated; });
    setSelectedSlotIndex(-1);
  }, [selectedSlotIndex, history]);

  const slotToolbarStyle = selectedSlotIndex !== -1 ? {
    display: 'flex',
    left: (slots[selectedSlotIndex].x + slots[selectedSlotIndex].w / 2) * zoomScale,
    top: slots[selectedSlotIndex].y * zoomScale,
  } : { display: 'none' };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#f3f4f6', color: '#111827' }}>
      {/* Top Toolbar */}
      <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', justifyContent: 'center', width: '100%', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', background: '#fff', borderRadius: 50, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)' }}>
          <input type="text" placeholder="Nama Template" value={templateName} onChange={e => handleNameChange(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 20, padding: '10px 16px', fontSize: '0.875rem', outline: 'none', width: 200, fontFamily: 'inherit' }} />
          <input type="text" value={templateId} readOnly placeholder="ID Template" style={{ border: '1px solid #e5e7eb', borderRadius: 20, padding: '10px 16px', fontSize: '0.875rem', width: 140, background: '#f9fafb', fontFamily: 'inherit' }} />
          <button onClick={handleGenerateName} disabled={!uploadedImage || isGeneratingName} title="Buat Nama dengan AI" style={{ background: 'transparent', border: '1px solid transparent', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (!uploadedImage || isGeneratingName) ? 0.4 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </button>
          <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />
          <button onClick={handleAutoDetect} disabled={!uploadedImage} title="Deteksi Slot (Scan)" style={{ background: 'transparent', border: '1px solid transparent', borderRadius: 20, padding: '0 12px', height: 38, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, opacity: !uploadedImage ? 0.4 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Scan
          </button>
          <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />
          <button onClick={() => { const prev = history.undo(); if (prev) { setSlots(prev); setSelectedSlotIndex(-1); } }} disabled={!history.canUndo} title="Undo (Ctrl+Z)" style={{ background: 'transparent', border: '1px solid transparent', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: !history.canUndo ? 0.4 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>
          <button onClick={() => { const next = history.redo(); if (next) { setSlots(next); setSelectedSlotIndex(-1); } }} disabled={!history.canRedo} title="Redo (Ctrl+Y)" style={{ background: 'transparent', border: '1px solid transparent', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: !history.canRedo ? 0.4 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
          </button>
          <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />
          <button onClick={() => { if (slots.length > 0 || uploadedImage) { if (confirm('Mulai dari awal? Semua perubahan akan hilang.')) window.location.reload(); } else window.location.reload(); }} style={{ background: 'transparent', border: 'none', borderRadius: 20, padding: '10px 16px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>New</button>
          <button onClick={handleSave} disabled={isSaving} style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 20, padding: '10px 24px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Workspace */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '100px 40px 40px' }}>
        {!uploadedImage ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', inset: 0 }}>
            <div
              style={{ background: '#fff', borderRadius: 16, padding: '60px 80px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, border: '2px dashed transparent' }}
              onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#0ea5e9'; }}
              onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
              onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]); }}
            >
              <button onClick={() => document.getElementById('file-input')?.click()} style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 30, padding: '12px 32px', fontSize: '1rem', fontWeight: 500, cursor: 'pointer' }}>Upload Image</button>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>or drop a file</span>
              <input id="file-input" type="file" accept="image/png,image/jpeg" hidden onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', backgroundImage: 'linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0' }}>
            <canvas
              ref={canvasRef}
              width={uploadedImage.width}
              height={uploadedImage.height}
              style={{ display: 'block', width: uploadedImage.width * zoomScale, height: uploadedImage.height * zoomScale }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => setHoveredSlotIndex(-1)}
              tabIndex={0}
            />
            <div style={{ position: 'absolute', background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 4, zIndex: 60, transform: 'translate(-50%, -100%)', marginTop: -10, border: '1px solid #e5e7eb', ...slotToolbarStyle }}>
              <button onClick={handleDeleteSlot} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Zoom controls */}
      <div style={{ position: 'fixed', bottom: 30, right: 30, background: 'white', borderRadius: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', padding: '12px 6px', gap: 8, zIndex: 100, border: '1px solid rgba(0,0,0,0.05)' }}>
        <button onClick={() => handleZoom(0.1)} style={{ background: 'transparent', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem' }}>+</button>
        <span style={{ fontWeight: 600, fontSize: '0.875rem', minWidth: 45, textAlign: 'center', userSelect: 'none' }}>{Math.round(zoomScale * 100)}%</span>
        <button onClick={() => handleZoom(-0.1)} style={{ background: 'transparent', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem' }}>-</button>
      </div>

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.isError ? '#ef4444' : '#111827', color: 'white', padding: '12px 24px', borderRadius: 30, fontSize: '0.875rem', fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
