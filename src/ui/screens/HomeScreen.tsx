import { ArrowRight } from 'lucide-react';

interface HomeScreenProps {
  onNext: () => void;
}

const THEME_BG = 'bg-[#fcfcfc]';
const THEME_TEXT = 'text-gray-900';

export function HomeScreen({ onNext }: HomeScreenProps) {
  return (
    <div 
      className={`min-h-screen ${THEME_BG} ${THEME_TEXT} flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-gray-50`}
      onClick={onNext}
    >
      <h1 className="text-8xl md:text-[9rem] font-black tracking-tighter mb-4 text-center">
        STUDIO<br/>BOOTH
      </h1>
      <div className="flex items-center gap-3 text-2xl font-medium tracking-tight animate-pulse text-red-600">
        <span>Tap to Start</span>
        <ArrowRight size={28} />
      </div>
    </div>
  );
}
