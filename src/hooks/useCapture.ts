import { useState, useRef, useEffect } from 'react';
import type { Template } from '../types';
import { CameraService, CaptureService } from '../services';
import { SessionManager } from '../core/session-manager';

export function useCapture(templates: Template[], selectedLayout: number) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [isCapturing, setIsCapturing] = useState(false);
  const [retakeQuota, setRetakeQuota] = useState(0);
  const [gridFrame, setGridFrame] = useState<string>('');

  // We keep instances in refs to avoid recreating them on every render
  const sessionManagerRef = useRef(new SessionManager());
  const cameraServiceRef = useRef(new CameraService());
  const captureServiceRef = useRef(new CaptureService());

  useEffect(() => {
    cameraServiceRef.current.initialize('camera-feed');
  }, []);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const startCapture = async (onComplete: (defaultFrame: Template | null) => void) => {
    const sessionManager = sessionManagerRef.current;
    const cameraService = cameraServiceRef.current;
    const captureService = captureServiceRef.current;

    setPhotos([]);
    setCurrentPhotoIndex(0);
    sessionManager.reset();

    try {
      cameraService.startFullRecording();
    } catch(e) {}

    for (let i = 0; i < selectedLayout; i++) {
      setCurrentPhotoIndex(i);
      
      try {
        cameraService.startRecording();
      } catch(e) {}
      
      for (let s = 5; s > 0; s--) {
        setCountdown(s);
        await delay(1000);
      }
      
      setIsCapturing(true);
      const imageData = captureService.captureFrame('camera-feed');
      sessionManager.addImage(imageData);
      setPhotos([...sessionManager.getImages()]);
      setIsCapturing(false);

      try {
        const videoBlob = await cameraService.stopRecording();
        sessionManager.addVideo(videoBlob);
      } catch(e) {}
      
      await delay(800);
    }

    try {
      const fullVideoBlob = await cameraService.stopFullRecording();
      sessionManager.setFullVideo(fullVideoBlob);
    } catch(e) {}

    setRetakeQuota(selectedLayout);
    
    const compatible = templates.filter(t => t.slots.length === selectedLayout);
    const defaultFrame = compatible.length > 0 ? compatible[0] : (templates.length > 0 ? templates[0] : null);
    
    onComplete(defaultFrame);
  };

  const executeRetake = async (index: number, onComplete: () => void) => {
    if (retakeQuota <= 0) return;
    const sessionManager = sessionManagerRef.current;
    const cameraService = cameraServiceRef.current;
    const captureService = captureServiceRef.current;

    setRetakeQuota(q => q - 1);
    setCurrentPhotoIndex(index);

    // Start recording for this retake slot
    try { cameraService.startRecording(); } catch (e) { console.error('[retake] startRecording failed:', e); }

    for (let s = 5; s > 0; s--) {
      setCountdown(s);
      await delay(1000);
    }

    setIsCapturing(true);
    const imageData = captureService.captureFrame('camera-feed');
    sessionManager.replaceImage(index, imageData);
    setPhotos([...sessionManager.getImages()]);
    setIsCapturing(false);

    // Stop recording and replace video at the same index
    try {
      const videoBlob = await cameraService.stopRecording();
      sessionManager.replaceVideo(index, videoBlob);
    } catch (e) {
      console.error('[retake] stopRecording failed:', e);
    }

    await delay(800);
    onComplete();
  };

  const applyCurrentFrame = async (selectedFrame: Template | null) => {
    if (!selectedFrame) return;
    const sessionManager = sessionManagerRef.current;
    const captureService = captureServiceRef.current;

    try {
      const gFrame = await captureService.applyTemplate(sessionManager.getImages(), selectedFrame);
      setGridFrame(gFrame);
    } catch (e) {
      console.error('Error applying template', e);
    }
  };

  return {
    photos,
    currentPhotoIndex,
    countdown,
    isCapturing,
    gridFrame,
    retakeQuota,
    startCapture,
    retake: executeRetake,
    applyFrame: applyCurrentFrame,
    sessionManager: sessionManagerRef.current
  };
}
