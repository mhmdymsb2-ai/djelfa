import { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Crosshair,
  Car,
  Save,
  Radio,
  X,
  Store,
} from 'lucide-react';
import { ASSETS, RADIO_CHAT_CHOICES, SHOPS, WEAPONS } from '../game/storyData';
import { ChatChoice, HudState, RadioMessage, WeaponId } from '../game/types';

interface GameHudProps {
  hud: HudState;
  callout: string | null;
  radioMsg: RadioMessage | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSaveProgress: () => void;
  onSelectChatChoice: (choice: ChatChoice) => void;
  onSwitchWeapon: (w: WeaponId) => void;
  onReload: () => void;
  onInteract: () => void;
  onShoot: () => void;
}

export function GameHud({
  hud,
  callout,
  radioMsg,
  muted,
  onToggleMute,
  onPause,
  onSaveProgress,
  onSelectChatChoice,
  onSwitchWeapon,
  onReload,
  onInteract,
  onShoot,
}: GameHudProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shopsOpen, setShopsOpen] = useState(false);
  const radarRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') setDockCollapsed((v) => !v);
      if (e.code === 'KeyT') setChatOpen((v) => !v);
      if (e.code === 'KeyM') setShopsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = radarRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 136;
    const half = size / 2;
    const scale = 0.5;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0e131b';
    ctx.fillRect(0, 0, size, size);

    const toRadar = (wx: number, wz: number) => ({
      x: half + (wx - hud.playerX) * scale,
      y: half + (wz - hud.playerZ) * scale,
    });

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    const origin = toRadar(0, 0);
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, size);
    ctx.moveTo(0, origin.y);
    ctx.lineTo(size, origin.y);
    ctx.stroke();

    hud.minimapEntities.forEach((ent) => {
      const p = toRadar(ent.x, ent.z);
      if (p.x < 3 || p.x > size - 3 || p.y < 3 || p.y > size - 3) return;
      if (ent.kind === 'shop') {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
        return;
      }
      if (ent.kind === 'police') {
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return;
      }
      ctx.fillStyle =
        ent.kind === 'enemy'
          ? '#ef4444'
          : ent.kind === 'boss'
          ? '#dc2626'
          : ent.kind === 'ally'
          ? '#22c55e'
          : ent.kind === 'crate'
          ? '#f59e0b'
          : '#94a3b8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, ent.kind === 'boss' ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    if (hud.targetX !== null && hud.targetZ !== null) {
      const dx = hud.targetX - hud.playerX;
      const dz = hud.targetZ - hud.playerZ;
      const dist = Math.hypot(dx, dz);
      const clampedDist = Math.min(dist * scale, half - 8);
      const angle = Math.atan2(dz, dx);
      const tx = half + Math.cos(angle) * clampedDist;
      const ty = half + Math.sin(angle) * clampedDist;

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-hud.playerYaw + Math.PI);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [hud]);

  const weaponSpec = WEAPONS[hud.activeWeapon];
  const weaponOrder: WeaponId[] = ['beretta', 'ak47', 'shotgun'];

  const radioPortrait =
    radioMsg?.portrait === 'ally'
      ? ASSETS.ally
      : radioMsg?.portrait === 'mafia'
      ? ASSETS.mafia
      : radioMsg?.portrait === 'jomoui'
      ? ASSETS.jomoui
      : radioMsg?.portrait === 'cover'
      ? ASSETS.cover
      : ASSETS.mosaab;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {hud.damageFlashTimer > 0 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 95px rgba(220, 38, 38, 0.72)',
          }}
        />
      )}

      {hud.inVehicle && hud.speedKmh > 105 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 80px rgba(245, 158, 11, 0.25)',
          }}
        />
      )}

      {/* Top-Right: Minimap & Current Mission */}
      <div className="absolute top-4 right-4 flex items-start gap-3 pointer-events-auto">
        <div className="bg-[#0e121a]/90 border border-white/15 rounded-lg p-3 max-w-xs space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs text-amber-400 font-semibold">
            <span>{hud.missionTitle}</span>
            <span className="text-stone-400 font-normal">{hud.districtName}</span>
          </div>
          <p className="text-xs text-stone-200 leading-relaxed">{hud.missionObjective}</p>
          {hud.missionProgressText && (
            <div className="text-xs font-mono-nums text-amber-300 pt-0.5">
              {hud.missionProgressText}
            </div>
          )}
        </div>

        <div className="hidden sm:block bg-[#0e121a]/92 border border-white/15 rounded-lg p-1.5 shrink-0">
          <canvas ref={radarRef} width={136} height={136} className="rounded block" />
          <div className="text-[10px] text-center text-stone-400 pt-1">
            زرقاء: المحلات · الشرطي جموعي
          </div>
        </div>
      </div>

      {/* Top-Left: Health, Armor, Cash & Utility Controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto">
        <div className="bg-[#0e121a]/90 border border-white/15 rounded-lg px-3.5 py-2.5 space-y-1.5 min-w-[180px]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-300">الصحة</span>
            <span className="font-mono-nums font-bold text-white">
              {hud.hp} / {hud.maxHp}
            </span>
          </div>
          <div className="h-1.5 w-full bg-stone-800 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${
                hud.hp > 40 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(0, (hud.hp / hud.maxHp) * 100)}%` }}
            />
          </div>

          {hud.armor > 0 && (
            <div className="h-1 w-full bg-stone-800 rounded overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all"
                style={{ width: `${Math.min(100, hud.armor)}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="font-mono-nums font-bold text-amber-400">
              {hud.cash.toLocaleString('en-US')} دج
            </span>
            {hud.wantedLevel > 0 ? (
              <span className="text-red-400 font-semibold">اشتباك</span>
            ) : (
              <span className="text-stone-400 font-mono-nums">قتلى: {hud.kills}</span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShopsOpen((v) => !v)}
          title="دليل المحلات والخدمات (M)"
          className="p-2.5 rounded-lg bg-[#0e121a]/90 hover:bg-stone-800 border border-white/15 text-cyan-400 transition-colors cursor-pointer"
        >
          <Store className="w-4 h-4" />
        </button>

        {!hud.isFreeRoam && (
          <button
            onClick={onSaveProgress}
            title="حفظ التقدم"
            className="p-2.5 rounded-lg bg-[#0e121a]/90 hover:bg-stone-800 border border-white/15 text-amber-400 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => setChatOpen((v) => !v)}
          title="هدر مع عمير (T)"
          className="p-2.5 rounded-lg bg-[#0e121a]/90 hover:bg-stone-800 border border-white/15 text-stone-200 transition-colors cursor-pointer"
        >
          <Radio className="w-4 h-4 text-amber-400" />
        </button>

        <button
          onClick={onToggleMute}
          title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className="p-2.5 rounded-lg bg-[#0e121a]/90 hover:bg-stone-800 border border-white/15 text-stone-200 transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onPause}
          title="توقيف مؤقت"
          className="p-2.5 rounded-lg bg-[#0e121a]/90 hover:bg-stone-800 border border-white/15 text-stone-200 transition-colors cursor-pointer"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Djelfa Open Shops Directory Drawer (M) */}
      {shopsOpen && (
        <div className="fixed top-28 right-4 w-80 max-w-[90vw] bg-[#10141d]/95 border border-white/15 rounded-xl overflow-hidden shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#161b26]">
            <div className="flex items-center gap-2 text-xs font-display font-bold text-cyan-400">
              <Store className="w-3.5 h-3.5" />
              <span>المحلات ومراكز الخدمات المفتوحة (6)</span>
            </div>
            <button
              onClick={() => setShopsOpen(false)}
              className="text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2.5 space-y-1.5 max-h-72 overflow-y-auto">
            {SHOPS.map((s) => {
              const dist = Math.round(Math.hypot(s.x - hud.playerX, s.z - hud.playerZ));
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-stone-900/80 border border-white/5 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{s.nameAr}</div>
                    <div className="text-stone-400 text-[11px]">{s.keeperName}</div>
                  </div>
                  <span className="font-mono-nums text-cyan-300 shrink-0">{dist} م</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Radio Dialogue Bubble */}
      {radioMsg && (
        <div className="fixed top-24 left-4 max-w-sm bg-[#0e121a]/95 border border-amber-500/40 rounded-lg p-3 flex items-center gap-3 shadow-xl pointer-events-auto">
          <img
            src={radioPortrait}
            alt={radioMsg.speaker}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded object-cover shrink-0 border border-white/10"
          />
          <div className="min-w-0">
            <div className="text-xs font-display font-bold text-amber-400">{radioMsg.speaker}</div>
            <p className="text-xs text-stone-100 leading-relaxed">{radioMsg.text}</p>
          </div>
        </div>
      )}

      {/* Interactive Radio Talk Panel */}
      {chatOpen && (
        <div className="fixed bottom-24 left-4 w-80 max-w-[90vw] bg-[#10141d]/95 border border-white/15 rounded-xl overflow-hidden shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#161b26]">
            <div className="flex items-center gap-2 text-xs font-display font-bold text-amber-400">
              <Radio className="w-3.5 h-3.5" />
              <span>اتصال مباشر مع عمير (صقور الهضاب)</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2.5 space-y-1.5">
            {RADIO_CHAT_CHOICES.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelectChatChoice(c);
                  setChatOpen(false);
                }}
                className="w-full text-right px-3 py-2 rounded-lg bg-stone-800/80 hover:bg-amber-500 hover:text-stone-950 text-xs font-medium text-stone-100 transition-colors cursor-pointer"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Center Crosshair */}
      {!hud.inVehicle && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              hud.hitMarkerTimer > 0
                ? 'border-amber-400 scale-125'
                : 'border-white/75 scale-100'
            }`}
          />
          <div className="w-1 h-1 bg-amber-400 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      )}

      {/* Callout Toast */}
      {callout && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 bg-[#141923]/95 border border-amber-500/40 px-4 py-2 rounded-lg text-sm font-medium text-amber-300 shadow-lg">
          {callout}
        </div>
      )}

      {/* Contextual Interaction Button */}
      {hud.interactionPrompt && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={onInteract}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm shadow-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {hud.interactionPrompt}
          </button>
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto max-w-[94vw]">
        <button
          onClick={() => setDockCollapsed((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#0e121a]/95 border border-b-0 border-white/15 text-[11px] text-stone-300 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          <span>{dockCollapsed ? 'إظهار اللوحة (H)' : 'إخفاء اللوحة (H)'}</span>
        </button>

        {!dockCollapsed && (
          <div className="bg-[#0e121a]/92 border border-white/15 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-center gap-4 shadow-xl">
            {hud.inVehicle ? (
              <>
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="font-display font-bold text-sm text-white">
                      {hud.vehicleName}
                    </div>
                    <div className="font-mono-nums text-xs text-amber-300">
                      {hud.vehiclePlate}
                    </div>
                  </div>
                </div>

                <div className="h-7 w-px bg-white/10" />

                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono-nums text-2xl font-bold text-white">
                    {hud.speedKmh}
                  </span>
                  <span className="text-xs text-stone-400">كم/س</span>
                </div>

                <div className="h-7 w-px bg-white/10" />

                <button
                  onClick={onInteract}
                  className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-white/10 text-xs font-medium text-stone-100 cursor-pointer whitespace-nowrap"
                >
                  اهبط (F)
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  {weaponOrder.map((wId, idx) => {
                    const unlocked = hud.unlockedWeapons.includes(wId);
                    const active = hud.activeWeapon === wId;
                    return (
                      <button
                        key={wId}
                        disabled={!unlocked}
                        onClick={() => onSwitchWeapon(wId)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          !unlocked
                            ? 'bg-stone-900/60 text-stone-600 cursor-not-allowed'
                            : active
                            ? 'bg-amber-500 text-stone-950 font-bold cursor-pointer'
                            : 'bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer'
                        }`}
                      >
                        <span className="font-mono-nums ml-1">{idx + 1}.</span>
                        {WEAPONS[wId].nameAr}
                      </button>
                    );
                  })}
                </div>

                <div className="h-7 w-px bg-white/10" />

                <div className="flex items-center gap-3">
                  <div className="font-mono-nums text-sm">
                    <span className="text-white font-bold">
                      {hud.isReloading ? 'تعمار...' : hud.ammoInMag[hud.activeWeapon]}
                    </span>
                    <span className="text-stone-400">
                      {' '}
                      / {weaponSpec.id === 'beretta' ? '∞' : hud.reserveAmmo[hud.activeWeapon]}
                    </span>
                  </div>

                  <button
                    onClick={onReload}
                    title="تعمار السلاح (R)"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>تعمار</span>
                  </button>

                  <button
                    onClick={onShoot}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>تيري</span>
                  </button>
                </div>
              </>
            )}

            <div className="h-7 w-px bg-white/10" />

            <button
              onClick={() => setChatOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-white/10 text-xs font-medium text-amber-300 cursor-pointer whitespace-nowrap"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>هدر مع عمير (T)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
