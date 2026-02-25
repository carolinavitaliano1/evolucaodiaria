import { EvolutionTemplate, TemplateField } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface Props {
  template: EvolutionTemplate;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

export default function TemplateForm({ template, values, onChange }: Props) {
  const updateValue = (fieldId: string, value: any) => {
    onChange({ ...values, [fieldId]: value });
  };

  const renderField = (field: TemplateField) => {
    const value = values[field.id];

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={e => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || `Preencha ${field.label.toLowerCase()}`}
          />
        );
      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={e => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || `Descreva ${field.label.toLowerCase()}`}
            rows={3}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={e => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || '0'}
          />
        );
      case 'select':
        return (
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
        );
      case 'checkbox':
        return (
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              checked={value || false}
              onCheckedChange={v => updateValue(field.id, v)}
            />
            <span className="text-sm text-muted-foreground">{field.placeholder || 'Marcar como realizado'}</span>
          </div>
        );
      default:
        return null;
    }
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
