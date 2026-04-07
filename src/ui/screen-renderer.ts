import { State } from '../core';
import { DomHelper } from './dom-helper';

export class ScreenRenderer {
  private readonly statusElementId: string = 'app-status';

  public render(state: State): void {
    let message = '';
    
    DomHelper.hide('layout-select-screen');
    DomHelper.hide('payment-screen');
    DomHelper.hide('preview-studio-screen');
    DomHelper.hide('finish-screen');
    DomHelper.hide('video-container-wrap');

    switch (state) {
      case State.IDLE:
        DomHelper.show('ui-overlay');
        message = 'Tap anywhere to start!';
        break;
      case State.SELECT_LAYOUT:
        DomHelper.show('layout-select-screen');
        DomHelper.show('ui-overlay');
        message = 'Please select a layout (Timeout: 60s)';
        break;
      case State.PAYMENT:
        DomHelper.show('payment-screen');
        DomHelper.show('ui-overlay');
        message = 'Awaiting payment...';
        break;
      case State.CAPTURE:
        DomHelper.show('video-container-wrap');
        DomHelper.show('ui-overlay');
        message = 'Get ready!';
        break;
      case State.PREVIEW_STUDIO:
        DomHelper.show('preview-studio-screen');
        DomHelper.show('ui-overlay');
        message = 'Studio Dashboard';
        break;
      case State.FINISH:
        DomHelper.show('finish-screen');
        DomHelper.show('ui-overlay');
        message = 'Thank you!';
        break;
    }

    DomHelper.setText(this.statusElementId, message);
  }

  public updateCountdown(seconds: number): void {
    DomHelper.setText(this.statusElementId, `Capturing in ${seconds}...`);
  }

  public updateStatus(message: string): void {
    DomHelper.setText(this.statusElementId, message);
  }

  // Backwards compatibility for older methods calling this directly
  public renderPreview(images: string[]): void {
    console.warn('[ScreenRenderer] Legacy renderPreview called');
  }
}
