import type { Slot } from '../types';

export type InteractionMode = 'none' | 'draw' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

export function getMousePos(e: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

export function checkHandleHit(x: number, y: number, slot: Slot, zoomScale: number): InteractionMode | null {
  const hitRadius = 12 / zoomScale;
  const dist = (px: number, py: number, hx: number, hy: number) =>
    Math.sqrt(Math.pow(px - hx, 2) + Math.pow(py - hy, 2));

  if (dist(x, y, slot.x, slot.y) <= hitRadius) return 'resize-nw';
  if (dist(x, y, slot.x + slot.w, slot.y) <= hitRadius) return 'resize-ne';
  if (dist(x, y, slot.x, slot.y + slot.h) <= hitRadius) return 'resize-sw';
  if (dist(x, y, slot.x + slot.w, slot.y + slot.h) <= hitRadius) return 'resize-se';
  return null;
}

export function checkSlotHit(x: number, y: number, slots: Slot[]): number {
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      return i;
    }
  }
  return -1;
}

export function resolveResize(mode: InteractionMode, slot: Slot, state: Slot, currentX: number, currentY: number): void {
    if (mode === 'resize-nw') {
      slot.w = Math.round(state.w + (state.x - currentX));
      slot.h = Math.round(state.h + (state.y - currentY));
      slot.x = Math.round(currentX);
      slot.y = Math.round(currentY);
    } else if (mode === 'resize-ne') {
      slot.w = Math.round(currentX - state.x);
      slot.h = Math.round(state.h + (state.y - currentY));
      slot.y = Math.round(currentY);
    } else if (mode === 'resize-sw') {
      slot.w = Math.round(state.w + (state.x - currentX));
      slot.h = Math.round(currentY - state.y);
      slot.x = Math.round(currentX);
    } else if (mode === 'resize-se') {
      slot.w = Math.round(currentX - state.x);
      slot.h = Math.round(currentY - state.y);
    }
    if (slot.w < 10) slot.w = 10;
    if (slot.h < 10) slot.h = 10;
}
