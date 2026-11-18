import { useEffect, useState } from 'react';
import { ChevronLeft, CheckCircle2, Volume2 } from 'lucide-react';
import { ASSETS } from '../game/storyData';
import { MissionDefinition, PortraitId } from '../game/types';

interface BriefingModalProps {
  mission: MissionDefinition;
  onSpeakLine: (text: string, portrait: PortraitId) => void;
  onStopSpeak: () => void;
  onContinue: () => void;
}

export function BriefingModal({
  mission,
  onSpeakLine,
  onStopSpeak,
  onContinue,
}: BriefingModalProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const dialogues = mission.dialogues;

  const current = dialogues[Math.min(lineIndex, Math.max(0, dialogues.length - 1))];
  const isLast = lineIndex >= dialogues.length - 1;

  useEffect(() => {
    if (current) {
      onSpeakLine(current.text, current.portrait);
    }
    return () => {
      onStopSpeak();
    };
  }, [lineIndex, current, onSpeakLine, onStopSpeak]);

  if (!dialogues || dialogues.length === 0 || !current) {
    return null;
  }

  const portraitSrc =
    current.portrait === 'mosaab'
      ? ASSETS.mosaab
      : current.portrait === 'ally'
      ? ASSETS.ally
      : current.portrait === 'mafia'
      ? ASSETS.mafia
      : current.portrait === 'jomoui'
      ? ASSETS.jomoui
      : ASSETS.cover;

  const handleNext = () => {
    onStopSpeak();
    if (!isLast) {
      setLineIndex((i) => i + 1);
    } else {
      setLineIndex(0);
      onContinue();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div className="max-w-2xl w-full bg-[#12151c] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#171b24]">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <span>{mission.chapterLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="text-stone-300">{mission.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSpeakLine(current.text, current.portrait)}
              title="اسمع الحوار"
              className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-amber-400 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono-nums text-xs text-stone-400">
              {lineIndex + 1} / {dialogues.length}
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col sm:flex-row gap-5 items-start">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-stone-900">
            <img
              src={portraitSrc}
              alt={current.speaker}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="font-display text-lg font-bold text-white">{current.speaker}</h3>
              <p className="text-xs text-amber-400">{current.role}</p>
            </div>
            <p className="text-base text-stone-200 leading-relaxed pt-1">{current.text}</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#0e1117] border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-stone-300 leading-relaxed">
            <span className="text-amber-400 font-semibold">المهمة: </span>
            {mission.objectiveText}
          </div>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isLast ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>ابدا المهمة</span>
              </>
            ) : (
              <>
                <span>كمل الحوار</span>
                <ChevronLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
