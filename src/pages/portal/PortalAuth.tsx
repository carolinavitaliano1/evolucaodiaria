import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function PortalAuth() {
  const { user, sessionReady, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // First-access (invite token) state
  const [inviteEmail, setInviteEmail] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If user is already logged in and is a portal user → redirect
  useEffect(() => {
    if (!sessionReady || !user) return;
    supabase
      .from('patient_portal_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        if (data) navigate('/portal/home', { replace: true });
      });
  }, [user, sessionReady, navigate]);

  // If token present, fetch email
  useEffect(() => {
    if (!token) return;
    setTokenLoading(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-portal-account?token=${token}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setTokenError(data.error); }
        else { setInviteEmail(data.email); }
      })
      .catch(() => setTokenError('Erro ao validar convite'))
      .finally(() => setTokenLoading(false));
  }, [token]);

  // Activate account (first access)
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-portal-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Sign in after activation
      const { error: signInError } = await signIn(data.email, password);
      if (signInError) throw signInError;
      toast.success('Conta criada! Bem-vindo ao portal 🎉');
      navigate('/portal/home', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  // Regular login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;

      // Check if portal user
      const { data: account } = await supabase
        .from('patient_portal_accounts')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!account) {
        await supabase.auth.signOut();
        throw new Error('Este login é exclusivo para pacientes. Acesse o aplicativo principal para terapeutas.');
      }
      navigate('/portal/home', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-primary-foreground text-xl font-bold">ED</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Portal do Paciente</h1>
          <p className="text-muted-foreground text-sm mt-1">Evolução Diária</p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">

          {/* Token loading state */}
          {token && tokenLoading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validando seu convite...</p>
            </div>
          )}

          {/* Token error */}
          {token && !tokenLoading && tokenError && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="font-semibold text-foreground mb-2">Convite inválido</p>
              <p className="text-sm text-muted-foreground mb-4">{tokenError}</p>
              <p className="text-xs text-muted-foreground">Solicite um novo convite ao seu terapeuta.</p>
            </div>
          )}

          {/* First-access form (token valid) */}
          {token && !tokenLoading && !tokenError && inviteEmail && (
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="text-center mb-2">
                <KeyRound className="w-8 h-8 text-primary mx-auto mb-2" />
                <h2 className="font-semibold text-foreground">Primeiro acesso</h2>
                <p className="text-xs text-muted-foreground mt-1">Crie sua senha para acessar o portal</p>
              </div>
              <div>
                <Label className="text-xs">Seu e-mail</Label>
                <Input value={inviteEmail} disabled className="mt-1 bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-xs">Criar senha</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar conta e entrar
              </Button>
            </form>
          )}

          {/* Regular login (no token) */}
          {!token && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="font-semibold text-foreground">Entrar no portal</h2>
                <p className="text-xs text-muted-foreground mt-1">Use o e-mail e senha cadastrados</p>
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Senha</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Entrar
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso exclusivo para pacientes cadastrados.
        </p>
      </div>
    </div>
  );
}
