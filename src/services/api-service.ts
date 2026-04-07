export class ApiService {
  private readonly BASE_URL = 'http://localhost:3000'; // Target backend location

  public async saveSession(images: string[], gridFrame: string, videos: Blob[], frameType: string, fullVideo: Blob): Promise<void> {
    try {
      const formData = new FormData();
      
      images.forEach((imgString) => {
        formData.append('images', imgString);
      });
      formData.append('gridFrame', gridFrame);
      formData.append('frameType', frameType);

      videos.forEach((vid, i) => {
        formData.append('videos', vid, `video_${i+1}.webm`);
      });

      if (fullVideo) {
        formData.append('fullVideo', fullVideo, 'raw_video.webm');
      }

      const response = await fetch(`${this.BASE_URL}/save`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`[ApiService] Server error: ${response.statusText}`);
      }
      console.log('[ApiService] Session saved successfully.');
    } catch (error) {
      console.error('[ApiService] Error saving session:', error);
      throw error;
    }
  }
}
