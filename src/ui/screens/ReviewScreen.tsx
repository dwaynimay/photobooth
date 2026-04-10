import { RefreshCcw, Printer, Image as ImageIcon } from 'lucide-react';
import type { Template } from '../../types';

interface ReviewScreenProps {
  photos: string[];
  templates: Template[];
  selectedTemplate: Template | null;
  selectedLayout: number;
  gridFrame: string;
  retakeQuota: number;
  onSelectTemplate: (t: Template) => void;
  onRetakeAll: () => void;
  onRetakeSingle: (index: number) => void;
  onPrint: () => void;
}

const THEME_ACCENT = 'bg-red-600 text-white';
const THEME_BG = 'bg-[#fcfcfc]';
const THEME_TEXT = 'text-gray-900';

export function ReviewScreen({
  photos,
  templates,
  selectedTemplate,
  selectedLayout,
  gridFrame,
  retakeQuota,
  onSelectTemplate,
  onRetakeAll,
  onRetakeSingle,
  onPrint
}: ReviewScreenProps) {
  return (
    <div className={`min-h-screen ${THEME_BG} ${THEME_TEXT} flex flex-col`}>
      <header className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-white/80 backdrop-blur-xl sticky top-0 z-20">
        <h2 className="text-3xl font-bold tracking-tight">Review & Frame</h2>
        <div className="flex gap-4">
          <button 
            onClick={onRetakeAll}
            className="px-6 py-3 rounded-full font-semibold border-2 border-gray-200 hover:border-gray-900 transition-colors flex items-center gap-2 bg-white"
          >
            <RefreshCcw size={20} />
            Retake All
          </button>
          <button 
            onClick={onPrint}
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
                  onClick={() => onRetakeSingle(idx)}
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
                onClick={() => onSelectTemplate(frame)}
                className={`cursor-pointer transition-all duration-300 transform hover:scale-105 origin-center
                  ${selectedTemplate?.id === frame.id ? 'ring-4 ring-offset-4 ring-red-600 rounded-xl' : 'hover:opacity-80'}`}
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
  );
}

// Internal fallback renderer if no gridFrame is supplied yet
const ComposedPhoto = ({ photoList, layout }: any) => {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 gap-4',
    3: 'grid-cols-1 gap-4',
    4: 'grid-cols-2 gap-2'
  }[layout as number] || 'grid-cols-1';

  return (
    <div className={`transition-all duration-300 border-8 border-white bg-white shadow-lg p-4 flex flex-col items-center w-full max-w-sm mx-auto`}>
      <div className={`w-full grid ${gridClass}`}>
        {Array.from({ length: layout }).map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-gray-200 overflow-hidden relative rounded-sm">
            {photoList[i] ? (
              <img src={photoList[i]} alt={`Pic ${i}`} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <ImageIcon size={32} opacity={0.5} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={`mt-4 mb-2 font-bold tracking-widest text-center text-sm`}>
        ELEGANCE STUDIO
      </div>
    </div>
  );
};
