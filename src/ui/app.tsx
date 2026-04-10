import { useState, useEffect } from 'react';
import { ChevronRight, Minus, Plus, RefreshCcw, QrCode, Printer, Check, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { SessionManager } from '../core';
import { CameraService, CaptureService, ApiService } from '../services';

const THEME_ACCENT = 'bg-red-600 text-white';
const THEME_BG = 'bg-[#fcfcfc]';
const THEME_TEXT = 'text-gray-900';

const sessionManager = new SessionManager();
const cameraService = new CameraService();
const captureService = new CaptureService();
const apiService = new ApiService();

export default function App() {
  const [step, setStep] = useState('HOME'); // HOME, LAYOUT, PAYMENT, CAPTURE, REVIEW, PRINT
  
  // Layout State
  const [templates, setTemplates] = useState<any[]>([]);
  const [availableLayouts, setAvailableLayouts] = useState<number[]>([]);
  const [selectedLayout, setSelectedLayout] = useState(3);
  const [printQuantity, setPrintQuantity] = useState(2);
  
  // Capture State
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [isCapturing, setIsCapturing] = useState(false);
  const [appStatus, setAppStatus] = useState('');
  
  // Review State
  const [selectedFrame, setSelectedFrame] = useState<any>(null);
  const [retakeQuota, setRetakeQuota] = useState(0);
  const [gridFrame, setGridFrame] = useState<string>('');

  useEffect(() => {
    async function init() {
      try {
        const tpls = await apiService.getTemplates();
        setTemplates(tpls);
        const counts = Array.from(new Set(tpls.map(t => t.slots.length))).sort((a, b) => a - b);
        setAvailableLayouts(counts);
        if (counts.length > 0) {
          setSelectedLayout(counts[counts.length - 1]);
        }
        await cameraService.initialize('camera-feed');
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    }
    init();
  }, []);

  const resetApp = () => {
    setStep('HOME');
    setPhotos([]);
    setCurrentPhotoIndex(0);
    setPrintQuantity(2);
    sessionManager.reset();
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const startCaptureSequence = async () => {
    setStep('CAPTURE');
    setPhotos([]);
    setCurrentPhotoIndex(0);
    sessionManager.reset(); // clear old ones

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
    
    // Choose default frame
    const compatible = templates.filter(t => t.slots.length === selectedLayout);
    if (compatible.length > 0) {
      setSelectedFrame(compatible[0]);
    } else {
      setSelectedFrame(templates[0]);
    }
    
    setStep('APPLY_FRAME');
  };

  useEffect(() => {
    if (step === 'APPLY_FRAME') {
      applyCurrentFrame();
    }
  }, [step, selectedFrame]);

  const applyCurrentFrame = async () => {
    if (!selectedFrame) {
      setStep('REVIEW');
      return;
    }
    setAppStatus('Applying template...');
    try {
      const gFrame = await captureService.applyTemplate(sessionManager.getImages(), selectedFrame);
      setGridFrame(gFrame);
    } catch (e) {
      console.error('Error applying template', e);
    }
    setAppStatus('');
    setStep('REVIEW');
  };

  const executeRetake = async (index: number) => {
    if (retakeQuota <= 0) return;
    setRetakeQuota(q => q - 1);
    setStep('CAPTURE_RETAKE');
    setCurrentPhotoIndex(index);
    
    for (let s = 5; s > 0; s--) {
      setCountdown(s);
      await delay(1000);
    }
    
    setIsCapturing(true);
    const imageData = captureService.captureFrame('camera-feed');
    sessionManager.replaceImage(index, imageData);
    setPhotos([...sessionManager.getImages()]);
    setIsCapturing(false);
    
    await delay(800);
    setStep('APPLY_FRAME');
  };

  const finishSession = async () => {
    setStep('PRINT');
    try {
      await apiService.saveSession(
        sessionManager.getImages(),
        gridFrame,
        sessionManager.getVideos(),
        selectedFrame?.id || '',
        sessionManager.getFullVideo() || new Blob()
      );
    } catch(e) {
      console.error(e);
    }
  };

  // Renderer Mini Frame Preview
  const ComposedPhoto = ({ photoList, layout, scale = "normal" }: any) => {
    const gridClass = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 gap-4',
      3: 'grid-cols-1 gap-4',
      4: 'grid-cols-2 gap-2'
    }[layout as number] || 'grid-cols-1';

    const isMini = scale === "mini";

    // Just use a dummy border mapping if we don't have style data in template
    const border = 'border-8 border-white bg-white shadow-lg';

    return (
      <div className={`transition-all duration-300 ${border} p-4 flex flex-col items-center ${isMini ? 'w-full' : 'w-full max-w-sm mx-auto'}`}>
        <div className={`w-full grid ${gridClass}`}>
          {Array.from({ length: layout }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-gray-200 overflow-hidden relative rounded-sm">
              {photoList[i] ? (
                <img src={photoList[i]} alt={`Pic ${i}`} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <ImageIcon size={isMini ? 16 : 32} opacity={0.5} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className={`mt-4 mb-2 font-bold tracking-widest text-center ${isMini ? 'text-[10px]' : 'text-sm'}`}>
          ELEGANCE STUDIO
        </div>
      </div>
    );
  };

  return (
    <>
      <video id="camera-feed" autoPlay playsInline muted className={`${(step === 'CAPTURE' || step === 'CAPTURE_RETAKE') ? 'fixed inset-0 w-full h-full object-cover z-0' : 'hidden'}`}></video>
      <canvas id="composited-canvas" width="1280" height="720" style={{ display: 'none' }}></canvas>
      
      <div className="relative z-10">
        {step === 'HOME' && (
          <div 
            className={`min-h-screen ${THEME_BG} ${THEME_TEXT} flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-gray-50`}
            onClick={() => {
              const compatible = templates.filter(t => t.slots.length === selectedLayout);
              if (compatible.length > 0) setSelectedFrame(compatible[0]);
              setStep('LAYOUT');
            }}
          >
            <h1 className="text-8xl md:text-[9rem] font-black tracking-tighter mb-4 text-center">
              STUDIO<br/>BOOTH
            </h1>
            <div className="flex items-center gap-3 text-2xl font-medium tracking-tight animate-pulse text-red-600">
              <span>Tap to Start</span>
              <ArrowRight size={28} />
            </div>
          </div>
        )}

        {step === 'LAYOUT' && (
          <div className={`min-h-screen ${THEME_BG} ${THEME_TEXT} p-8 md:p-16 flex flex-col`}>
            <h2 className="text-5xl font-bold tracking-tight mb-12">Pilih Layout</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 flex-grow">
              {availableLayouts.length > 0 ? availableLayouts.map((num) => (
                <div 
                  key={num}
                  onClick={() => setSelectedLayout(num)}
                  className={`group cursor-pointer rounded-3xl p-6 border-2 transition-all duration-300 flex flex-col items-center justify-center min-h-[300px]
                    ${selectedLayout === num ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                >
                  <div className="relative w-24 h-32 mb-6">
                    {Array.from({ length: num }).map((_, i) => (
                      <div 
                        key={i}
                        className={`absolute inset-0 bg-gray-200 border-2 border-white rounded-md shadow-sm transition-transform duration-500 origin-bottom`}
                        style={{
                          transform: `
                            rotate(${num > 1 ? (i - (num-1)/2) * 10 : 0}deg) 
                            translateX(${num > 1 ? (i - (num-1)/2) * 10 : 0}px)
                          `,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-3xl font-bold">{num} Foto</span>
                </div>
              )) : (
                <div className="col-span-full text-center text-xl text-gray-500">Loading layouts...</div>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between border-t border-gray-200 pt-8 gap-8 bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm">
              <div className="flex items-center gap-6">
                <span className="text-2xl font-semibold">Jumlah Cetak</span>
                <div className="flex items-center gap-4 bg-gray-100 rounded-full p-2">
                  <button 
                    onClick={() => setPrintQuantity(Math.max(1, printQuantity - 1))}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-gray-50 active:scale-95"
                  >
                    <Minus size={24} />
                  </button>
                  <span className="text-3xl font-bold w-12 text-center">{printQuantity}</span>
                  <button 
                    onClick={() => setPrintQuantity(printQuantity + 1)}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-gray-50 active:scale-95"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
              
              <button 
                onClick={() => setStep('PAYMENT')}
                className={`${THEME_ACCENT} px-12 py-6 rounded-full text-2xl font-bold flex items-center gap-4 hover:opacity-90 active:scale-95 transition-all`}
              >
                Lanjut Pembayaran
                <ChevronRight size={28} />
              </button>
            </div>
          </div>
        )}

        {step === 'PAYMENT' && (
          <div className={`min-h-screen ${THEME_BG} ${THEME_TEXT} flex flex-col items-center justify-center p-8`}>
            <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-lg w-full text-center">
              <QrCode size={80} className="text-gray-300 mb-8" />
              <h2 className="text-4xl font-bold tracking-tight mb-4">Scan QRIS</h2>
              <p className="text-xl text-gray-500 mb-8">Selesaikan pembayaran untuk memulai sesi foto Anda.</p>
              
              <div className="w-64 h-64 bg-gray-100 rounded-2xl flex items-center justify-center mb-8 relative overflow-hidden group">
                <div className="absolute inset-4 grid grid-cols-5 grid-rows-5 gap-1 opacity-20">
                    {Array.from({length: 25}).map((_, i) => (
                      <div key={i} className={`bg-black ${Math.random() > 0.5 ? 'rounded-sm' : 'rounded-full'}`}></div>
                    ))}
                </div>
                <QrCode size={120} className="text-black relative z-10" />
              </div>

              <div className="flex justify-between w-full border-t border-gray-100 pt-6 mt-4">
                <button onClick={() => setStep('LAYOUT')} className="text-gray-500 font-medium px-6 py-3 rounded-full hover:bg-gray-100">Batal</button>
                <button 
                    onClick={() => startCaptureSequence()}
                    className={`${THEME_ACCENT} px-8 py-3 rounded-full font-bold shadow-lg`}
                  >
                    Simulasi Bayar Sukses
                </button>
              </div>
            </div>
          </div>
        )}

        {(step === 'CAPTURE' || step === 'CAPTURE_RETAKE') && (
          <div className="min-h-screen flex flex-col relative overflow-hidden">
            {isCapturing && <div className="absolute inset-0 bg-white z-50 animate-ping opacity-75"></div>}
            
            <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
              <div className="bg-black/50 backdrop-blur-md text-white px-6 py-3 rounded-full text-xl font-medium tracking-wide">
                Foto {currentPhotoIndex + 1} dari {selectedLayout}
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative">
              {!isCapturing && (
                <div className="relative z-10 flex flex-col items-center">
                  <span className="text-[15rem] leading-none font-black text-white drop-shadow-2xl animate-pulse">
                    {countdown}
                  </span>
                  <span className="text-3xl font-medium tracking-widest mt-4 text-white/80 uppercase px-6 py-2 bg-black/50 rounded-full backdrop-blur-md">
                    Bersiaplah
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'APPLY_FRAME' && (
          <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <h2 className="text-3xl animate-pulse">{appStatus || 'Rendering...'}</h2>
          </div>
        )}

        {step === 'REVIEW' && (
          <div className={`min-h-screen ${THEME_BG} ${THEME_TEXT} flex flex-col`}>
            <header className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-20">
              <h2 className="text-3xl font-bold tracking-tight">Review & Frame</h2>
              <div className="flex gap-4">
                <button 
                  onClick={startCaptureSequence}
                  className="px-6 py-3 rounded-full font-semibold border-2 border-gray-200 hover:border-gray-900 transition-colors flex items-center gap-2 bg-white"
                >
                  <RefreshCcw size={20} />
                  Retake All
                </button>
                <button 
                  onClick={finishSession}
                  className={`${THEME_ACCENT} px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:opacity-90`}
                >
                  Print Now <Printer size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 bg-gray-50 border-r border-gray-200 p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold tracking-widest text-gray-400 uppercase">Hasil Foto</h3>
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">Quota: {retakeQuota}</span>
                </div>
                <div className="flex flex-col gap-4">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute top-2 left-2 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold z-10">
                        {idx + 1}
                      </div>
                      <img 
                        src={photo} 
                        alt={`Taken ${idx}`} 
                        className="w-full aspect-[3/4] object-cover rounded-xl shadow-sm group-hover:opacity-90 transition-opacity"
                      />
                      <button 
                        onClick={() => executeRetake(idx)}
                        disabled={retakeQuota <= 0}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 disabled:group-hover:opacity-0 transition-opacity rounded-xl text-white font-medium cursor-pointer"
                      >
                        <RefreshCcw size={24} className="mb-1" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-8 overflow-y-auto flex justify-center items-start bg-[#f4f4f5]">
                <div className="transform origin-top scale-90 md:scale-100 transition-transform">
                  {gridFrame ? (
                     <img src={gridFrame} alt="Frame final" className="border-2 border-gray-300 rounded shadow-md max-w-full" />
                  ) : (
                     <ComposedPhoto photoList={photos} layout={selectedLayout} />
                  )}
                </div>
              </div>

              <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
                <h3 className="text-sm font-bold tracking-widest text-gray-400 mb-6 uppercase">Pilih Frame</h3>
                <div className="flex flex-col gap-8">
                  {templates.filter(t => t.slots.length === selectedLayout).map((frame) => (
                    <div 
                      key={frame.id}
                      onClick={() => setSelectedFrame(frame)}
                      className={`cursor-pointer transition-all duration-300 transform hover:scale-105 origin-center
                        ${selectedFrame?.id === frame.id ? 'ring-4 ring-offset-4 ring-red-600 rounded-xl' : 'hover:opacity-80'}`}
                    >
                      <div className="pointer-events-none p-2 border border-gray-100 bg-gray-50 rounded">
                        <img src={frame.url} className="w-full object-contain mix-blend-multiply" />
                      </div>
                      <p className="text-center mt-3 font-medium text-gray-600">{frame.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'PRINT' && (
          <div className={`min-h-screen ${THEME_BG} ${THEME_TEXT} flex flex-col items-center justify-center p-8`}>
            <div className="max-w-4xl w-full grid md:grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8 animate-bounce">
                  <Check size={40} />
                </div>
                <h2 className="text-5xl font-black tracking-tight mb-4">Selesai!</h2>
                <p className="text-2xl text-gray-500 mb-2">Sedang mencetak {printQuantity} lembar...</p>
                <p className="text-lg text-gray-400 mb-12">Silakan ambil hasil foto Anda di bawah.</p>
                
                <div className="bg-gray-50 p-6 rounded-3xl w-full flex items-center justify-between border border-gray-200 mb-8">
                  <div>
                    <h4 className="font-bold text-xl mb-1">Unduh Digital</h4>
                    <p className="text-gray-500 text-sm">Scan QR untuk menyimpan ke HP</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-sm">
                    <QrCode size={64} />
                  </div>
                </div>

                <button 
                  onClick={resetApp}
                  className={`${THEME_ACCENT} w-full py-5 rounded-full text-xl font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all`}
                >
                  Kembali ke Beranda
                </button>
              </div>

              <div className="flex justify-center">
                <div className="transform rotate-2 hover:rotate-0 transition-transform duration-500 shadow-2xl">
                    {gridFrame ? (
                       <img src={gridFrame} alt="Frame final" className="border-4 border-white shadow-lg" />
                    ) : (
                       <div className="text-xl font-bold p-8 bg-gray-200">No Frame Rendered!</div>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
