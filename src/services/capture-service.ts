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
    console.log('[CaptureService] Raw frame captured directly.');
    return dataUrl;
  }

  public generateGridFrame(base64Images: string[], frameType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');

      const imgWidth = 600;
      const imgHeight = 400;
      const padding = 40;
      const topPadding = 120;
      const bottomPadding = 120;
      
      canvas.width = imgWidth + (padding * 2);
      canvas.height = topPadding + (imgHeight * 3) + (padding * 2) + bottomPadding;

      ctx.fillStyle = frameType === 'black-elegant' ? '#000000' : (frameType === 'polaroid' ? '#FFFFFF' : '#222222');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let loadedCount = 0;

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
            if (frameType === 'black-elegant') {
              ctx.fillStyle = '#D4AF37';
              ctx.font = 'bold 48px Arial';
              ctx.fillText('ELEGANT', canvas.width / 2, 80);
            } else {
              ctx.fillStyle = frameType === 'polaroid' ? '#000000' : '#FFFFFF';
              ctx.font = 'bold 48px Arial';
              ctx.fillText('✨ PHOTOBOOTH ✨', canvas.width / 2, 80);
            }
            resolve(canvas.toDataURL('image/jpeg', 1.0));
          }
        };
        img.onerror = reject;
        img.src = base64Images[i];
      }
    });
  }
}
