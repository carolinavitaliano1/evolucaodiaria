export const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const COUNTRIES = ['Brasil','Argentina','Chile','Estados Unidos','Portugal','Espanha','Uruguai','Paraguai'];
export const COUNCILS = ['CRM','CRP','CREFITO','COREN','CRO','CRN','CRF','CRFa','Outro'];
export const PIX_TYPES = ['CPF','CNPJ','Telefone','Email','Chave aleatória'];
export const MARITAL_STATUSES = ['Solteiro(a)','Casado(a)','Divorciado(a)','Viúvo(a)','União estável','Separado(a)'];
export const SEX_OPTIONS = ['Feminino','Masculino','Outro','Prefiro não informar'];

export const DEFAULT_CBOS_OPTIONS = [
  { value: '2515-50', label: 'Psicopedagogo' },
  { value: '2263-15', label: 'Musicoterapeuta' },
  { value: '2236-05', label: 'Psicomotricista' },
  { value: '2515-10', label: 'Psicólogo clínico' },
  { value: '2236-50', label: 'Fisioterapeuta' },
  { value: '2236-25', label: 'Fonoaudiólogo' },
  { value: '2239-05', label: 'Terapeuta ocupacional' },
  { value: '2231-40', label: 'Médico clínico' },
];

export type ProfessionalArea = {
  area: string;
  council?: string;
  councilNumber?: string;
  councilUF?: string;
  cbosCode?: string;
};

export function maskCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
export function maskCNPJ(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
export function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}
export function maskCEP(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}
export function maskPix(v: string, type?: string) {
  switch (type) {
    case 'CPF': return maskCPF(v);
    case 'CNPJ': return maskCNPJ(v);
    case 'Telefone': return maskPhone(v);
    default: return v;
  }
}