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

  private templates: any[] = [];
  private selectedTemplate: any = null;
  private gridFrame: string = '';
  private frameType: string = '';
  
  private currentTimeoutMs: number = 0;
  private currentTimeout: any = null;
  private targetPhotoCount: number = 3;
  private retakeQuota: number = 0;

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
    this.stateMachine.onStateChange((state) => this.handleStateChange(state));

    try {
      this.templates = await this.apiService.getTemplates();
      await this.cameraService.initialize(this.VIDEO_ELEMENT_ID);
      this.setupEventListeners();
      this.stateMachine.transition(State.IDLE);
    } catch (error) {
      console.error('[App] Failed to initialize:', error);
      this.renderer.updateStatus('Kamera gagal diakses.');
    }
  }

  private setupEventListeners(): void {
    // Global touch starts sequence overriding Idle
    document.addEventListener('click', (e) => {
       if (this.stateMachine.getState() === State.IDLE) {
          const target = e.target as HTMLElement;
          // Avoid triggering if they click a button meant for Admin (just in case they somehow share context, but safely it's IDLE anyway)
          this.stateMachine.transition(State.SELECT_LAYOUT);
       }
    });

    const btnMockPayment = DomHelper.getElement('btn-mock-payment');
    btnMockPayment.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.stateMachine.getState() === State.PAYMENT) {
        this.clearCurrentTimeout();
        this.stateMachine.transition(State.CAPTURE);
      }
    });

    const btnFinishPrint = DomHelper.getElement('btn-finish-print');
    btnFinishPrint.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.stateMachine.getState() === State.PREVIEW_STUDIO) {
        this.clearCurrentTimeout();
        this.saveSession();
      }
    });

    const btnDone = DomHelper.getElement('btn-done');
    btnDone.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.stateMachine.getState() === State.FINISH) {
        this.clearCurrentTimeout();
        this.resetSession();
      }
    });
  }

  private startTimeout(seconds: number, callback: () => void): void {
    this.clearCurrentTimeout();
    this.currentTimeoutMs = seconds * 1000;
    this.currentTimeout = setTimeout(() => {
       console.log(`[App] Timeout reached (${seconds}s).`);
       callback();
    }, this.currentTimeoutMs);
  }

  private clearCurrentTimeout(): void {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  private async handleStateChange(state: State): Promise<void> {
    this.renderer.render(state);

    switch (state) {
      case State.IDLE:
        this.clearCurrentTimeout(); // Wait indefinitely
        break;
      case State.SELECT_LAYOUT:
        this.populateLayouts();
        this.startTimeout(60, () => this.stateMachine.transition(State.IDLE));
        break;
      case State.PAYMENT:
        this.startTimeout(180, () => this.stateMachine.transition(State.IDLE));
        break;
      case State.CAPTURE:
        this.clearCurrentTimeout();
        await this.runCaptureSequence();
        break;
      case State.PREVIEW_STUDIO:
        this.setupStudioPreview();
        this.startTimeout(300, () => {
             this.renderer.updateStatus('Auto-saving due to timeout...');
             this.saveSession();
        });
        break;
      case State.FINISH:
        this.startTimeout(60, () => this.resetSession());
        break;
    }
  }
  
  private populateLayouts(): void {
    const container = DomHelper.getElement('layout-options');
    container.innerHTML = '';
    
    // Extract unique photo counts from available templates
    const availableCounts = Array.from(new Set(this.templates.map(t => t.slots.length))).sort((a, b) => a - b);
    
    availableCounts.forEach(count => {
      const btn = document.createElement('button');
      btn.innerText = `${count} Photos`;
      btn.addEventListener('click', (e) => {
         e.stopPropagation();
         if (this.stateMachine.getState() !== State.SELECT_LAYOUT) return;
         
         this.targetPhotoCount = count;
         
         // Pre-select a default frame of that size for the preview phase
         const defaultTemp = this.templates.find(t => t.slots.length === count);
         if (defaultTemp) {
            this.selectedTemplate = defaultTemp;
            this.frameType = defaultTemp.id;
         }
         
         this.clearCurrentTimeout();
         this.stateMachine.transition(State.PAYMENT);
      });
      container.appendChild(btn);
    });
  }

  private async runCaptureSequence(): Promise<void> {
    try {
      this.cameraService.startFullRecording();
    } catch(e) {
      console.error('[App] Failed to start full recording', e);
    }

    for (let i = 0; i < this.targetPhotoCount; i++) {
        await this.captureSinglePhoto(i + 1, this.targetPhotoCount);
    }

    try {
      const fullVideoBlob = await this.cameraService.stopFullRecording();
      this.sessionManager.setFullVideo(fullVideoBlob);
    } catch(e) {
      console.error('[App] Failed to stop full recording', e);
    }
    
    this.retakeQuota = this.targetPhotoCount;
    this.renderer.updateStatus('Applying template mapping...');
    try {
      this.gridFrame = await this.captureService.applyTemplate(this.sessionManager.getImages(), this.selectedTemplate);
    } catch (e) {
      console.error('[App] Error saving dynamic canvas:', e);
    }
    this.stateMachine.transition(State.PREVIEW_STUDIO);
  }

  private async captureSinglePhoto(currentPhotoIndex: number, totalPhotos: number): Promise<void> {
      try {
        this.cameraService.startRecording();
      } catch(e) {
        console.error('[App] Failed to start recording', e);
      }
      
      for (let s = 5; s > 0; s--) {
        this.renderer.updateStatus(`Photo ${currentPhotoIndex}/${totalPhotos} in ${s}...`);
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
      
      await this.delay(800); // flash buffer read gap time
  }

  private setupStudioPreview(): void {
     const framesContainer = DomHelper.getElement('studio-frame-options');
     framesContainer.innerHTML = '';
     
     // Only display layouts valid for the selected slot count
     const compatibleTemplates = this.templates.filter(t => t.slots.length === this.targetPhotoCount);
     
     compatibleTemplates.forEach(t => {
        const btn = document.createElement('button');
        btn.innerText = t.name;
        btn.addEventListener('click', async (e) => {
           e.stopPropagation();
           this.selectedTemplate = t;
           this.frameType = t.id;
           this.renderer.updateStatus('Switching framework...');
           this.gridFrame = await this.captureService.applyTemplate(this.sessionManager.getImages(), this.selectedTemplate);
           this.refreshStudioView();
        });
        framesContainer.appendChild(btn);
     });
     
     this.refreshStudioView();
  }

  private refreshStudioView(): void {
     const mainContainer = DomHelper.getElement('main-preview');
     mainContainer.innerHTML = `<img src="${this.gridFrame}" style="max-height:50vh; width:auto; border:2px solid #ccc; border-radius:8px;" />`;
     
     DomHelper.setText('retake-quota-label', `Remaining Retake Quota: ${this.retakeQuota}`);
     
     const rawContainer = DomHelper.getElement('raw-photos-list');
     rawContainer.innerHTML = '';
     
     const images = this.sessionManager.getImages();
     images.forEach((imgSrc, idx) => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = '100px';
        
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.width = '100%';
        img.style.borderRadius = '4px';
        img.style.border = '1px solid #999';
        
        const btn = document.createElement('button');
        btn.innerText = 'Retake';
        btn.style.marginTop = '5px';
        btn.disabled = this.retakeQuota <= 0;
        
        btn.addEventListener('click', async (e) => {
           e.stopPropagation();
           if (this.retakeQuota > 0) {
              await this.executeRetake(idx);
           }
        });
        
        wrapper.appendChild(img);
        wrapper.appendChild(btn);
        rawContainer.appendChild(wrapper);
     });
  }

  private async executeRetake(index: number): Promise<void> {
      this.clearCurrentTimeout(); 
      this.retakeQuota--;
      
      DomHelper.hide('preview-studio-screen');
      DomHelper.show('video-container-wrap');
      
      for (let s = 5; s > 0; s--) {
        this.renderer.updateStatus(`Retaking Photo ${index + 1} in ${s}...`);
        await this.delay(1000);
      }
      
      this.renderer.updateStatus(`📸 JEPRET!`);
      const imageData = this.captureService.captureFrame(this.VIDEO_ELEMENT_ID);
      
      this.sessionManager.replaceImage(index, imageData);
      await this.delay(800);
      
      this.renderer.updateStatus('Applying template...');
      this.gridFrame = await this.captureService.applyTemplate(this.sessionManager.getImages(), this.selectedTemplate);
      
      DomHelper.hide('video-container-wrap');
      DomHelper.show('preview-studio-screen');
      this.refreshStudioView();
      
      this.startTimeout(300, () => this.saveSession());
  }

  private async saveSession(): Promise<void> {
    this.stateMachine.transition(State.FINISH);
    this.renderer.updateStatus('Uploading to remote node...');
    const images = this.sessionManager.getImages();
    const videos = this.sessionManager.getVideos();
    const fullVideo = this.sessionManager.getFullVideo();
    try {
      if (videos.length > 0 && this.gridFrame && this.frameType && fullVideo) {
        await this.apiService.saveSession(images, this.gridFrame, videos, this.frameType, fullVideo);
      }
      this.renderer.updateStatus('Done print!');
    } catch (error) {
      console.error('[App] Save failed:', error);
      this.renderer.updateStatus('Network failure during prints.');
    }
  }

  private resetSession(): void {
    this.sessionManager.reset();
    this.stateMachine.transition(State.IDLE);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
