import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Plus, Smile } from 'lucide-react';
import { CustomMood } from '@/hooks/useCustomMoods';

const COMMON_EMOJIS = ['😎','🥳','🤗','😇','🙃','🤔','😶','🥱','😮','🤯','😱','🥺','😭','🤬','🥴','🫠','🤧','😷','🤒','🥵','🥶','😑','🫤','😬','🙄'];

interface CustomMoodsManagerProps {
  customMoods: CustomMood[];
  loading: boolean;
  onAdd: (emoji: string, label: string, score: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CustomMoodsManager({ customMoods, loading, onAdd, onDelete }: CustomMoodsManagerProps) {
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState('😎');
  const [label, setLabel] = useState('');
  const [score, setScore] = useState(5);

  const handleAdd = async () => {
    if (!emoji || !label.trim()) return;
    await addMood(emoji, label.trim(), score);
    setLabel('');
    setEmoji('😎');
    setScore(5);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs">
          <Smile className="w-3.5 h-3.5" /> Personalizar humores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smile className="w-5 h-5 text-primary" /> Humores Personalizados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Add new */}
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Criar novo humor</p>

            <div>
              <Label className="text-xs mb-1 block">Escolha um emoji</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {COMMON_EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`text-xl p-1 rounded-md transition-all ${emoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-secondary'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={emoji}
                  onChange={e => setEmoji(e.target.value)}
                  placeholder="Ou cole um emoji aqui"
                  className="w-32 text-center text-lg"
                  maxLength={4}
                />
                <span className="text-2xl">{emoji}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Nome do humor</Label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Ex: Eufórica, Meditativa..."
                maxLength={20}
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Pontuação no gráfico: {score}</Label>
              <Slider
                value={[score]}
                onValueChange={([v]) => setScore(v)}
                min={1} max={10} step={1}
                className="mt-1"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>1 (ruim)</span><span>5 (neutro)</span><span>10 (ótimo)</span>
              </div>
            </div>

            <Button onClick={handleAdd} disabled={loading || !label.trim()} size="sm" className="gap-1.5 w-full">
              <Plus className="w-4 h-4" /> Adicionar humor
            </Button>
          </div>

          {/* Existing custom moods */}
          {customMoods.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Seus humores personalizados</p>
              <div className="space-y-1.5">
                {customMoods.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground">({m.score}/10)</span>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMood(m.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
