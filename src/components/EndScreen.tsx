import { RotateCcw, Compass, Home, Save } from 'lucide-react';
import { ASSETS } from '../game/storyData';

interface EndScreenProps {
  mode: 'victory' | 'defeat' | 'paused';
  kills: number;
  cash: number;
  onResume?: () => void;
  onSave?: () => void;
  onRetry: () => void;
  onFreeRoam: () => void;
  onMainMenu: () => void;
}

export function EndScreen({
  mode,
  kills,
  cash,
  onResume,
  onSave,
  onRetry,
  onFreeRoam,
  onMainMenu,
}: EndScreenProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/80">
      <div className="max-w-lg w-full bg-[#12151c] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="relative h-40 overflow-hidden bg-stone-900">
          <img
            src={mode === 'defeat' ? ASSETS.mafia : ASSETS.mosaab}
            alt="نتيجة اللعبة"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12151c] via-[#12151c]/50 to-transparent" />
          <div className="absolute bottom-4 right-5 left-5">
            <h2 className="font-display text-2xl font-extrabold text-white">
              {mode === 'victory'
                ? 'مبروك! الوالدين رجعو سالمين للدار'
                : mode === 'defeat'
                ? 'طحت في الاشتباك!'
                : 'اللعبة متوقفة مؤقتاً'}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-stone-300 leading-relaxed">
            {mode === 'victory'
              ? 'يعطيك الصحة يا مصعب! بفضل وقفتك مع «صقور الهضاب» وقدرتك على مواجهة المافيا، طيّحت «الضبع» وحررت والديك. الجلفة كلها تحكي برجلتك اليوم!'
              : mode === 'defeat'
              ? 'المافيا غدروك هاذ المرة، بصح وليد الجلفة ما يستسلمش. عاود الكرة وطيحهم!'
              : 'تقدر تكمل القصة دوكا، تحفظ تقدمك، ولا تدخل للتحواس الحر في شوارع الجلفة.'}
          </p>

          <div className="flex items-center gap-6 py-3 px-4 rounded-lg bg-[#0d1016] border border-white/10 text-sm">
            <div>
              <div className="text-xs text-stone-400">أفراد المافيا المطاحين</div>
              <div className="font-mono-nums font-bold text-lg text-white">{kills}</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="text-xs text-stone-400">الرصيد المحصل</div>
              <div className="font-mono-nums font-bold text-lg text-amber-400">
                {cash.toLocaleString('en-US')} دج
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {mode === 'paused' && onResume && (
              <button
                onClick={onResume}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm cursor-pointer whitespace-nowrap"
              >
                <span>كمّل اللعب</span>
              </button>
            )}

            {mode === 'paused' && onSave && (
              <button
                onClick={onSave}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-white/15 text-amber-400 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التقدم</span>
              </button>
            )}

            {mode === 'victory' && (
              <button
                onClick={onFreeRoam}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm cursor-pointer whitespace-nowrap"
              >
                <Compass className="w-4 h-4" />
                <span>تحواس حر في الجلفة</span>
              </button>
            )}

            <button
              onClick={onRetry}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-white/15 text-stone-100 text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>عاود القصة</span>
            </button>

            <button
              onClick={onMainMenu}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-white/10 text-stone-300 text-sm cursor-pointer whitespace-nowrap"
            >
              <Home className="w-4 h-4" />
              <span>القائمة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
