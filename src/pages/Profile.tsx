import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { SignaturePad } from '@/components/ui/signature-pad';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Plus, Trash2, Stamp, Pencil, Check } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  professional_id: string | null;
}

interface StampItem {
  id: string;
  user_id: string;
  name: string;
  clinical_area: string;
  stamp_image: string | null;
  signature_image: string | null;
  is_default: boolean;
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stamps, setStamps] = useState<StampItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stampDialogOpen, setStampDialogOpen] = useState(false);
  const [editingStamp, setEditingStamp] = useState<StampItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [professionalId, setProfessionalId] = useState('');

  // Stamp form states
  const [stampName, setStampName] = useState('');
  const [stampArea, setStampArea] = useState('');
  const [stampImage, setStampImage] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // For now, use a mock user_id since auth isn't implemented
      const mockUserId = 'mock-user-id';

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', mockUserId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        setName(profileData.name || '');
        setEmail(profileData.email || '');
        setPhone(profileData.phone || '');
        setProfessionalId(profileData.professional_id || '');
      }

      // Load stamps
      const { data: stampsData } = await supabase
        .from('stamps')
        .select('*')
        .eq('user_id', mockUserId)
        .order('created_at', { ascending: true });

      if (stampsData) {
        setStamps(stampsData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    try {
      setSaving(true);
      const mockUserId = 'mock-user-id';

      if (profile) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name,
            email,
            phone,
            professional_id: professionalId
          })
          .eq('id', profile.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: mockUserId,
            name,
            email,
            phone,
            professional_id: professionalId
          });

        if (error) throw error;
      }

      toast.success('Perfil salvo com sucesso!');
      loadData();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }

  function openStampDialog(stamp?: StampItem) {
    if (stamp) {
      setEditingStamp(stamp);
      setStampName(stamp.name);
      setStampArea(stamp.clinical_area);
      setStampImage(stamp.stamp_image);
      setSignatureImage(stamp.signature_image);
      setIsDefault(stamp.is_default);
    } else {
      setEditingStamp(null);
      setStampName('');
      setStampArea('');
      setStampImage(null);
      setSignatureImage(null);
      setIsDefault(false);
    }
    setStampDialogOpen(true);
  }

  async function saveStamp() {
    try {
      setSaving(true);
      const mockUserId = 'mock-user-id';

      if (!stampName || !stampArea) {
        toast.error('Preencha o nome e a área clínica');
        return;
      }

      // If setting as default, unset others first
      if (isDefault) {
        await supabase
          .from('stamps')
          .update({ is_default: false })
          .eq('user_id', mockUserId);
      }

      if (editingStamp) {
        const { error } = await supabase
          .from('stamps')
          .update({
            name: stampName,
            clinical_area: stampArea,
            stamp_image: stampImage,
            signature_image: signatureImage,
            is_default: isDefault
          })
          .eq('id', editingStamp.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stamps')
          .insert({
            user_id: mockUserId,
            name: stampName,
            clinical_area: stampArea,
            stamp_image: stampImage,
            signature_image: signatureImage,
            is_default: isDefault
          });

        if (error) throw error;
      }

      toast.success('Carimbo salvo com sucesso!');
      setStampDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving stamp:', error);
      toast.error('Erro ao salvar carimbo');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStamp(stampId: string) {
    try {
      const { error } = await supabase
        .from('stamps')
        .delete()
        .eq('id', stampId);

      if (error) throw error;

      toast.success('Carimbo removido');
      loadData();
    } catch (error) {
      console.error('Error deleting stamp:', error);
      toast.error('Erro ao remover carimbo');
    }
  }

  function handleStampUpload(files: UploadedFile[]) {
    if (files.length > 0) {
      setStampImage(files[0].url);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
          <User className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações e carimbos</p>
        </div>
      </div>

      {/* Profile Info */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="professionalId">Registro Profissional</Label>
              <Input
                id="professionalId"
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                placeholder="CRP/CRFa/etc"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stamps */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stamp className="w-5 h-5" />
            Meus Carimbos
          </CardTitle>
          <Button onClick={() => openStampDialog()} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo Carimbo
          </Button>
        </CardHeader>
        <CardContent>
          {stamps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Stamp className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum carimbo cadastrado</p>
              <p className="text-sm">Adicione carimbos para suas diferentes áreas de atuação</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stamps.map((stamp) => (
                <div
                  key={stamp.id}
                  className="border rounded-lg p-4 relative group hover:border-primary transition-colors"
                >
                  {stamp.is_default && (
                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                      Padrão
                    </span>
                  )}
                  <h3 className="font-semibold">{stamp.name}</h3>
                  <p className="text-sm text-muted-foreground">{stamp.clinical_area}</p>
                  
                  {stamp.stamp_image && (
                    <div className="mt-3 p-2 bg-muted rounded">
                      <img
                        src={stamp.stamp_image}
                        alt="Carimbo"
                        className="max-h-20 mx-auto object-contain"
                      />
                    </div>
                  )}
                  
                  {stamp.signature_image && (
                    <div className="mt-2 p-2 bg-muted rounded">
                      <img
                        src={stamp.signature_image}
                        alt="Assinatura"
                        className="max-h-16 mx-auto object-contain"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openStampDialog(stamp)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteStamp(stamp.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stamp Dialog */}
      <Dialog open={stampDialogOpen} onOpenChange={setStampDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStamp ? 'Editar Carimbo' : 'Novo Carimbo'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stampName">Nome do Carimbo</Label>
              <Input
                id="stampName"
                value={stampName}
                onChange={(e) => setStampName(e.target.value)}
                placeholder="Ex: Psicóloga Clínica"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="stampArea">Área Clínica</Label>
              <Input
                id="stampArea"
                value={stampArea}
                onChange={(e) => setStampArea(e.target.value)}
                placeholder="Ex: Psicologia, Fonoaudiologia"
              />
            </div>

            <div className="space-y-2">
              <Label>Imagem do Carimbo</Label>
              <FileUpload
                accept="image/*"
                maxFiles={1}
                parentId="stamp"
                parentType="stamp"
                onUpload={handleStampUpload}
                existingFiles={stampImage ? [{
                  id: 'stamp-img',
                  name: 'Carimbo',
                  filePath: stampImage,
                  fileType: 'image',
                  fileSize: 0,
                  url: stampImage
                }] : []}
                onRemove={() => setStampImage(null)}
                compact
              />
            </div>

            <div className="space-y-2">
              <Label>Assinatura Digital</Label>
              <SignaturePad
                value={signatureImage || ''}
                onChange={setSignatureImage}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                Definir como carimbo padrão
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStampDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveStamp} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}