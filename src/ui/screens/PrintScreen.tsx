import { Check, QrCode } from 'lucide-react';

interface PrintScreenProps {
  printQuantity: number;
  gridFrame: string;
  onReset: () => void;
}

const THEME_ACCENT = 'bg-red-600 text-white';
const THEME_BG = 'bg-[#fcfcfc]';
const THEME_TEXT = 'text-gray-900';

export function PrintScreen({
  printQuantity,
  gridFrame,
  onReset
}: PrintScreenProps) {
  return (
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
            onClick={onReset}
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
  );
}
