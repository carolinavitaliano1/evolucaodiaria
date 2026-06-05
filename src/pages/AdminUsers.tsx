import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Mail, MessageCircle, Search, Send, Users, Image as ImageIcon, Link as LinkIcon, Video, FileCode, Eye, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AdminContactsPanel } from "@/components/admin/AdminContactsPanel";

const OWNER_EMAILS = ["carolinavitaliano1@gmail.com"];

interface AppUser {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  trial_until: string | null;
  created_at: string;
  tier?: string;
  tier_label?: string;
  status?: string | null;
  subscription_end?: string | null;
  last_status?: string | null;
  last_status_ended_at?: string | null;
}

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function buildWhatsAppLink(phone: string | null, message: string) {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  // Brazilian phones: prepend 55 if missing
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-amber-100 text-amber-800 border-amber-300" },
  clinica_pro: { label: "Clínica Pro", className: "bg-violet-100 text-violet-800 border-violet-300" },
  pro: { label: "Pro", className: "bg-purple-100 text-purple-800 border-purple-300" },
  basic: { label: "Basic", className: "bg-blue-100 text-blue-800 border-blue-300" },
  legacy: { label: "Legacy", className: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  trial: { label: "Trial", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  free: { label: "Sem assinatura", className: "bg-muted text-muted-foreground border-border" },
};

const LAST_STATUS_LABEL: Record<string, string> = {
  canceled: "cancelado",
  incomplete_expired: "trial expirado",
  unpaid: "não pago",
};

const EMAIL_TEMPLATES: Array<{ id: string; label: string; subject: string; html: string }> = [
  {
    id: "boas-vindas",
    label: "💜 Boas-vindas",
    subject: "Bem-vindo(a) à Evolução Diária!",
    html: `<p>Que alegria ter você por aqui! 🎉</p>
<p>A Evolução Diária foi feita para tornar seu dia a dia clínico mais simples, organizado e seguro.</p>
<p><strong>Próximos passos:</strong></p>
<ul>
  <li>Cadastre seu primeiro paciente</li>
  <li>Monte sua agenda</li>
  <li>Explore os módulos de especialidade</li>
</ul>
<p style="text-align:center;margin:24px 0;">
  <a href="https://evolucaodiaria.app.br" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Acessar agora</a>
</p>
<p>Qualquer dúvida, é só responder este email. 💜</p>`,
  },
  {
    id: "novidade",
    label: "✨ Nova funcionalidade",
    subject: "Novidade na Evolução Diária ✨",
    html: `<p>Temos uma novidade fresquinha para você! 🚀</p>
<p><strong>O que mudou:</strong></p>
<ul>
  <li>[descreva a novidade aqui]</li>
</ul>
<p>Entre no app e confira.</p>
<p style="text-align:center;margin:24px 0;">
  <img src="https://media.giphy.com/media/26ufnwz3wDUli7GU0/giphy.gif" alt="Novidade" style="max-width:300px;border-radius:12px;"/>
</p>`,
  },
  {
    id: "lembrete",
    label: "🔔 Lembrete",
    subject: "Um lembrete carinhoso 💜",
    html: `<p>Passando para lembrar você de:</p>
<blockquote style="border-left:4px solid #7c3aed;padding:8px 16px;background:#f5f3ff;margin:16px 0;color:#4c1d95;">
  [escreva o lembrete aqui]
</blockquote>
<p>Contamos com você! 💜</p>`,
  },
  {
    id: "promo",
    label: "🎁 Oferta especial",
    subject: "Uma oferta especial para você 🎁",
    html: `<p>Olá! Preparamos uma <strong>oferta exclusiva</strong> para você.</p>
<div style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;padding:24px;border-radius:12px;text-align:center;margin:16px 0;">
  <h2 style="margin:0 0 8px 0;">[Nome da oferta]</h2>
  <p style="margin:0;font-size:14px;opacity:.9;">Válido por tempo limitado</p>
</div>
<p style="text-align:center;">
  <a href="https://evolucaodiaria.app.br" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Aproveitar</a>
</p>`,
  },
];

export default function AdminUsers() {
  const { user, sessionReady, loading: authLoading } = useAuth();
  const isOwner = !!user?.email && OWNER_EMAILS.includes(user.email.toLowerCase());

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Email dialog
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailMode, setEmailMode] = useState<"text" | "html">("html");
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
    return users.filter(u => {
      if (planFilter !== "all" && (u.tier ?? "free") !== planFilter) return false;
      if (!q) return true;
      return (
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, planFilter]);

  const planStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      const t = u.tier ?? "free";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [users]);

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
    setEmailMode("html");
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
        mode: emailMode,
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

  const insertSnippet = (snippet: string) => {
    setEmailMessage(prev => (prev ? prev + "\n" + snippet : snippet));
  };

  const applyTemplate = (id: string) => {
    const t = EMAIL_TEMPLATES.find(x => x.id === id);
    if (!t) return;
    setEmailSubject(t.subject);
    setEmailMessage(t.html);
    setEmailMode("html");
  };

  const promptInsertImage = () => {
    const url = window.prompt("URL da imagem ou GIF:");
    if (!url) return;
    insertSnippet(`<p style="text-align:center;"><img src="${url}" alt="" style="max-width:100%;border-radius:12px;"/></p>`);
  };
  const promptInsertVideo = () => {
    const url = window.prompt("URL do vídeo (YouTube/Vimeo) ou link direto:");
    if (!url) return;
    insertSnippet(`<p style="text-align:center;"><a href="${url}" style="color:#7c3aed;font-weight:600;">▶ Assistir vídeo</a></p>`);
  };
  const promptInsertLink = () => {
    const url = window.prompt("URL do link:");
    if (!url) return;
    const label = window.prompt("Texto do link:", "Clique aqui") ?? "Clique aqui";
    insertSnippet(`<a href="${url}" style="color:#7c3aed;text-decoration:underline;">${label}</a>`);
  };
  const insertButton = () => {
    const url = window.prompt("URL do botão:", "https://evolucaodiaria.app.br");
    if (!url) return;
    const label = window.prompt("Texto do botão:", "Acessar") ?? "Acessar";
    insertSnippet(`<p style="text-align:center;margin:24px 0;"><a href="${url}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${label}</a></p>`);
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

  const renderTierBadge = (tier?: string) => {
    const meta = TIER_BADGE[tier ?? "free"] ?? TIER_BADGE.free;
    return <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Administração
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie usuários cadastrados e a base de contatos para convites.
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="contacts">Contatos & Convites</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="default"
              disabled={selectedUsers.length === 0}
              onClick={() => openEmailFor(selectedUsers)}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email em massa ({selectedUsers.length})
            </Button>
          </div>
          <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-md"
            />
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos ({users.length})</SelectItem>
                {Object.entries(TIER_BADGE).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label} ({planStats[key] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground md:ml-auto">
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
                    <th className="p-3 text-left">Plano</th>
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
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {renderTierBadge(u.tier)}
                            {u.subscription_end && (
                              <span className="text-[10px] text-muted-foreground">
                                até {new Date(u.subscription_end).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            {u.tier === "free" && u.last_status && (
                              <span className="text-[10px] text-muted-foreground">
                                Stripe: {LAST_STATUS_LABEL[u.last_status] ?? u.last_status}
                                {u.last_status_ended_at && ` em ${new Date(u.last_status_ended_at).toLocaleDateString("pt-BR")}`}
                              </span>
                            )}
                          </div>
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
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <AdminContactsPanel />
        </TabsContent>
      </Tabs>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar email — {emailTargets.length} destinatário(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Templates:</span>
              {EMAIL_TEMPLATES.map(t => (
                <Button key={t.id} size="sm" variant="outline" onClick={() => applyTemplate(t.id)}>
                  {t.label}
                </Button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium">Assunto</label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Aviso importante..." />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Mensagem</label>
              <div className="flex gap-1">
                <Button size="sm" variant={emailMode === "html" ? "default" : "outline"} onClick={() => setEmailMode("html")}>
                  <FileCode className="w-3 h-3 mr-1" /> HTML
                </Button>
                <Button size="sm" variant={emailMode === "text" ? "default" : "outline"} onClick={() => setEmailMode("text")}>
                  Texto
                </Button>
              </div>
            </div>
            {emailMode === "html" && (
              <div className="flex flex-wrap gap-1 p-2 bg-muted/40 rounded-md border">
                <Button size="sm" variant="ghost" onClick={promptInsertImage} title="Imagem/GIF">
                  <ImageIcon className="w-3.5 h-3.5 mr-1" /> Imagem/GIF
                </Button>
                <Button size="sm" variant="ghost" onClick={promptInsertVideo} title="Vídeo">
                  <Video className="w-3.5 h-3.5 mr-1" /> Vídeo
                </Button>
                <Button size="sm" variant="ghost" onClick={promptInsertLink} title="Link">
                  <LinkIcon className="w-3.5 h-3.5 mr-1" /> Link
                </Button>
                <Button size="sm" variant="ghost" onClick={insertButton} title="Botão">
                  🟣 Botão
                </Button>
                <Button size="sm" variant="ghost" onClick={() => insertSnippet("<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:16px 0;\"/>")}>
                  ➖ Divisor
                </Button>
                <Button size="sm" variant="ghost" onClick={() => insertSnippet("<h2 style=\"color:#5b21b6;\">Título</h2>")}>
                  H2
                </Button>
                <Button size="sm" variant="ghost" onClick={() => insertSnippet("<p><strong>Texto em negrito</strong></p>")}>
                  <strong>B</strong>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => insertSnippet("<ul><li>item 1</li><li>item 2</li></ul>")}>
                  • Lista
                </Button>
              </div>
            )}
            <Tabs defaultValue="editor">
              <TabsList>
                <TabsTrigger value="editor"><Pencil className="w-3 h-3 mr-1" /> Editor</TabsTrigger>
                <TabsTrigger value="preview"><Eye className="w-3 h-3 mr-1" /> Pré-visualização</TabsTrigger>
              </TabsList>
              <TabsContent value="editor">
                <Textarea
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  placeholder={emailMode === "html" ? "Cole HTML, GIFs, vídeos, links..." : "Escreva o conteúdo do email..."}
                  rows={16}
                  className="font-mono text-xs"
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md p-4 bg-white max-h-[420px] overflow-y-auto">
                  {emailMode === "html" ? (
                    <div dangerouslySetInnerHTML={{ __html: emailMessage || "<p style='color:#999'>Sem conteúdo</p>" }} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-foreground">{emailMessage || "Sem conteúdo"}</pre>
                  )}
                </div>
              </TabsContent>
            </Tabs>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>WhatsApp — {waTarget?.name || waTarget?.phone}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => { const u = prompt("URL da imagem/GIF/vídeo:"); if (u) setWaMessage(p => p + "\n" + u); }}>
                <ImageIcon className="w-3.5 h-3.5 mr-1" /> Mídia
              </Button>
              <Button size="sm" variant="outline" onClick={() => { const u = prompt("URL:"); if (u) setWaMessage(p => p + " " + u); }}>
                <LinkIcon className="w-3.5 h-3.5 mr-1" /> Link
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWaMessage(p => p + " *texto em negrito*")}>
                <strong>*B*</strong>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWaMessage(p => p + " _itálico_")}>
                <em>_I_</em>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWaMessage(p => p + "\n• item")}>
                • Lista
              </Button>
            </div>
            <Textarea
              value={waMessage}
              onChange={e => setWaMessage(e.target.value)}
              placeholder="Digite a mensagem. Cole links de GIF/vídeo/imagem que o WhatsApp gera a prévia automaticamente."
              rows={12}
            />
            <p className="text-xs text-muted-foreground">
              Dica: use <code>*negrito*</code>, <code>_itálico_</code>, <code>~tachado~</code>. Links e mídias geram prévia automática no app.
            </p>
          </div>
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