export class SessionManager {
  private images: string[] = [];
  private videos: Blob[] = [];
  private fullVideo: Blob | null = null;

  public addImage(dataUrl: string): void {
    this.images.push(dataUrl);
    console.log(`[SessionManager] Image added. Current count: ${this.images.length}`);
  }

  public getImages(): string[] {
    return this.images;
  }

  public addVideo(blob: Blob): void {
    this.videos.push(blob);
    console.log(`[SessionManager] Video added. Current count: ${this.videos.length}`);
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

  public reset(): void {
    this.images = [];
    this.videos = [];
    this.fullVideo = null;
    console.log('[SessionManager] Session reset.');
  }
}

