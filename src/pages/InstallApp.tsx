import { Smartphone, Apple, Monitor, Share, PlusSquare, MoreVertical, Download, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const steps = {
  ios: [
    { icon: Monitor, text: 'Abra o site clinipro.lovable.app no Safari do seu iPhone ou iPad.' },
    { icon: Share, text: 'Toque no botão de Compartilhar (ícone de quadrado com seta para cima) na barra inferior.' },
    { icon: PlusSquare, text: 'Role as opções e toque em "Adicionar à Tela de Início".' },
    { icon: ArrowRight, text: 'Confirme o nome "Evolução Diária" e toque em "Adicionar".' },
  ],
  android: [
    { icon: Monitor, text: 'Abra o site clinipro.lovable.app no Chrome do seu celular Android.' },
    { icon: MoreVertical, text: 'Toque nos três pontinhos (⋮) no canto superior direito.' },
    { icon: Download, text: 'Toque em "Instalar app" ou "Adicionar à tela inicial".' },
    { icon: ArrowRight, text: 'Confirme e o ícone aparecerá na sua tela inicial.' },
  ],
};

export default function InstallApp() {
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-foreground mb-1 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-primary" />
          Instalar no Celular
        </h1>
        <p className="text-sm text-muted-foreground">
          Use o Evolução Diária como um app nativo — sem precisar baixar na loja.
        </p>
      </div>

      <div className="space-y-6">
        {/* iOS */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Apple className="w-5 h-5" />
              iPhone / iPad
              <Badge variant="secondary" className="text-xs">Safari</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {steps.ios.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {i + 1}
                  </div>
                  <p className="text-sm text-foreground pt-1">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
              <strong>Importante:</strong> No iPhone, o app só pode ser instalado pelo Safari. Outros navegadores (Chrome, Firefox) não suportam essa função no iOS.
            </div>
          </CardContent>
        </Card>

        {/* Android */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Android
              <Badge variant="secondary" className="text-xs">Chrome</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {steps.android.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {i + 1}
                  </div>
                  <p className="text-sm text-foreground pt-1">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
              <strong>Dica:</strong> Em alguns celulares Android, o Chrome pode mostrar automaticamente um banner "Instalar app" na parte inferior da tela.
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-3">✨ Vantagens do app instalado</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Abre em tela cheia, sem barra do navegador</li>
              <li>• Ícone na tela inicial como qualquer app</li>
              <li>• Carregamento mais rápido</li>
              <li>• Funciona mesmo com conexão instável</li>
              <li>• Sem precisar baixar na App Store ou Play Store</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
