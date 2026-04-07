export class ApiService {
  private readonly BASE_URL = 'http://localhost:3000'; // Target backend location

  public async saveImages(images: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.BASE_URL}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) {
        throw new Error(`[ApiService] Server error: ${response.statusText}`);
      }
      console.log('[ApiService] Images saved successfully.');
    } catch (error) {
      console.error('[ApiService] Error saving images:', error);
      throw error;
    }
  }
}
