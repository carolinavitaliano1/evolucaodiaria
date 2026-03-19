import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-1.5 rounded-lg gradient-primary shadow-glow">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Evolução Diária</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground mb-8">Última atualização: março de 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Quem somos</h2>
            <p className="text-muted-foreground leading-relaxed">
              O <strong className="text-foreground">Evolução Diária</strong> é um sistema de gestão clínica desenvolvido para profissionais de saúde (psicólogos, fonoaudiólogos, terapeutas ocupacionais, fisioterapeutas e demais profissionais que atendem em clínicas). Operamos como controladores dos dados pessoais que você nos fornece ao criar e utilizar sua conta.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Para dúvidas sobre esta política, entre em contato pelo e-mail: <a href="mailto:evolucaodiaria.contato@gmail.com" className="text-primary underline">evolucaodiaria.contato@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Quais dados coletamos</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Dados de cadastro:</strong> nome, e-mail e senha ao criar uma conta.</li>
              <li><strong className="text-foreground">Dados de perfil profissional:</strong> CBO, número de registro, foto e informações clínicas que você optar por preencher.</li>
              <li><strong className="text-foreground">Dados de pacientes:</strong> informações clínicas, evoluções, financeiro e documentos que o profissional registrar no sistema. Esses dados são de responsabilidade do profissional (você), que atua como controlador perante seus pacientes.</li>
              <li><strong className="text-foreground">Dados de uso:</strong> logs de acesso, eventos de navegação e informações técnicas do dispositivo para fins de segurança e melhoria do serviço.</li>
              <li><strong className="text-foreground">Dados de pagamento:</strong> processados com segurança por terceiros (Stripe). Não armazenamos dados de cartão de crédito.</li>
              <li><strong className="text-foreground">Dados do Google Calendar:</strong> quando você conecta sua conta do Google, acessamos apenas a leitura de eventos do Google Calendar (escopo <code>calendar.readonly</code>). Não modificamos, criamos ou excluímos eventos no seu calendário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Como usamos seus dados</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Prestar e melhorar os serviços da plataforma.</li>
              <li>Autenticar seu acesso e garantir a segurança da conta.</li>
              <li>Processar pagamentos de assinatura.</li>
              <li>Exibir eventos do Google Calendar na sua agenda dentro da plataforma (somente leitura).</li>
              <li>Enviar comunicações transacionais (confirmação de cadastro, recuperação de senha).</li>
              <li>Enviar comunicações de produto e novidades, das quais você pode se descadastrar a qualquer momento.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Integração com o Google</h2>
            <p className="text-muted-foreground leading-relaxed">
              A integração com o Google Calendar é opcional. Quando ativada, utilizamos o protocolo OAuth 2.0 do Google para obter autorização de leitura da sua agenda. Solicitamos apenas o escopo <code className="bg-muted px-1 rounded text-sm">https://www.googleapis.com/auth/calendar.readonly</code>.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Não compartilhamos seus tokens de acesso com terceiros. Você pode revogar o acesso a qualquer momento diretamente nas configurações da sua Conta Google em <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary underline">myaccount.google.com/permissions</a> ou dentro da plataforma em Agenda → Desconectar Google Calendar.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              O uso de informações recebidas das APIs do Google obedece à <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de Uso Limitado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Compartilhamento de dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Não vendemos seus dados pessoais. Compartilhamos informações apenas com:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
              <li><strong className="text-foreground">Supabase:</strong> infraestrutura de banco de dados e autenticação.</li>
              <li><strong className="text-foreground">Stripe:</strong> processamento de pagamentos.</li>
              <li><strong className="text-foreground">Google:</strong> somente para autenticar e ler eventos do calendário, quando você autorizar explicitamente.</li>
              <li><strong className="text-foreground">Autoridades legais:</strong> quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Segurança dos dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos criptografia em trânsito (TLS) e em repouso. O acesso aos dados é restrito ao titular da conta. Adotamos boas práticas de segurança da informação para proteger seus dados contra acesso não autorizado, perda ou destruição.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Retenção de dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Seus dados são mantidos enquanto sua conta estiver ativa. Após o cancelamento ou exclusão da conta, podemos reter dados por até 90 dias para fins de segurança e backup, após o qual são permanentemente excluídos, salvo obrigação legal em contrário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Seus direitos (LGPD)</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Confirmar a existência de tratamento de seus dados.</li>
              <li>Acessar seus dados.</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.</li>
              <li>Solicitar a portabilidade dos dados.</li>
              <li>Revogar consentimentos concedidos.</li>
              <li>Se opor a tratamento realizado com fundamento em legítimo interesse.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Para exercer seus direitos, envie um e-mail para <a href="mailto:evolucaodiaria.contato@gmail.com" className="text-primary underline">evolucaodiaria.contato@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos cookies essenciais para autenticação e funcionamento da plataforma. Não utilizamos cookies de rastreamento de terceiros para publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Alterações nesta política</h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos atualizar esta Política periodicamente. Notificaremos você por e-mail ou por aviso na plataforma sobre mudanças relevantes. O uso continuado após a notificação implica concordância com a versão atualizada.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border py-8 px-4 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Evolução Diária</span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <button onClick={() => navigate('/privacidade')} className="hover:text-foreground transition-colors">Política de Privacidade</button>
            <button onClick={() => navigate('/termos')} className="hover:text-foreground transition-colors">Termos de Uso</button>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Evolução Diária.</p>
        </div>
      </footer>
    </div>
  );
}
