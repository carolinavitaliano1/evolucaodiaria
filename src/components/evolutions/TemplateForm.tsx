import { EvolutionTemplate, TemplateField } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  template: EvolutionTemplate;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  showAiImprove?: boolean;
  isImprovingText?: boolean;
  onImproveText?: (text: string) => Promise<string>;
}

export default function TemplateForm({ template, values, onChange, showAiImprove, isImprovingText, onImproveText }: Props) {
  const updateValue = (fieldId: string, value: any) => {
    onChange({ ...values, [fieldId]: value });
  };

  const handleImproveField = async (fieldId: string) => {
    if (!onImproveText) return;
    const currentVal = values[fieldId];
    if (!currentVal || typeof currentVal !== 'string' || !currentVal.trim()) return;
    const improved = await onImproveText(currentVal);
    if (improved && improved !== currentVal) {
      onChange({ ...values, [fieldId]: improved });
      toast.success('Texto melhorado com IA!');
    }
  };

  const renderField = (field: TemplateField) => {
    const value = values[field.id];
    const isTextField = field.type === 'text' || field.type === 'textarea';

    return (
      <div>
        {field.type === 'text' && (
          <Input
            value={value || ''}
            onChange={e => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || `Preencha ${field.label.toLowerCase()}`}
          />
        )}
        {field.type === 'textarea' && (
          <Textarea
            value={value || ''}
            onChange={e => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || `Descreva ${field.label.toLowerCase()}`}
            rows={3}
          />
        )}
        {field.type === 'number' && (
          <Input
            type="number"
            value={value || ''}
            onChange={e => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || '0'}
          />
        )}
        {field.type === 'select' && (
          <Select value={value || ''} onValueChange={v => updateValue(field.id, v)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Selecione...'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).filter(o => o.trim()).map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {field.type === 'checkbox' && (
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              checked={value || false}
              onCheckedChange={v => updateValue(field.id, v)}
            />
            <span className="text-sm text-muted-foreground">{field.placeholder || 'Marcar como realizado'}</span>
          </div>
        )}
        {showAiImprove && isTextField && value && typeof value === 'string' && value.trim() && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 gap-1 text-xs h-7"
            disabled={isImprovingText}
            onClick={() => handleImproveField(field.id)}
          >
            {isImprovingText ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            Melhorar com IA
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          {template.name}
        </CardTitle>
        {template.description && (
          <p className="text-xs text-muted-foreground">{template.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {template.fields.map(field => (
          <div key={field.id}>
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {renderField(field)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
