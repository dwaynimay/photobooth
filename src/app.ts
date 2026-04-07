import { StateMachine, State, SessionManager } from './core';
import { CameraService, CaptureService, ApiService } from './services';
import { ScreenRenderer, DomHelper } from './ui';

export class App {
  private stateMachine: StateMachine;
  private sessionManager: SessionManager;
  private cameraService: CameraService;
  private captureService: CaptureService;
  private apiService: ApiService;
  private renderer: ScreenRenderer;

  private readonly VIDEO_ELEMENT_ID = 'camera-feed';
  private readonly TRIGGER_BUTTON_ID = 'start-button';

  constructor() {
    this.stateMachine = new StateMachine();
    this.sessionManager = new SessionManager();
    this.cameraService = new CameraService();
    this.captureService = new CaptureService();
    this.apiService = new ApiService();
    this.renderer = new ScreenRenderer();

    this.init();
  }

  private async init(): Promise<void> {
    console.log('[App] Initializing...');
    
    // Bind state changes to renderer
    this.stateMachine.onStateChange((state) => this.handleStateChange(state));

    try {
      await this.cameraService.initialize(this.VIDEO_ELEMENT_ID);
      this.setupEventListeners();
      this.stateMachine.transition(State.IDLE);
    } catch (error) {
      console.error('[App] Failed to initialize:', error);
    }
  }

  private setupEventListeners(): void {
    const startButton = DomHelper.getElement(this.TRIGGER_BUTTON_ID);
    startButton.addEventListener('click', () => {
      if (this.stateMachine.getState() === State.IDLE) {
        this.startFlow();
      }
    });
  }

  private async handleStateChange(state: State): Promise<void> {
    this.renderer.render(state);

    switch (state) {
      case State.COUNTDOWN:
        await this.runCountdown(3);
        break;
      case State.CAPTURE:
        await this.runCaptureSequence(3);
        break;
      case State.PREVIEW:
        this.renderer.renderPreview(this.sessionManager.getImages());
        await this.saveSession();
        break;
      case State.RESET:
        await this.resetSession();
        break;
    }
  }

  private startFlow(): void {
    this.stateMachine.transition(State.COUNTDOWN);
  }

  private async runCountdown(seconds: number): Promise<void> {
    let current = seconds;
    while (current > 0) {
      this.renderer.updateCountdown(current);
      await this.delay(1000);
      current--;
    }
    this.stateMachine.transition(State.CAPTURE);
  }

  private async runCaptureSequence(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      for (let s = 3; s > 0; s--) {
        this.renderer.updateStatus(`Photo ${i + 1}/${count} in ${s}...`);
        await this.delay(1000);
      }
      
      this.renderer.updateStatus(`📸 JEPRET!`);
      const imageData = this.captureService.captureFrame(this.VIDEO_ELEMENT_ID);
      this.sessionManager.addImage(imageData);
      await this.delay(800); // Wait briefly to show flash message
    }
    this.stateMachine.transition(State.PREVIEW);
  }

  private async saveSession(): Promise<void> {
    const images = this.sessionManager.getImages();
    try {
      await this.apiService.saveImages(images);
      await this.delay(2000); // Let user see "Reviewing" state
      this.stateMachine.transition(State.RESET);
    } catch (error) {
      console.error('[App] Save failed:', error);
      this.stateMachine.transition(State.RESET);
    }
  }

  private async resetSession(): Promise<void> {
    this.sessionManager.reset();
    await this.delay(1000);
    this.stateMachine.transition(State.IDLE);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
