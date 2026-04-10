import type { Template } from '../types';

export class CaptureService {
  public captureFrame(videoElementId: string): string {
    const video = document.getElementById(videoElementId) as HTMLVideoElement;
    if (!video) throw new Error('Source video not found.');
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Context error');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    if (import.meta.env.DEV) console.log('[CaptureService] Raw frame captured directly.');
    return dataUrl;
  }

  // TODO: `generateGridFrame` is a legacy layout generator.
  // It should be deprecated in favor of `applyTemplate`, or updated to align with the new Template data structures.
  public generateGridFrame(base64Images: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));

      const imgWidth = 600;
      const imgHeight = 400;
      const padding = 40;
      const topPadding = 120;
      const bottomPadding = 120;
      
      canvas.width = imgWidth + (padding * 2);
      canvas.height = topPadding + (imgHeight * 3) + (padding * 2) + bottomPadding;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let loadedCount = 0;

      if (base64Images.length === 0) {
          return resolve(canvas.toDataURL('image/jpeg', 1.0));
      }

      for (let i = 0; i < base64Images.length; i++) {
        const img = new Image();
        img.onload = () => {
          let sWidth = img.naturalWidth;
          let sHeight = img.naturalHeight;
           
          const targetRatio = imgWidth / imgHeight;
          const srcRatio = sWidth / sHeight;
          let sx = 0;
          let sy = 0;
          
          if (srcRatio > targetRatio) {
            sWidth = sHeight * targetRatio;
            sx = (img.naturalWidth - sWidth) / 2;
          } else {
            sHeight = sWidth / targetRatio;
            sy = (img.naturalHeight - sHeight) / 2;
          }

          const yPos = topPadding + (i * (imgHeight + padding));
          ctx.drawImage(img, sx, sy, sWidth, sHeight, padding, yPos, imgWidth, imgHeight);
          
          loadedCount++;
          if (loadedCount === base64Images.length) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 48px Arial';
            ctx.fillText('✨ PHOTOBOOTH ✨', canvas.width / 2, 80);
            resolve(canvas.toDataURL('image/jpeg', 1.0));
          }
        };
        img.onerror = () => reject(new Error('Failed to load image for legacy grid'));
        img.src = base64Images[i];
      }
    });
  }

  public applyTemplate(base64Images: string[], template: Template): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = template.width;
      canvas.height = template.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let loadedCount = 0;
      
      const finishRender = () => {
         const overlayImg = new Image();
         overlayImg.crossOrigin = 'Anonymous';
         overlayImg.onload = () => {
             ctx.drawImage(overlayImg, 0, 0, template.width, template.height);
             resolve(canvas.toDataURL('image/jpeg', 1.0));
         };
         overlayImg.onerror = () => {
             resolve(canvas.toDataURL('image/jpeg', 1.0));
         };
         overlayImg.src = `http://localhost:3000/templates/${template.image}`;
      };

      if (template.slots.length === 0) {
          finishRender();
          return;
      }

      for (let i = 0; i < template.slots.length; i++) {
        if (!base64Images[i]) {
            loadedCount++;
            if (loadedCount === template.slots.length) finishRender();
            continue;
        }
        const img = new Image();
        img.onload = () => {
          let sWidth = img.naturalWidth;
          let sHeight = img.naturalHeight;
           
          const slot = template.slots[i];
          const targetRatio = slot.w / slot.h;
          const srcRatio = sWidth / sHeight;
          let sx = 0;
          let sy = 0;
          
          if (srcRatio > targetRatio) {
            sWidth = sHeight * targetRatio;
            sx = (img.naturalWidth - sWidth) / 2;
          } else {
            sHeight = sWidth / targetRatio;
            sy = (img.naturalHeight - sHeight) / 2;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, slot.x, slot.y, slot.w, slot.h);
          
          loadedCount++;
          if (loadedCount === template.slots.length) {
            finishRender();
          }
        };
        img.onerror = () => reject(new Error('Failed to load image for slot'));
        img.src = base64Images[i];
      }
    });
  }
}
