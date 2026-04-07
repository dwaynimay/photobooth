export class CaptureService {
  public captureFrame(videoElementId: string): string {
    const video = document.getElementById(videoElementId) as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      console.log('[CaptureService] Frame captured.');
      return dataUrl;
    }
    throw new Error('Could not get canvas context.');
  }
}
