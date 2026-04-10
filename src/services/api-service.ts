import type { Template } from '../types';
import { API_BASE_URL } from '../constants';

export class ApiService {
  /**
   * Fetches the available photobooth frame templates from the server.
   * @returns A promise that resolves to an array of Template objects.
   */
  public async getTemplates(): Promise<Template[]> {
    const response = await fetch(`${API_BASE_URL}/api/frames`);
    if (!response.ok) throw new Error('[ApiService] Failed to fetch templates');
    return response.json();
  }

  /**
   * Saves a finalized photobooth session consisting of captured raw images, the compiled frame, and video assets.
   * @param images Array of base64-encoded raw image strings.
   * @param gridFrame Base64-encoded string of the final composite image.
   * @param videos Array of individual photo capture video blobs.
   * @param frameType The ID of the template frame used for this session.
   * @param fullVideo The continuous full-session recording blob.
   * @returns A promise that resolves when the session payload is fully synchronized.
   */
  public async saveSession(
    images: string[],
    gridFrame: string,
    videos: Blob[],
    frameType: string,
    fullVideo: Blob
  ): Promise<void> {
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

      const response = await fetch(`${API_BASE_URL}/save`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`[ApiService] Server error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[ApiService] Error saving session:', error);
      throw error;
    }
  }

  /**
   * Uploads a new studio template configuration alongside its overlay image asset.
   * @param config The metadata configuration of the Template excluding the URL parameter.
   * @param imageFile The raw File object representing the overlay frame.
   * @returns A promise that resolves upon successful template upload.
   */
  public async saveTemplate(config: Omit<Template, 'url'>, imageFile: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('config', JSON.stringify(config));

      const response = await fetch(`${API_BASE_URL}/api/templates`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`[ApiService] Server error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[ApiService] Error saving template:', error);
      throw error;
    }
  }
}
