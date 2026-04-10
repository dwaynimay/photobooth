import type { Slot } from '../types';
import type { InteractionMode } from './slot-interactions';

export function varColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, zoomScale: number): void {
  ctx.fillStyle = varColor('--handle-color');
  ctx.strokeStyle = varColor('--selected-outline');
  ctx.lineWidth = 1.5 / zoomScale;
  ctx.beginPath();
  const radius = 5 / zoomScale;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export interface RenderState {
  slots: Slot[];
  selectedSlotIndex: number;
  hoveredSlotIndex: number;
  interactionMode: InteractionMode;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  zoomScale: number;
  uploadedImage: HTMLImageElement;
}

export function renderCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: RenderState): void {
  if (!state.uploadedImage.src) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.uploadedImage, 0, 0);

  const colorHover = varColor('--hover-outline');
  const colorSelected = varColor('--selected-outline');

  state.slots.forEach((s, i) => {
    const isSelected = (i === state.selectedSlotIndex);
    const isHovered = (i === state.hoveredSlotIndex && !isSelected);

    if (isSelected) {
      ctx.strokeStyle = colorSelected;
      ctx.lineWidth = 2 / state.zoomScale;
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
    } else if (isHovered) {
      ctx.strokeStyle = colorHover;
      ctx.lineWidth = 2 / state.zoomScale;
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
      drawHandle(ctx, s.x, s.y, state.zoomScale);
      drawHandle(ctx, s.x + s.w, s.y, state.zoomScale);
      drawHandle(ctx, s.x, s.y + s.h, state.zoomScale);
      drawHandle(ctx, s.x + s.w, s.y + s.h, state.zoomScale);
    }
  });

  if (state.interactionMode === 'draw') {
    const w = state.currentX - state.startX;
    const h = state.currentY - state.startY;
    ctx.strokeStyle = varColor('--primary');
    ctx.lineWidth = 2 / state.zoomScale;
    const dashSize = 6 / state.zoomScale;
    ctx.setLineDash([dashSize, dashSize]);
    ctx.strokeRect(state.startX, state.startY, w, h);
    ctx.setLineDash([]);
  }
}
