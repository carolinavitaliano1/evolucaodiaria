
-- Novo campo para tipo de pagamento de faltas
ALTER TABLE clinics ADD COLUMN absence_payment_type text DEFAULT 'always';

-- Campo de confirmacao na evolucao
ALTER TABLE evolutions ADD COLUMN confirmed_attendance boolean DEFAULT false;

-- Tabela de pacotes
CREATE TABLE clinic_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clinic_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own packages" ON clinic_packages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own packages" ON clinic_packages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own packages" ON clinic_packages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own packages" ON clinic_packages FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_clinic_packages_updated_at
BEFORE UPDATE ON clinic_packages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Referencia de pacote no paciente
ALTER TABLE patients ADD COLUMN package_id uuid REFERENCES clinic_packages(id) ON DELETE SET NULL;
