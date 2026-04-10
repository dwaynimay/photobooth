import { ChevronRight, Minus, Plus } from 'lucide-react';

interface LayoutScreenProps {
  availableLayouts: number[];
  selectedLayout: number;
  printQuantity: number;
  setSelectedLayout: (num: number) => void;
  setPrintQuantity: (num: number) => void;
  onNext: () => void;
}

const THEME_ACCENT = 'bg-red-600 text-white';
const THEME_BG = 'bg-[#fcfcfc]';
const THEME_TEXT = 'text-gray-900';

export function LayoutScreen({
  availableLayouts,
  selectedLayout,
  printQuantity,
  setSelectedLayout,
  setPrintQuantity,
  onNext
}: LayoutScreenProps) {
  return (
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
                  style={{ transform: `rotate(${num > 1 ? (i - (num-1)/2) * 10 : 0}deg) translateX(${num > 1 ? (i - (num-1)/2) * 10 : 0}px)` }}
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
          onClick={onNext}
          className={`${THEME_ACCENT} px-12 py-6 rounded-full text-2xl font-bold flex items-center gap-4 hover:opacity-90 active:scale-95 transition-all`}
        >
          Lanjut Pembayaran
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}
