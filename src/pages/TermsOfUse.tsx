import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowLeft } from 'lucide-react';

export default function TermsOfUse() {
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Termos de Uso</h1>
        <p className="text-muted-foreground mb-8">Última atualização: março de 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao criar uma conta ou utilizar o <strong className="text-foreground">Evolução Diária</strong>, você concorda com estes Termos de Uso. Se não concordar, não utilize o serviço. O uso continuado após alterações nestas condições implica aceitação das novas versões.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground leading-relaxed">
              O Evolução Diária é uma plataforma SaaS (Software as a Service) de gestão clínica destinada a profissionais de saúde. O serviço inclui gestão de pacientes, evoluções clínicas, agenda, controle financeiro, relatórios com inteligência artificial e portal do paciente, entre outras funcionalidades.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Elegibilidade e Conta</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Você deve ter 18 anos ou mais para criar uma conta.</li>
              <li>As informações de cadastro devem ser verídicas e mantidas atualizadas.</li>
              <li>Você é responsável por manter a confidencialidade de suas credenciais de acesso.</li>
              <li>Uma conta é para uso individual; não é permitido compartilhar credenciais entre múltiplos usuários (exceto pelo recurso de equipe disponível nos planos correspondentes).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Assinatura e Pagamentos</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>O serviço é oferecido mediante assinatura mensal ou anual, com período de teste gratuito de 15 dias.</li>
              <li>Os valores são cobrados antecipadamente no início de cada período de faturamento.</li>
              <li>O cancelamento pode ser realizado a qualquer momento; o acesso permanece até o fim do período pago.</li>
              <li>Não realizamos reembolsos proporcionais por cancelamento antes do fim do período.</li>
              <li>Preços podem ser reajustados com aviso prévio de 30 dias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Uso Aceitável</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">Você concorda em utilizar a plataforma somente para fins lícitos. É proibido:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Inserir dados falsos, enganosos ou de terceiros sem autorização.</li>
              <li>Usar a plataforma para atividades ilegais ou antiéticas.</li>
              <li>Tentar acessar sistemas ou dados de outros usuários sem permissão.</li>
              <li>Realizar engenharia reversa, descompilar ou copiar o software.</li>
              <li>Sobrecarregar intencionalmente a infraestrutura do serviço.</li>
              <li>Revender ou sublicenciar o acesso à plataforma para terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Responsabilidades do Profissional</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você, como profissional de saúde, é o <strong className="text-foreground">controlador dos dados dos seus pacientes</strong> conforme a LGPD. É sua responsabilidade:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
              <li>Obter o consentimento adequado dos seus pacientes para o tratamento de seus dados.</li>
              <li>Garantir a veracidade das informações registradas.</li>
              <li>Utilizar as funcionalidades em conformidade com as normas do seu Conselho profissional.</li>
              <li>Exportar e manter cópias locais dos dados de pacientes que julgar necessário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Integração com Google Calendar</h2>
            <p className="text-muted-foreground leading-relaxed">
              A integração com o Google Calendar é opcional e fornece acesso somente de leitura aos seus eventos. Ao ativar esta integração, você autoriza o Evolução Diária a acessar seus dados do Google Calendar conforme descrito em nossa Política de Privacidade e nos Termos de Serviço do Google.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Propriedade Intelectual</h2>
            <p className="text-muted-foreground leading-relaxed">
              Todo o código, design, marca, textos e funcionalidades da plataforma são de propriedade do Evolução Diária. O uso do serviço não transfere qualquer direito de propriedade intelectual para o usuário.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Os dados inseridos por você (evoluções, fichas, documentos) permanecem de sua propriedade. Concedemos a você uma licença não exclusiva para armazenar e acessar esses dados por meio da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Disponibilidade do Serviço</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nos esforçamos para manter a plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência. Não nos responsabilizamos por perdas decorrentes de indisponibilidade temporária.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground leading-relaxed">
              O Evolução Diária não se responsabiliza por decisões clínicas tomadas com base nas informações registradas na plataforma. A ferramenta é um auxílio organizacional; a responsabilidade clínica é sempre do profissional habilitado.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Nossa responsabilidade total perante o usuário limita-se ao valor pago nos últimos 12 meses de assinatura.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Encerramento de Conta</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você pode encerrar sua conta a qualquer momento. Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos, mediante notificação prévia exceto em casos graves.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Após o encerramento, seus dados serão retidos por até 90 dias para fins de segurança, após o qual serão permanentemente excluídos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Lei Aplicável e Foro</h2>
            <p className="text-muted-foreground leading-relaxed">
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer disputas, salvo disposição legal em contrário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas sobre estes Termos, entre em contato pelo e-mail: <a href="mailto:evolucaodiaria.contato@gmail.com" className="text-primary underline">evolucaodiaria.contato@gmail.com</a>
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
