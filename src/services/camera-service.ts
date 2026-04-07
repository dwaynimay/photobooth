export class CameraService {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private fullMediaRecorder: MediaRecorder | null = null;
  private fullRecordedChunks: Blob[] = [];
  private animationFrameId: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;

  public async initialize(videoElementId: string): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });

      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      const canvasElement = document.getElementById('composited-canvas') as HTMLCanvasElement;
      
      if (videoElement && canvasElement) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.canvasCtx = canvasElement.getContext('2d');

        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
        
        this.startCompositingLoop();
        console.log('[CameraService] Device initialized and compositing started.');
      } else {
        throw new Error(`Video or Canvas element not found.`);
      }
    } catch (error) {
      console.error('[CameraService] Error initialization:', error);
      throw error;
    }
  }

  private startCompositingLoop(): void {
    if (!this.videoElement || !this.canvasElement || !this.canvasCtx) return;

    const drawFrame = () => {
      if (this.videoElement && !this.videoElement.paused && !this.videoElement.ended) {
        const { width, height } = this.canvasElement!;
        const ctx = this.canvasCtx!;

        // Draw the raw camera feed
        ctx.drawImage(this.videoElement, 0, 0, width, height);
      }
      this.animationFrameId = requestAnimationFrame(drawFrame);
    };

    this.animationFrameId = requestAnimationFrame(drawFrame);
  }

  public startRecording(): void {
    if (!this.stream) throw new Error('No stream available to record.');

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    console.log('[CameraService] Started recording raw stream...');
  }

  public stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return reject(new Error('MediaRecorder is not initialized or active.'));
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        console.log('[CameraService] Stopped recording.');
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public startFullRecording(): void {
    if (!this.stream) throw new Error('No stream available to record.');

    this.fullRecordedChunks = [];
    this.fullMediaRecorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });

    this.fullMediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.fullRecordedChunks.push(event.data);
      }
    };

    this.fullMediaRecorder.start();
    console.log('[CameraService] Started full session recording...');
  }

  public stopFullRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.fullMediaRecorder || this.fullMediaRecorder.state === 'inactive') {
        return reject(new Error('Full MediaRecorder is not initialized or active.'));
      }

      this.fullMediaRecorder.onstop = () => {
        const blob = new Blob(this.fullRecordedChunks, { type: 'video/webm' });
        console.log('[CameraService] Stopped full session recording.');
        resolve(blob);
      };

      this.fullMediaRecorder.stop();
    });
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      console.log('[CameraService] Device stopped.');
    }
  }
}
