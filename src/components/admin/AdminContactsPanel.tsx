import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, Send, Trash2, Mail, Sparkles, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  email: string;
  name: string | null;
  source: string;
  status: string;
  invited_at: string | null;
  registered_at: string | null;
  last_email_at: string | null;
  last_email_subject: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
  invited: { label: "Convidado", className: "bg-violet-100 text-violet-800 border-violet-300" },
  registered: { label: "Cadastrado", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  unsubscribed: { label: "Descadastrado", className: "bg-amber-100 text-amber-800 border-amber-300" },
  failed: { label: "Falhou", className: "bg-red-100 text-red-800 border-red-300" },
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function parseContactsInput(text: string): { email: string; name?: string }[] {
  const out: { email: string; name?: string }[] = [];
  const seen = new Set<string>();
  // Split by lines, then by ; or , — but try to keep "name,email" pairs
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip header lines like "name,email"
    if (/^(name|nome|email|e-mail)\s*[,;]/i.test(line)) continue;
    // Try parsing as name,email or email,name
    const parts = line.split(/[,;\t]/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const emailPart = parts.find(p => EMAIL_RE.test(p));
      const namePart = parts.find(p => p !== emailPart);
      if (emailPart) {
        const e = emailPart.toLowerCase();
        if (!seen.has(e)) { seen.add(e); out.push({ email: e, name: namePart }); }
        continue;
      }
    }
    // Otherwise extract any emails from the line
    const matches = line.match(new RegExp(EMAIL_RE, "g")) ?? [];
    for (const m of matches) {
      const e = m.toLowerCase();
      if (!seen.has(e)) { seen.add(e); out.push({ email: e }); }
    }
  }
  return out;
}

export function AdminContactsPanel() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Custom email composer
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar contatos: " + error.message);
    else setContacts((data ?? []) as Contact[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (c.email ?? "").toLowerCase().includes(q) || (c.name ?? "").toLowerCase().includes(q);
    });
  }, [contacts, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: contacts.length };
    for (const k of contacts) c[k.status] = (c[k.status] ?? 0) + 1;
    return c;
  }, [contacts]);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map(c => c.id)));
    else setSelected(new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const handleFile = async (file: File) => {
    const txt = await file.text();
    setImportText(prev => (prev ? prev + "\n" + txt : txt));
  };

  const doImport = async () => {
    const parsed = parseContactsInput(importText);
    if (!parsed.length) { toast.error("Nenhum email válido encontrado."); return; }
    setImporting(true);
    const rows = parsed.map(p => ({
      email: p.email,
      name: p.name ?? null,
      source: "import",
      status: "pending",
    }));
    const { error } = await supabase
      .from("admin_contacts")
      .upsert(rows, { onConflict: "email", ignoreDuplicates: true });
    setImporting(false);
    if (error) { toast.error("Erro ao importar: " + error.message); return; }
    toast.success(`${parsed.length} contato(s) importado(s).`);
    setImportOpen(false);
    setImportText("");
    load();
  };

  const doDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Excluir ${selected.size} contato(s)?`)) return;
    const { error } = await supabase.from("admin_contacts").delete().in("id", Array.from(selected));
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Contato(s) excluído(s).");
    setSelected(new Set());
    load();
  };

  const sendInvite = async () => {
    if (!selected.size) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "send_contact_email", contact_ids: Array.from(selected), is_invite: true },
    });
    setSending(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`Convite enviado para ${data?.sent ?? 0}/${data?.total ?? 0}.`);
    setSelected(new Set());
    load();
  };

  const sendCustom = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast.error("Preencha assunto e mensagem."); return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "send_contact_email",
        contact_ids: Array.from(selected),
        is_invite: false,
        subject: emailSubject,
        message: emailMessage,
        mode: "html",
      },
    });
    setSending(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`Enviado para ${data?.sent ?? 0}/${data?.total ?? 0}.`);
    setEmailOpen(false);
    setEmailSubject(""); setEmailMessage("");
    setSelected(new Set());
    load();
  };

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Contatos importados
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Importe leads de CSV ou cole emails, envie convites para se cadastrarem e acompanhe a conversão.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setImportOpen(true)} variant="outline">
            <Upload className="w-4 h-4 mr-2" /> Importar
          </Button>
          <Button
            disabled={!selected.size || sending}
            onClick={sendInvite}
            className="bg-primary"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Convidar ({selected.size})
          </Button>
          <Button
            disabled={!selected.size}
            onClick={() => setEmailOpen(true)}
            variant="outline"
          >
            <Mail className="w-4 h-4 mr-2" /> Email livre ({selected.size})
          </Button>
          <Button
            disabled={!selected.size}
            onClick={doDelete}
            variant="outline"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Excluir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar email ou nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-md"
            />
            <div className="flex gap-1 flex-wrap">
              {(["all","pending","invited","registered","unsubscribed","failed"] as const).map(k => (
                <Button
                  key={k}
                  size="sm"
                  variant={statusFilter === k ? "default" : "outline"}
                  onClick={() => setStatusFilter(k)}
                >
                  {k === "all" ? "Todos" : STATUS_BADGE[k]?.label} ({counts[k] ?? 0})
                </Button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground md:ml-auto">
              {filtered.length} de {contacts.length}
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
                      <Checkbox checked={allSelected} onCheckedChange={c => toggleAll(!!c)} />
                    </th>
                    <th className="p-3 text-left">Nome</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Convidado em</th>
                    <th className="p-3 text-left">Último email</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const meta = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending;
                    return (
                      <tr key={c.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={ck => toggleOne(c.id, !!ck)}
                          />
                        </td>
                        <td className="p-3">{c.name || "—"}</td>
                        <td className="p-3 text-muted-foreground break-all">{c.email}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {c.invited_at ? new Date(c.invited_at).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {c.last_email_at ? new Date(c.last_email_at).toLocaleDateString("pt-BR") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum contato.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar contatos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Arquivo CSV</label>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aceita formato <code>nome,email</code> ou apenas <code>email</code> por linha.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Ou cole emails aqui</label>
              <Textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={"João Silva, joao@exemplo.com\nmaria@exemplo.com\npedro@exemplo.com"}
                rows={10}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Duplicados são ignorados automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={doImport} disabled={importing || !importText.trim()}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email livre — {selected.size} contato(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Assunto</label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem (HTML permitido)</label>
              <Textarea
                value={emailMessage}
                onChange={e => setEmailMessage(e.target.value)}
                rows={12}
                className="font-mono text-xs"
                placeholder="<p>Olá, ...</p>"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)} disabled={sending}>Cancelar</Button>
            <Button onClick={sendCustom} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}