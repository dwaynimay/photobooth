import type { Slot } from '../../types';

export type InteractionMode =
  | 'none'
  | 'draw'
  | 'move'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se';

export interface RenderState {
  selectedSlotIndex: number;
  hoveredSlotIndex: number;
  interactionMode: InteractionMode;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  zoomScale: number;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, zoomScale: number): void {
  ctx.fillStyle = getCssVar('--handle-color') || '#ffffff';
  ctx.strokeStyle = getCssVar('--selected-outline') || '#8b5cf6';
  ctx.lineWidth = 1.5 / zoomScale;
  ctx.beginPath();
  ctx.arc(x, y, 5 / zoomScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  slots: Slot[],
  state: RenderState,
): void {
  const { selectedSlotIndex, hoveredSlotIndex, interactionMode, startPos, currentPos, zoomScale } = state;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(image, 0, 0);

  const colorHover = getCssVar('--hover-outline') || '#a78bfa';
  const colorSelected = getCssVar('--selected-outline') || '#8b5cf6';
  const colorPrimary = getCssVar('--primary') || '#0ea5e9';

  slots.forEach((s, i) => {
    const isSelected = i === selectedSlotIndex;
    const isHovered = i === hoveredSlotIndex && !isSelected;

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
    if (ctx.lineWidth > 0) ctx.strokeRect(s.x, s.y, s.w, s.h);

    if (isSelected) {
      drawHandle(ctx, s.x, s.y, zoomScale);
      drawHandle(ctx, s.x + s.w, s.y, zoomScale);
      drawHandle(ctx, s.x, s.y + s.h, zoomScale);
      drawHandle(ctx, s.x + s.w, s.y + s.h, zoomScale);
    }
  });

  if (interactionMode === 'draw') {
    const w = currentPos.x - startPos.x;
    const h = currentPos.y - startPos.y;
    ctx.strokeStyle = colorPrimary;
    ctx.lineWidth = 2 / zoomScale;
    const dashSize = 6 / zoomScale;
    ctx.setLineDash([dashSize, dashSize]);
    ctx.strokeRect(startPos.x, startPos.y, w, h);
    ctx.setLineDash([]);
  }
}
