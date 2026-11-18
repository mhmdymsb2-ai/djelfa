import { useEffect, useState } from 'react';
import { Shield, Volume2, X } from 'lucide-react';
import { ASSETS, JOMOUI_OPTIONS } from '../game/storyData';
import { JomouiOption } from '../game/types';

interface JomouiModalProps {
  onSelectOption: (opt: JomouiOption) => string;
  onSpeakGreeting: () => void;
  onClose: () => void;
}

const JOMOUI_GREETING =
  'أهلا يا مصعب... راني عارف واش صرا لوالديك في حي المصلى. القانون راهو مقيد يدي رسمياً، بصح في الخفاء نقدر نعاونك بالسترة، الذخيرة، ولا حتى سيارة الشرطة DGSN 17.';

export function JomouiModal({
  onSelectOption,
  onSpeakGreeting,
  onClose,
}: JomouiModalProps) {
  const [reply, setReply] = useState<string>(JOMOUI_GREETING);

  useEffect(() => {
    onSpeakGreeting();
  }, [onSpeakGreeting]);

  const handlePick = (opt: JomouiOption) => {
    const res = onSelectOption(opt);
    setReply(res);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div className="max-w-2xl w-full bg-[#11151d] border border-sky-500/35 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#151c29]">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                الشرطي جموعي · أمن ولاية الجلفة 17
              </h3>
              <p className="text-xs text-sky-300">
                مركز الأمن الوطني · شمال ساحة أول نوفمبر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSpeakGreeting}
              title="اسمع صوت جموعي"
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sky-400 cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Portrait & Spoken Darja Dialogue */}
        <div className="px-6 py-5 border-b border-white/10 bg-[#0e1218] flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-24 h-24 rounded-lg overflow-hidden border border-sky-400/30 shrink-0 bg-stone-900">
            <img
              src={ASSETS.jomoui}
              alt="الشرطي جموعي"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="text-xs font-semibold text-sky-400">
              الشرطي جموعي يقولك:
            </div>
            <p className="text-sm sm:text-base text-stone-100 leading-relaxed">
              {reply}
            </p>
          </div>
        </div>

        {/* Interactive Options */}
        <div className="p-5 space-y-2.5">
          {JOMOUI_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handlePick(opt)}
              className="w-full text-right p-3.5 rounded-lg bg-[#161b25] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/50 transition-colors cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-display font-bold text-sm text-white">
                  {opt.titleAr}
                </div>
                <div className="text-xs text-stone-400 mt-0.5">{opt.descAr}</div>
              </div>
              <span className="text-xs font-bold text-sky-400 shrink-0 whitespace-nowrap">
                اطلب الدعم
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-[#0d1016] flex items-center justify-between">
          <span className="text-xs text-stone-400">
            جموعي يدافع على السونتر فيل إذا قربو أفراد المافيا من المركز
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
          >
            اخرج للميدان
          </button>
        </div>
      </div>
    </div>
  );
}
