import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type NavItem = {
  label: string;
  sublabel?: string;
};

type Props = {
  items: NavItem[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

export default function NavSelector({ items, selectedIndex, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 選択アイテムにスクロール
  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  const selected = items[selectedIndex];

  return (
    <div ref={containerRef} className="relative w-72">
      {/* トリガーボタン */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`
          w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border
          ${open
            ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-sm'
            : 'bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200'
          }
        `}
      >
        <div className="flex-1 text-left min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{selected?.label}</p>
          {selected?.sublabel && (
            <p className="truncate text-[11px] font-normal text-gray-500 leading-tight mt-0.5">
              {selected.sublabel}
            </p>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-purple-500" />
          : <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
        }
      </button>

      {/* ドロップダウンリスト */}
      {open && (
        <div
          ref={listRef}
          className="absolute top-full mt-1.5 left-0 w-full bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {items.map((item, i) => (
            <button
              key={i}
              data-selected={i === selectedIndex}
              onClick={() => { onChange(i); setOpen(false); }}
              className={`
                w-full px-4 py-3 text-left transition-colors
                ${i === selectedIndex
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-700 hover:bg-gray-50'
                }
                ${i < items.length - 1 ? 'border-b border-gray-100' : ''}
              `}
            >
              <p className={`text-sm truncate ${i === selectedIndex ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </p>
              {item.sublabel && (
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{item.sublabel}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
