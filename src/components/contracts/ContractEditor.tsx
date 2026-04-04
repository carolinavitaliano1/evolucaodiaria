import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Heading2, Heading3, Tag
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const CONTRACT_VARIABLES = [
  { key: 'nome_paciente', label: 'Nome do Paciente' },
  { key: 'cpf_paciente', label: 'CPF do Paciente' },
  { key: 'rg_paciente', label: 'RG do Paciente' },
  { key: 'endereco_paciente', label: 'Endereço do Paciente' },
  { key: 'data_nascimento', label: 'Data de Nascimento' },
  { key: 'nome_profissional', label: 'Nome do Profissional' },
  { key: 'registro_profissional', label: 'Registro Profissional' },
  { key: 'cbo_profissional', label: 'CBO do Profissional' },
  { key: 'data_atual', label: 'Data Atual' },
  { key: 'cidade_atual', label: 'Cidade da Clínica' },
  { key: 'valor_sessao', label: 'Valor da Sessão' },
  { key: 'dia_atendimento', label: 'Dia de Atendimento' },
  { key: 'horario_atendimento', label: 'Horário de Atendimento' },
];

interface ContractEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function ContractEditor({ value, onChange }: ContractEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value]);

  const insertVariable = useCallback((key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`<span data-type="variable" class="contract-variable">{{${key}}}</span>&nbsp;`).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap rounded-lg border border-border bg-muted/30 p-1">
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-border mx-0.5" />
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título">
          <Heading2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Subtítulo">
          <Heading3 className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-border mx-0.5" />
        <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Esquerda">
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centro">
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Direita">
          <AlignRight className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificado">
          <AlignJustify className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-border mx-0.5" />
        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-border mx-0.5" />
        {/* Variables dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs px-2 border-primary/30 text-primary hover:bg-primary/5">
              <Tag className="w-3 h-3" /> Variáveis
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <p className="text-[11px] font-semibold text-foreground mb-2 px-1">Variáveis Disponíveis</p>
            <ScrollArea className="max-h-[280px]">
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono',
                      'bg-primary/10 text-primary border border-primary/20',
                      'hover:bg-primary/20 hover:border-primary/40 transition-colors cursor-pointer'
                    )}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
              <div className="mt-2 px-1">
                <p className="text-[10px] text-muted-foreground">Clique para inserir a variável na posição do cursor.</p>
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor */}
      <div className="rounded-lg border border-input bg-background min-h-[260px] overflow-hidden">
        <EditorContent editor={editor} className="contract-editor prose prose-sm max-w-none p-3 text-foreground focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[240px]" />
      </div>

      {/* CSS for variable chips inside the editor */}
      <style>{`
        .contract-editor .contract-variable,
        .contract-editor span[data-type="variable"] {
          background: hsl(var(--primary) / 0.1);
          color: hsl(var(--primary));
          border: 1px solid hsl(var(--primary) / 0.25);
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 11px;
          font-family: ui-monospace, monospace;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', active && 'bg-primary/10 text-primary')}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}
