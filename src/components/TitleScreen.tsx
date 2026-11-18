import { Play, Compass, Shield, Car, Crosshair, RotateCcw } from 'lucide-react';
import { SavedProgress } from '../game/saveSystem';
import { ASSETS, MISSIONS } from '../game/storyData';

interface TitleScreenProps {
  savedGame: SavedProgress | null;
  onContinueSave: () => void;
  onStartStory: () => void;
  onStartFreeRoam: () => void;
}

export function TitleScreen({
  savedGame,
  onContinueSave,
  onStartStory,
  onStartFreeRoam,
}: TitleScreenProps) {
  const savedMission = savedGame ? MISSIONS[savedGame.missionIndex] : null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between bg-[#0c0e13]/92 text-stone-100 overflow-y-auto">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <img
          src={ASSETS.cover}
          alt="ولاية الجلفة في الغروب"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e13] via-[#0c0e13]/65 to-[#0c0e13]/80" />
      </div>

      <header className="flex items-center justify-between px-6 py-5 border-b border-white/10 max-w-7xl w-full mx-auto">
        <span className="font-display text-xl font-extrabold tracking-tight text-amber-400 whitespace-nowrap shrink-0">
          ظلال الجلفة
        </span>
        <div className="flex items-center gap-3 text-xs text-stone-300 whitespace-nowrap shrink-0">
          <span>ولاية الجلفة 17</span>
          <span aria-hidden="true">·</span>
          <span>الدارجة الجزائرية</span>
          <span aria-hidden="true">·</span>
          <span>عالم مفتوح ثلاثي الأبعاد</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-sm font-medium text-amber-400">
              قصة حقيقية من قلب الهضاب العليا · حي المصلى إلى عين وسارة
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold leading-tight text-white [text-wrap:balance]">
              ظلال الجلفة: عهد مصعب
            </h1>
            <p className="text-base sm:text-lg text-stone-300 leading-relaxed max-w-2xl">
              مصعب، شاب جلفاوي من حي المصلى، يرجع للدار يلقى والديه مخطوفين على يد عصابة «المافيا».
              لازم يدور على «صقور الهضاب»، يبرهن رجلتو معاهم، ويرجع والديه بالسلاح والسيارات الجزائرية!
            </p>

            {/* Saved Game Metadata Summary */}
            {savedGame && savedMission && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300">
                <span>آخر حفظ: {savedMission.chapterLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{savedMission.title}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-nums">{savedGame.cash.toLocaleString('en-US')} دج</span>
                <span aria-hidden="true">·</span>
                <span className="text-stone-400">{savedGame.savedAt}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {savedGame && (
                <button
                  onClick={onContinueSave}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>كمّل قصتك</span>
                </button>
              )}

              <button
                onClick={onStartStory}
                className={`flex items-center gap-2.5 px-6 py-3.5 rounded-lg font-display font-bold text-base transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  savedGame
                    ? 'bg-stone-800 hover:bg-stone-700 border border-white/15 text-stone-100'
                    : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                }`}
              >
                {savedGame ? <RotateCcw className="w-4 h-4" /> : <Play className="w-5 h-5 fill-current" />}
                <span>{savedGame ? 'قصة جديدة' : 'ابدا القصة (5 شابترات)'}</span>
              </button>

              <button
                onClick={onStartFreeRoam}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-white/15 text-stone-100 font-medium text-base transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Compass className="w-5 h-5 text-amber-400" />
                <span>تحواس حر في الجلفة</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs text-stone-300">
              <div className="flex items-start gap-2.5">
                <Car className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">المشي والسياقة</div>
                  <div>WASD أو الأسهم · Space فرين أمان</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Crosshair className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">السلاح والضرب</div>
                  <div>كليك يسار ضرب · R تعمار · 1-3 تبديل</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">الركوب والراديو</div>
                  <div>F / E اركب واهبط · T التكلم مع عمير</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
            <div className="bg-stone-900/90 border border-white/10 rounded-lg overflow-hidden">
              <img
                src={ASSETS.mosaab}
                alt="مصعب"
                referrerPolicy="no-referrer"
                className="w-full aspect-square object-cover"
              />
              <div className="p-3">
                <div className="font-display font-bold text-sm text-white">مصعب</div>
                <div className="text-xs text-stone-400 mt-0.5">بطل القصة · حي المصلى</div>
              </div>
            </div>

            <div className="bg-stone-900/90 border border-white/10 rounded-lg overflow-hidden">
              <img
                src={ASSETS.ally}
                alt="عمير"
                referrerPolicy="no-referrer"
                className="w-full aspect-square object-cover"
              />
              <div className="p-3">
                <div className="font-display font-bold text-sm text-amber-400">عمير</div>
                <div className="text-xs text-stone-400 mt-0.5">شاف صقور الهضاب</div>
              </div>
            </div>

            <div className="bg-stone-900/90 border border-sky-500/30 rounded-lg overflow-hidden">
              <img
                src={ASSETS.jomoui}
                alt="الشرطي جموعي"
                referrerPolicy="no-referrer"
                className="w-full aspect-square object-cover"
              />
              <div className="p-3">
                <div className="font-display font-bold text-sm text-sky-400">الشرطي جموعي</div>
                <div className="text-xs text-stone-400 mt-0.5">أمن ولاية الجلفة 17</div>
              </div>
            </div>

            <div className="bg-stone-900/90 border border-white/10 rounded-lg overflow-hidden">
              <img
                src={ASSETS.mafia}
                alt="الضبع"
                referrerPolicy="no-referrer"
                className="w-full aspect-square object-cover"
              />
              <div className="p-3">
                <div className="font-display font-bold text-sm text-red-400">الضبع</div>
                <div className="text-xs text-stone-400 mt-0.5">كابو المافيا</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-stone-400 border-t border-white/10">
        رونو سيمبول · بيجو 504 · تويوتا هيلوكس 4×4 · غولف 7 · سيارة الشرطة DGSN 17 · محاكاة ولاية الجلفة
      </footer>
    </div>
  );
}
