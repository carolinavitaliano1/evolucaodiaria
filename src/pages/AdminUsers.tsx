import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Mail, MessageCircle, Search, Send, Users } from "lucide-react";
import { toast } from "sonner";

const OWNER_EMAILS = ["carolinavitaliano1@gmail.com"];

interface AppUser {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  trial_until: string | null;
  created_at: string;
}

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function buildWhatsAppLink(phone: string | null, message: string) {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  // Brazilian phones: prepend 55 if missing
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export default function AdminUsers() {
  const { user, sessionReady, loading: authLoading } = useAuth();
  const isOwner = !!user?.email && OWNER_EMAILS.includes(user.email.toLowerCase());

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Email dialog
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [emailTargets, setEmailTargets] = useState<AppUser[]>([]);

  // WhatsApp dialog (single recipient)
  const [waOpen, setWaOpen] = useState(false);
  const [waTarget, setWaTarget] = useState<AppUser | null>(null);
  const [waMessage, setWaMessage] = useState("");

  useEffect(() => {
    if (!isOwner) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "list" },
      });
      if (error) {
        toast.error("Erro ao carregar usuários: " + error.message);
      } else {
        setUsers((data?.users ?? []) as AppUser[]);
      }
      setLoading(false);
    })();
  }, [isOwner]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  if (!sessionReady || authLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!isOwner) return <Navigate to="/dashboard" replace />;

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map(u => u.user_id)));
    else setSelected(new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const openEmailFor = (targets: AppUser[]) => {
    const withEmail = targets.filter(t => !!t.email);
    if (!withEmail.length) {
      toast.error("Nenhum destinatário com email válido.");
      return;
    }
    setEmailTargets(withEmail);
    setEmailSubject("");
    setEmailMessage("");
    setEmailOpen(true);
  };

  const openWaFor = (u: AppUser) => {
    if (!onlyDigits(u.phone)) {
      toast.error("Usuário sem telefone cadastrado.");
      return;
    }
    setWaTarget(u);
    setWaMessage(`Olá ${u.name ?? ""}, `);
    setWaOpen(true);
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast.error("Preencha assunto e mensagem.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "send_email",
        subject: emailSubject,
        message: emailMessage,
        recipients: emailTargets.map(t => ({ email: t.email, name: t.name ?? "" })),
      },
    });
    setSending(false);
    if (error) {
      toast.error("Erro ao enviar: " + error.message);
      return;
    }
    toast.success(`Enviado para ${data?.sent ?? 0}/${data?.total ?? 0} destinatários.`);
    setEmailOpen(false);
  };

  const sendWa = () => {
    if (!waTarget) return;
    const link = buildWhatsAppLink(waTarget.phone, waMessage);
    if (!link) {
      toast.error("Telefone inválido.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
    setWaOpen(false);
  };

  const selectedUsers = users.filter(u => selected.has(u.user_id));
  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.user_id));

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Usuários do App
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lista completa de usuários. Envie email ou WhatsApp para um ou vários.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            disabled={selectedUsers.length === 0}
            onClick={() => openEmailFor(selectedUsers)}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email em massa ({selectedUsers.length})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-md"
            />
            <span className="text-sm text-muted-foreground ml-auto">
              {filtered.length} de {users.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="p-3 text-left w-10">
                      <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} />
                    </th>
                    <th className="p-3 text-left">Nome</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">WhatsApp</th>
                    <th className="p-3 text-left">Cadastro</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const hasEmail = !!u.email;
                    const hasPhone = !!onlyDigits(u.phone);
                    const inTrial = u.trial_until && new Date(u.trial_until) > new Date();
                    return (
                      <tr key={u.user_id} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <Checkbox
                            checked={selected.has(u.user_id)}
                            onCheckedChange={(c) => toggleOne(u.user_id, !!c)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{u.name || "—"}</div>
                          {inTrial && <Badge variant="secondary" className="mt-1 text-[10px]">Trial</Badge>}
                        </td>
                        <td className="p-3 text-muted-foreground break-all">{u.email || "—"}</td>
                        <td className="p-3 text-muted-foreground">{u.phone || "—"}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!hasEmail}
                              onClick={() => openEmailFor([u])}
                              title="Enviar email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!hasPhone}
                              onClick={() => openWaFor(u)}
                              title="Enviar WhatsApp"
                              className="text-green-600 hover:text-green-700"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar email — {emailTargets.length} destinatário(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Assunto</label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Aviso importante..." />
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea
                value={emailMessage}
                onChange={e => setEmailMessage(e.target.value)}
                placeholder="Escreva o conteúdo do email..."
                rows={8}
              />
            </div>
            <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
              Para: {emailTargets.map(t => t.email).join(", ")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)} disabled={sending}>Cancelar</Button>
            <Button onClick={sendEmail} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Dialog */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>WhatsApp — {waTarget?.name || waTarget?.phone}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={waMessage}
            onChange={e => setWaMessage(e.target.value)}
            placeholder="Mensagem..."
            rows={6}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaOpen(false)}>Cancelar</Button>
            <Button onClick={sendWa} className="bg-green-600 hover:bg-green-700">
              <MessageCircle className="w-4 h-4 mr-2" />
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}