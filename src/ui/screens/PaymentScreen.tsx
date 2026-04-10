import { QrCode } from 'lucide-react';

interface PaymentScreenProps {
  onCancel: () => void;
  onSuccess: () => void;
}

const THEME_ACCENT = 'bg-red-600 text-white';
const THEME_BG = 'bg-[#fcfcfc]';
const THEME_TEXT = 'text-gray-900';

export function PaymentScreen({ onCancel, onSuccess }: PaymentScreenProps) {
  return (
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
          <button onClick={onCancel} className="text-gray-500 font-medium px-6 py-3 rounded-full hover:bg-gray-100">Batal</button>
          <button 
              onClick={onSuccess}
              className={`${THEME_ACCENT} px-8 py-3 rounded-full font-bold shadow-lg`}
            >
              Simulasi Bayar Sukses
          </button>
        </div>
      </div>
    </div>
  );
}
