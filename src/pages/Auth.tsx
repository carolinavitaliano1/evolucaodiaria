import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, BookOpen } from 'lucide-react';

export default function Auth() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [pendingInvite, setPendingInvite] = useState<{ memberId: string; orgId: string } | null>(null);
  const inviteAcceptedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    const org = params.get('org');
    const reset = params.get('reset');
    if (invite && org) setPendingInvite({ memberId: invite, orgId: org });
    if (reset === 'true') setShowNewPassword(true);

    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setShowNewPassword(true);
    }
  }, []);

  useEffect(() => {
    // Listen only for PASSWORD_RECOVERY event to show the new-password form
    // (AuthContext already handles all other auth state changes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setShowNewPassword(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-accept invite: when a logged-in user arrives with invite params,
  // call accept-invite. Also detects pending invites by email for users
  // who log in without the URL params (e.g. returning via normal login).
  useEffect(() => {
    if (!user || inviteAcceptedRef.current) return;

    async function tryAcceptInvite(memberId?: string) {
      inviteAcceptedRef.current = true;

      if (memberId) {
        // Accept by specific member ID (URL param flow)
        const { data, error } = await supabase.functions.invoke('accept-invite', {
          body: { member_id: memberId },
        });
        if (!error && data?.success) {
          toast.success(`🎉 Bem-vindo à equipe ${data.organization?.name}!`, {
            description: `Você entrou como ${data.role === 'admin' ? 'Administrador' : 'Profissional'}.`,
          });
        }
        return;
      }

      // No URL param — check if there's a pending invite matching this email
      const { data: pending } = await supabase
        .from('organization_members')
        .select('id, organization_id, role')
        .eq('email', user!.email ?? '')
        .eq('status', 'pending')
        .limit(1)
        .single();

      if (pending) {
        const { data, error } = await supabase.functions.invoke('accept-invite', {
          body: { member_id: pending.id },
        });
        if (!error && data?.success) {
          toast.success(`🎉 Bem-vindo à equipe ${data.organization?.name}!`, {
            description: `Você entrou como ${data.role === 'admin' ? 'Administrador' : 'Profissional'}.`,
          });
        }
      }
    }

    if (pendingInvite) {
      tryAcceptInvite(pendingInvite.memberId);
    } else {
      tryAcceptInvite();
    }
  }, [user, pendingInvite]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const isRecoveryFlow = showNewPassword ||
    window.location.hash.includes('type=recovery') ||
    new URLSearchParams(window.location.search).get('reset') === 'true';

  if (!loading && user && !isRecoveryFlow) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      toast.error('Erro ao entrar', {
        description: error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message,
      });
    } else {
      toast.success('Bem-vindo de volta!');
    }
    setIsSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    if (error) {
      toast.error('Erro ao criar conta', { description: error.message });
    } else {
      toast.success('Conta criada com sucesso!', { description: 'Você já pode acessar o sistema.' });
    }
    setIsSubmitting(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await resetPassword(resetEmail);
    if (error) {
      toast.error('Erro ao enviar email', { description: error.message });
    } else {
      toast.success('Email enviado!', { description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      setShowForgotPassword(false);
      setResetEmail('');
    }
    setIsSubmitting(false);
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error('Erro ao atualizar senha', { description: error.message });
    } else {
      toast.success('Senha atualizada com sucesso!', { description: 'Você já pode entrar com a nova senha.' });
      window.history.replaceState(null, '', window.location.pathname);
      setShowNewPassword(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      await supabase.auth.signOut();
    }
    setIsSubmitting(false);
  };

  const Logo = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      <div className="p-2 rounded-lg bg-primary/10">
        <BookOpen className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Evolução Diária</h1>
    </div>
  );

  if (showNewPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md">
          <Logo />
          <Card>
            <form onSubmit={handleNewPassword}>
              <CardHeader>
                <CardTitle>Criar Nova Senha</CardTitle>
                <CardDescription>Digite e confirme sua nova senha de acesso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input id="new-password" type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password-confirm">Confirmar Nova Senha</Label>
                  <Input id="new-password-confirm" type="password" placeholder="Repita a nova senha" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar Nova Senha'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md">
          <Logo />
          <Card>
            <form onSubmit={handleResetPassword}>
              <CardHeader>
                <CardTitle>Recuperar Senha</CardTitle>
                <CardDescription>Digite seu email para receber um link de recuperação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" placeholder="seu@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : 'Enviar Link de Recuperação'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgotPassword(false)}>
                  Voltar para o login
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <Logo />

        <Card>
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <CardTitle>Bem-vindo de volta</CardTitle>
                  <CardDescription>Entre com suas credenciais para acessar o sistema</CardDescription>
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="button" variant="link" className="px-0 text-sm text-muted-foreground" onClick={() => setShowForgotPassword(true)}>
                    Esqueceu a senha?
                  </Button>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : 'Entrar'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <CardTitle>Criar nova conta</CardTitle>
                  <CardDescription>Preencha os dados abaixo para começar</CardDescription>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome</Label>
                    <Input id="signup-name" type="text" placeholder="Seu nome" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input id="signup-password" type="password" placeholder="Mínimo 6 caracteres" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                    <Input id="signup-confirm-password" type="password" placeholder="Repita a senha" value={signupConfirmPassword} onChange={(e) => setSignupConfirmPassword(e.target.value)} required />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</> : 'Criar Conta'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <div className="text-center mt-4 space-y-2">
          <Button variant="outline" className="w-full" onClick={() => window.location.href = '/portal/auth'}>
            Acessar Portal do Paciente
          </Button>
          <p className="text-sm text-muted-foreground">
            Sistema de gestão para profissionais de saúde
          </p>
        </div>
      </div>
    </div>
  );
}
