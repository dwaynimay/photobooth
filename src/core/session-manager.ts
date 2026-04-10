import type { SessionState } from '../types';

export class SessionManager {
  private images: string[] = [];
  private videos: Blob[] = [];
  private fullVideo: Blob | null = null;

  private debug(msg: string): void {
    if (import.meta.env.DEV) {
      console.log(msg);
    }
  }

  public addImage(dataUrl: string): void {
    this.images.push(dataUrl);
    this.debug(`[SessionManager] Image added. Current count: ${this.images.length}`);
  }

  public replaceImage(index: number, base64: string): void {
    if (index >= 0 && index < this.images.length) {
      this.images[index] = base64;
    }
  }

  public replaceVideo(index: number, blob: Blob): void {
    if (index >= 0 && index < this.videos.length) {
      this.videos[index] = blob;
    }
  }

  public getImages(): string[] {
    return this.images;
  }

  public addVideo(blob: Blob): void {
    this.videos.push(blob);
    this.debug(`[SessionManager] Video added. Current count: ${this.videos.length}`);
  }

  public getVideos(): Blob[] {
    return this.videos;
  }

  public setFullVideo(blob: Blob): void {
    this.fullVideo = blob;
  }

  public getFullVideo(): Blob | null {
    return this.fullVideo;
  }

  public getState(): SessionState {
    return {
      images: [...this.images],
      videos: [...this.videos],
      fullVideo: this.fullVideo,
    };
  }

  public reset(): void {
    this.images = [];
    this.videos = [];
    this.fullVideo = null;
    this.debug('[SessionManager] Session reset.');
  }
}
