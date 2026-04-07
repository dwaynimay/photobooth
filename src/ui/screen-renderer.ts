import { DomHelper } from './dom-helper';
import { State } from '../core';

export class ScreenRenderer {
  private readonly statusElementId: string = 'app-status';

  public render(state: State): void {
    let message = '';

    switch (state) {
      case State.IDLE:
        message = 'Ready! Press button to start.';
        this.resetView();
        break;
      case State.COUNTDOWN:
        message = 'Get ready...';
        break;
      case State.CAPTURE:
        message = 'Smile!';
        break;
      case State.PREVIEW:
        message = 'Reviewing photos...';
        break;
      case State.RESET:
        message = 'Resetting session...';
        break;
    }

    DomHelper.setText(this.statusElementId, message);
    console.log(`[ScreenRenderer] State: ${state}, Message: ${message}`);
  }

  public updateCountdown(seconds: number): void {
    DomHelper.setText(this.statusElementId, `Capturing in ${seconds}...`);
  }

  public updateStatus(message: string): void {
    DomHelper.setText(this.statusElementId, message);
  }

  public renderPreview(images: string[]): void {
    const container = DomHelper.getElement('preview-container');
    container.innerHTML = '';
    
    images.forEach(imgSrc => {
      const img = document.createElement('img');
      img.src = imgSrc;
      container.appendChild(img);
    });

    DomHelper.hide('video-container-wrap');
    DomHelper.show('preview-container');
  }

  private resetView(): void {
    try {
      const container = DomHelper.getElement('preview-container');
      container.innerHTML = '';
      DomHelper.hide('preview-container');
      DomHelper.show('video-container-wrap');
    } catch (e) {
      // Element might not exist initially
    }
  }
}
