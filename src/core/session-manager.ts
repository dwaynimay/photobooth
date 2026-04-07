export class SessionManager {
  private images: string[] = [];

  public addImage(dataUrl: string): void {
    this.images.push(dataUrl);
    console.log(`[SessionManager] Image added. Current count: ${this.images.length}`);
  }

  public getImages(): string[] {
    return this.images;
  }

  public reset(): void {
    this.images = [];
    console.log('[SessionManager] Session reset.');
  }
}
