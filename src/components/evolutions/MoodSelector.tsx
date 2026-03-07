import { cn } from '@/lib/utils';
import { useCustomMoods } from '@/hooks/useCustomMoods';
import { CustomMoodsManager } from './CustomMoodsManager';

const DEFAULT_MOOD_OPTIONS = [
  { value: 'otima', emoji: '🤩', label: 'Ótima' },
  { value: 'muito_boa', emoji: '😄', label: 'Muito boa' },
  { value: 'boa', emoji: '😊', label: 'Boa' },
  { value: 'animada', emoji: '😁', label: 'Animada' },
  { value: 'tranquila', emoji: '😌', label: 'Tranquila' },
  { value: 'neutra', emoji: '😐', label: 'Neutra' },
  { value: 'cansada', emoji: '😴', label: 'Cansada' },
  { value: 'ansiosa', emoji: '😰', label: 'Ansiosa' },
  { value: 'ruim', emoji: '😟', label: 'Ruim' },
  { value: 'muito_ruim', emoji: '😢', label: 'Muito ruim' },
  { value: 'agitada', emoji: '😤', label: 'Agitada' },
  { value: 'triste', emoji: '😔', label: 'Triste' },
  { value: 'irritada', emoji: '😠', label: 'Irritada' },
  { value: 'assustada', emoji: '😨', label: 'Assustada' },
  { value: 'confusa', emoji: '😵', label: 'Confusa' },
];

interface MoodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  const { customMoods, addMood, deleteMood, loading } = useCustomMoods();

  const allMoods = [
    ...DEFAULT_MOOD_OPTIONS,
    ...customMoods.map(m => ({ value: m.id, emoji: m.emoji, label: m.label })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">Humor da Sessão</span>
        <CustomMoodsManager
          customMoods={customMoods}
          loading={loading}
          onAdd={addMood}
          onDelete={deleteMood}
        />
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {allMoods.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(value === m.value ? '' : m.value)}
            className={cn(
              "flex flex-col items-center gap-0.5 p-1.5 rounded-lg border-2 transition-all text-center w-[58px]",
              value === m.value
                ? "border-primary bg-primary/10"
                : "border-transparent bg-secondary hover:bg-secondary/80"
            )}
            title={m.label}
          >
            <span className="text-xl">{m.emoji}</span>
            <span className="text-[9px] text-muted-foreground leading-tight">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { DEFAULT_MOOD_OPTIONS };
export type { };
