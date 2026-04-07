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

  private templates: any[] = [];
  private selectedTemplate: any = null;
  private gridFrame: string = '';
  private frameType: string = '';

  private async init(): Promise<void> {
    console.log('[App] Initializing...');
    
    // Bind state changes to renderer
    this.stateMachine.onStateChange((state) => this.handleStateChange(state));

    try {
      this.templates = await this.apiService.getTemplates();
      this.setupDynamicUI();
      
      await this.cameraService.initialize(this.VIDEO_ELEMENT_ID);
      this.setupEventListeners();
      this.stateMachine.transition(State.IDLE);
    } catch (error) {
      console.error('[App] Failed to initialize:', error);
      this.renderer.updateStatus('Kamera gagal diakses.');
    }
  }

  private setupDynamicUI(): void {
    const container = document.querySelector('.frame-options');
    if (container) {
      container.innerHTML = '';
      this.templates.forEach(t => {
        const btn = document.createElement('button');
        btn.dataset.frame = t.id;
        btn.innerText = t.name;
        btn.addEventListener('click', () => {
           if (this.stateMachine.getState() !== State.FRAME_SELECT) return;
           this.selectedTemplate = t;
           this.handleFrameSelect(t.id);
        });
        container.appendChild(btn);
      });
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
        await this.runCaptureSequence();
        break;
      case State.FRAME_SELECT:
        // Wait for user interaction
        break;
      case State.PREVIEW:
        this.renderer.renderPreview([this.gridFrame]);
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

  private async handleFrameSelect(frameType: string): Promise<void> {
    this.frameType = frameType;
    this.renderer.updateStatus('Applying template...');
    const images = this.sessionManager.getImages();
    try {
      this.gridFrame = await this.captureService.applyTemplate(images, this.selectedTemplate);
    } catch (e) {
      console.error('[App] Error saving dynamic canvas:', e);
    }

    this.stateMachine.transition(State.PREVIEW);
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

  private async runCaptureSequence(): Promise<void> {
    try {
      this.cameraService.startFullRecording();
    } catch(e) {
      console.error('[App] Failed to start full recording', e);
    }

    const count = 3;

    for (let i = 0; i < count; i++) {
      try {
        this.cameraService.startRecording();
      } catch(e) {
        console.error('[App] Failed to start recording', e);
      }
      
      for (let s = 3; s > 0; s--) {
        this.renderer.updateStatus(`Photo ${i + 1}/${count} in ${s}...`);
        await this.delay(1000);
      }
      
      this.renderer.updateStatus(`📸 JEPRET!`);
      const imageData = this.captureService.captureFrame(this.VIDEO_ELEMENT_ID);
      this.sessionManager.addImage(imageData);

      try {
        const videoBlob = await this.cameraService.stopRecording();
        this.sessionManager.addVideo(videoBlob);
      } catch(e) {
        console.error('[App] Failed to stop recording', e);
      }
      
      await this.delay(800); // Wait briefly to show flash message
    }

    try {
      const fullVideoBlob = await this.cameraService.stopFullRecording();
      this.sessionManager.setFullVideo(fullVideoBlob);
    } catch(e) {
      console.error('[App] Failed to stop full recording', e);
    }

    this.stateMachine.transition(State.FRAME_SELECT);
  }

  private async saveSession(): Promise<void> {
    const images = this.sessionManager.getImages();
    const videos = this.sessionManager.getVideos();
    const fullVideo = this.sessionManager.getFullVideo();
    try {
      if (videos.length > 0 && this.gridFrame && this.frameType && fullVideo) {
        await this.apiService.saveSession(images, this.gridFrame, videos, this.frameType, fullVideo);
      }
      await this.delay(2000); 
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
