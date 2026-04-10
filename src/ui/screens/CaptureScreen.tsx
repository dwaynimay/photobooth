interface CaptureScreenProps {
  currentPhotoIndex: number;
  selectedLayout: number;
  countdown: number;
  isCapturing: boolean;
}

export function CaptureScreen({
  currentPhotoIndex,
  selectedLayout,
  countdown,
  isCapturing
}: CaptureScreenProps) {
  return (
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
  );
}
