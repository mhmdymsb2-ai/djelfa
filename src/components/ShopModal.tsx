import { useState } from 'react';
import { X, ShoppingBag, Store } from 'lucide-react';
import { ShopDefinition, ShopItem } from '../game/types';

interface ShopModalProps {
  shop: ShopDefinition;
  cash: number;
  onBuy: (shop: ShopDefinition, item: ShopItem) => { ok: boolean; message: string };
  onClose: () => void;
}

export function ShopModal({ shop, cash, onBuy, onClose }: ShopModalProps) {
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const handleBuy = (item: ShopItem) => {
    const res = onBuy(shop, item);
    setFeedback(res);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div className="max-w-2xl w-full bg-[#11151d] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#171c27]">
          <div className="flex items-center gap-3">
            <Store className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h3 className="font-display text-lg font-bold text-white">{shop.nameAr}</h3>
              <p className="text-xs text-stone-400">{shop.keeperName} · مفتوح</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="font-mono-nums text-sm font-bold text-amber-400">
              {cash.toLocaleString('en-US')} دج
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Shopkeeper Greeting */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#0e1218]">
          <p className="text-sm text-stone-200 leading-relaxed">{shop.greetingAr}</p>
          {feedback && (
            <p
              className={`mt-2 text-xs font-semibold ${
                feedback.ok ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {feedback.message}
            </p>
          )}
        </div>

        {/* Services & Items Grid */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto">
          {shop.items.map((item) => {
            const canAfford = cash >= item.price;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-[#161b25] border border-white/10"
              >
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-white truncate">
                    {item.nameAr}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">{item.descAr}</div>
                </div>

                <button
                  onClick={() => handleBuy(item)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors whitespace-nowrap ${
                    canAfford
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span className="font-mono-nums">
                    {item.price === 0 ? 'مجاني' : `${item.price.toLocaleString('en-US')} دج`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-[#0d1016] flex items-center justify-between">
          <span className="text-xs text-stone-400">
            قرب سيارتك للمحل باش تستفاد من الصباغة والتصليح والتوربو
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
          >
            اخرج للشارع
          </button>
        </div>
      </div>
    </div>
  );
}
