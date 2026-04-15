import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import ImageExt from '@tiptap/extension-image';
import { VariableNode } from './VariableNode';
import { useEffect, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Heading2, Heading3, Tag,
  ImageIcon, Minus, Maximize2, Minimize2
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
  { key: 'area_clinica', label: 'Área Clínica (Carimbo)' },
  { key: 'data_atual', label: 'Data Atual' },
  { key: 'cidade_atual', label: 'Cidade da Clínica' },
  { key: 'valor_sessao', label: 'Valor da Sessão' },
  { key: 'dia_atendimento', label: 'Dia de Atendimento' },
  { key: 'horario_atendimento', label: 'Horário de Atendimento' },
];

const IMAGE_SIZES = [
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '75%', value: '75%' },
  { label: '100%', value: '100%' },
];

// Extended Image extension that supports width attribute for resizing
const ResizableImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width') || el.style.width || null,
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { width: attrs.width, style: `width: ${attrs.width}` };
        },
      },
    };
  },
});

interface ContractEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function ContractEditor({ value, onChange }: ContractEditorProps) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [imageSelected, setImageSelected] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage.configure({ inline: false, allowBase64: true }),
      VariableNode,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      setImageSelected(editor.isActive('image'));
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value]);

  const insertVariable = useCallback((key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'contractVariable',
      attrs: { key },
    }).insertContent(' ').run();
  }, [editor]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor]);

  const setImageWidth = useCallback((width: string) => {
    if (!editor) return;
    editor.chain().focus().updateAttributes('image', { width }).run();
  }, [editor]);

  const insertHr = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap rounded-t-lg border border-border bg-muted/30 p-1">
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
        <ToolBtn active={false} onClick={() => imgInputRef.current?.click()} title="Inserir imagem / logo">
          <ImageIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

        {/* Image size controls - shown when image is selected */}
        {imageSelected && (
          <>
            <div className="w-px h-5 bg-border mx-0.5" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs px-2 border-primary/30 text-primary hover:bg-primary/5">
                  <Maximize2 className="w-3 h-3" /> Tamanho
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 px-1">Largura da imagem</p>
                <div className="flex gap-1">
                  {IMAGE_SIZES.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setImageWidth(s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}

        <ToolBtn active={false} onClick={insertHr} title="Linha horizontal">
          <Minus className="w-3.5 h-3.5" />
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
                    title={v.label}
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

      {/* Editor — page-like appearance */}
      <div className="rounded-b-lg border border-t-0 border-input bg-muted/40 p-4 sm:p-6 overflow-auto max-h-[600px]">
        <div className="mx-auto bg-background shadow-md rounded border border-border/50" style={{ maxWidth: 720, minHeight: 800 }}>
          <EditorContent
            editor={editor}
            className="contract-editor prose prose-sm max-w-none p-6 sm:p-10 text-foreground focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[700px]"
          />
        </div>
      </div>

      {/* CSS for variable chips and images inside the editor */}
      <style>{`
        .contract-editor .contract-variable,
        .contract-editor span[data-variable] {
          background: hsl(var(--primary) / 0.1);
          color: hsl(var(--primary));
          border: 1px solid hsl(var(--primary) / 0.25);
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 11px;
          font-family: ui-monospace, monospace;
          white-space: nowrap;
          cursor: default;
          user-select: none;
        }
        .contract-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8px auto;
          display: block;
          cursor: pointer;
        }
        .contract-editor img.ProseMirror-selectednode {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }
        .contract-editor hr {
          border: none;
          border-top: 1px solid hsl(var(--border));
          margin: 16px 0;
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
