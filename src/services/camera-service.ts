export class CameraService {
  private stream: MediaStream | null = null;

  public async initialize(videoElementId: string): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });

      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = this.stream;
        videoElement.play();
        console.log('[CameraService] Device initialized.');
      } else {
        throw new Error(`Video element with id ${videoElementId} not found.`);
      }
    } catch (error) {
      console.error('[CameraService] Error initialization:', error);
      throw error;
    }
  }

  public stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      console.log('[CameraService] Device stopped.');
    }
  }
}
