import { useState, useEffect, useRef } from 'react';
import type { AppStep, Template } from '../types';
import { useTemplates } from '../hooks/useTemplates';
import { useCapture } from '../hooks/useCapture';
import { ApiService } from '../services/api-service';
import { StateMachine } from '../core/state-machine';

import {
  HomeScreen,
  LayoutScreen,
  PaymentScreen,
  CaptureScreen,
  ReviewScreen,
  PrintScreen
} from './screens';

const apiService = new ApiService();

export default function App() {
  const [step, setStep] = useState<AppStep>('HOME');
  const [selectedLayout, setSelectedLayout] = useState(3);
  const [printQuantity, setPrintQuantity] = useState(2);
  const [selectedFrame, setSelectedFrame] = useState<Template | null>(null);

  const machineRef = useRef(new StateMachine());
  const machine = machineRef.current;
  
  useEffect(() => {
    machine.onStateChange(setStep);
  }, [machine]);

  const { templates, availableLayouts } = useTemplates();
  const capture = useCapture(templates, selectedLayout);

  const handleStartCapture = () => {
    machine.transition('CAPTURE');
    capture.startCapture((defaultFrame) => {
      setSelectedFrame(defaultFrame);
      machine.transition('APPLY_FRAME');
    });
  };

  useEffect(() => {
    if (step === 'APPLY_FRAME') {
      capture.applyFrame(selectedFrame).then(() => machine.transition('REVIEW'));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const isApplyingFrame = step === 'APPLY_FRAME';

  return (
    <>
      {/* Camera and canvas must ALWAYS be in the DOM so the stream stays alive and captureFrame() works */}
      <video
        id="camera-feed"
        autoPlay
        playsInline
        muted
        className={(step === 'CAPTURE' || step === 'CAPTURE_RETAKE') ? 'fixed inset-0 w-full h-full object-cover z-0' : ''}
        style={(step === 'CAPTURE' || step === 'CAPTURE_RETAKE') ? {} : { position: 'fixed', top: '-9999px', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <canvas id="composited-canvas" width="1280" height="720" style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 1, height: 1 }} />

      {/* Rendering overlay — shown on top without unmounting anything */}
      {isApplyingFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 text-white">
          <h2 className="text-3xl animate-pulse">Rendering...</h2>
        </div>
      )}

      <div className="relative z-10">
        {step === 'HOME' && <HomeScreen onNext={() => machine.transition('LAYOUT')} />}

        {step === 'LAYOUT' && (
          <LayoutScreen
            availableLayouts={availableLayouts} selectedLayout={selectedLayout} printQuantity={printQuantity}
            setSelectedLayout={setSelectedLayout} setPrintQuantity={setPrintQuantity}
            onNext={() => machine.transition('PAYMENT')}
          />
        )}

        {step === 'PAYMENT' && <PaymentScreen onCancel={() => machine.transition('LAYOUT')} onSuccess={handleStartCapture} />}

        {(step === 'CAPTURE' || step === 'CAPTURE_RETAKE') && (
          <CaptureScreen
            currentPhotoIndex={capture.currentPhotoIndex} selectedLayout={selectedLayout}
            countdown={capture.countdown} isCapturing={capture.isCapturing}
          />
        )}

        {step === 'REVIEW' && (
          <ReviewScreen
            photos={capture.photos} templates={templates} selectedTemplate={selectedFrame} selectedLayout={selectedLayout}
            gridFrame={capture.gridFrame} retakeQuota={capture.retakeQuota}
            onSelectTemplate={(t) => { setSelectedFrame(t); machine.transition('APPLY_FRAME'); }}
            onRetakeAll={handleStartCapture}
            onRetakeSingle={(idx) => { machine.transition('CAPTURE_RETAKE'); capture.retake(idx, () => machine.transition('APPLY_FRAME')); }}
            onPrint={async () => {
              machine.transition('PRINT');
              await apiService.saveSession(capture.sessionManager.getImages(), capture.gridFrame, capture.sessionManager.getVideos(), selectedFrame?.id || '', capture.sessionManager.getFullVideo() || new Blob());
            }}
          />
        )}

        {step === 'PRINT' && <PrintScreen printQuantity={printQuantity} gridFrame={capture.gridFrame} onReset={() => { capture.sessionManager.reset(); machine.transition('HOME'); }} />}
      </div>
    </>
  );
}
