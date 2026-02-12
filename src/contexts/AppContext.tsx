import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { Clinic, Patient, Evolution, Appointment, Task, Payment, Attachment, ClinicNote, ScheduleByDay, ClinicPackage } from '@/types';

interface AppState {
  clinics: Clinic[];
  patients: Patient[];
  evolutions: Evolution[];
  appointments: Appointment[];
  tasks: Task[];
  payments: Payment[];
  attachments: Attachment[];
  clinicNotes: ClinicNote[];
  clinicPackages: ClinicPackage[];
  currentClinic: Clinic | null;
  currentPatient: Patient | null;
  selectedDate: Date;
  isLoading: boolean;
}

interface AppContextType extends AppState {
  setCurrentClinic: (clinic: Clinic | null) => void;
  setCurrentPatient: (patient: Patient | null) => void;
  setSelectedDate: (date: Date) => void;
  addClinic: (clinic: Omit<Clinic, 'id' | 'createdAt'>) => void;
  updateClinic: (id: string, updates: Partial<Clinic>) => void;
  deleteClinic: (id: string) => void;
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  deletePatient: (id: string) => void;
  addEvolution: (evolution: Omit<Evolution, 'id' | 'createdAt'>) => void;
  updateEvolution: (id: string, updates: Partial<Evolution>) => void;
  deleteEvolution: (id: string) => void;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => void;
  deleteAppointment: (id: string) => void;
  addTask: (title: string, patientId?: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  getPatientTasks: (patientId: string) => Task[];
  getPatientAttachments: (patientId: string) => Attachment[];
  addAttachment: (attachment: Omit<Attachment, 'id' | 'createdAt'>) => void;
  deleteAttachment: (id: string) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void;
  getClinicPatients: (clinicId: string) => Patient[];
  getPatientEvolutions: (patientId: string) => Evolution[];
  getDateAppointments: (date: Date) => Appointment[];
  addPackage: (pkg: Omit<ClinicPackage, 'id' | 'createdAt'>) => void;
  updatePackage: (id: string, updates: Partial<ClinicPackage>) => void;
  deletePackage: (id: string) => void;
  getClinicPackages: (clinicId: string) => ClinicPackage[];
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    clinics: [],
    patients: [],
    evolutions: [],
    appointments: [],
    tasks: [],
    payments: [],
    attachments: [],
    clinicNotes: [],
    clinicPackages: [],
    currentClinic: null,
    currentPatient: null,
    selectedDate: new Date(),
    isLoading: true,
  });

  // Load data from Supabase
  const loadData = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, clinics: [], patients: [], evolutions: [], appointments: [], tasks: [], clinicPackages: [], isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [clinicsRes, patientsRes, evolutionsRes, appointmentsRes, tasksRes, packagesRes, attachmentsRes] = await Promise.all([
        supabase.from('clinics').select('*').order('created_at', { ascending: false }),
        supabase.from('patients').select('*').order('created_at', { ascending: false }),
        supabase.from('evolutions').select('*').order('date', { ascending: false }),
        supabase.from('appointments').select('*').order('date', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('clinic_packages').select('*').order('created_at', { ascending: false }),
        supabase.from('attachments').select('*').order('created_at', { ascending: false }),
      ]);

      const clinics: Clinic[] = (clinicsRes.data || []).map(c => ({
        id: c.id, name: c.name, type: c.type as 'propria' | 'terceirizada',
        address: c.address || undefined, notes: c.notes || undefined,
        weekdays: c.weekdays || undefined, scheduleTime: c.schedule_time || undefined,
        scheduleByDay: c.schedule_by_day as ScheduleByDay | undefined,
        paymentType: c.payment_type as 'fixo_mensal' | 'fixo_diario' | 'sessao' | undefined,
        paymentAmount: c.payment_amount ? Number(c.payment_amount) : undefined,
        paysOnAbsence: c.pays_on_absence, 
        absencePaymentType: (c as any).absence_payment_type as 'always' | 'never' | 'confirmed_only' | undefined,
        letterhead: c.letterhead || undefined,
        stamp: c.stamp || undefined,
        email: (c as any).email || undefined,
        cnpj: (c as any).cnpj || undefined,
        phone: (c as any).phone || undefined,
        servicesDescription: (c as any).services_description || undefined,
        isArchived: c.is_archived || false, createdAt: c.created_at,
      }));

      const patients: Patient[] = (patientsRes.data || []).map(p => ({
        id: p.id, clinicId: p.clinic_id, name: p.name, birthdate: p.birthdate,
        phone: p.phone || undefined, clinicalArea: p.clinical_area || undefined,
        diagnosis: p.diagnosis || undefined, professionals: p.professionals || undefined,
        observations: p.observations || undefined, responsibleName: p.responsible_name || undefined,
        responsibleEmail: p.responsible_email || undefined,
        paymentType: p.payment_type as 'sessao' | 'fixo' | undefined,
        paymentValue: p.payment_value ? Number(p.payment_value) : undefined,
        contractStartDate: p.contract_start_date || undefined, weekdays: p.weekdays || undefined,
        scheduleTime: p.schedule_time || undefined, scheduleByDay: p.schedule_by_day as ScheduleByDay | undefined,
        packageId: (p as any).package_id || undefined,
        createdAt: p.created_at,
      }));

      const evolutions: Evolution[] = (evolutionsRes.data || []).map(e => ({
        id: e.id, patientId: e.patient_id, clinicId: e.clinic_id, date: e.date, text: e.text,
        attendanceStatus: e.attendance_status as 'presente' | 'falta' | 'falta_remunerada',
        confirmedAttendance: (e as any).confirmed_attendance || false,
        mood: (e as any).mood || undefined,
        signature: e.signature || undefined, stampId: e.stamp_id || undefined, createdAt: e.created_at,
      }));

      const appointments: Appointment[] = (appointmentsRes.data || []).map(a => ({
        id: a.id, patientId: a.patient_id, clinicId: a.clinic_id, date: a.date, time: a.time,
        notes: a.notes || undefined, createdAt: a.created_at,
      }));

      const tasks: Task[] = (tasksRes.data || []).map(t => ({
        id: t.id, title: t.title, completed: t.completed, patientId: (t as any).patient_id || undefined, createdAt: t.created_at,
      }));

      const clinicPackages: ClinicPackage[] = (packagesRes.data || []).map(p => ({
        id: p.id, userId: p.user_id, clinicId: p.clinic_id, name: p.name,
        description: p.description || undefined, price: Number(p.price),
        isActive: p.is_active ?? true, createdAt: p.created_at,
      }));

      const loadedAttachments: Attachment[] = (attachmentsRes.data || []).map(a => ({
        id: a.id, parentId: a.parent_id, parentType: a.parent_type as Attachment['parentType'],
        name: a.name, data: a.file_path, type: a.file_type, createdAt: a.created_at,
      }));

      setState(prev => ({ ...prev, clinics, patients, evolutions, appointments, tasks, clinicPackages, attachments: loadedAttachments, isLoading: false }));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const refreshData = useCallback(async () => { await loadData(); }, [loadData]);

  const setCurrentClinic = useCallback((clinic: Clinic | null) => {
    setState(prev => ({ ...prev, currentClinic: clinic, currentPatient: null }));
  }, []);

  const setCurrentPatient = useCallback((patient: Patient | null) => {
    setState(prev => ({ ...prev, currentPatient: patient }));
  }, []);

  const setSelectedDate = useCallback((date: Date) => {
    setState(prev => ({ ...prev, selectedDate: date }));
  }, []);

  const addClinic = useCallback(async (clinic: Omit<Clinic, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('clinics').insert({
        user_id: user.id, name: clinic.name, type: clinic.type,
        address: clinic.address || null, notes: clinic.notes || null,
        weekdays: clinic.weekdays || null, schedule_time: clinic.scheduleTime || null,
        schedule_by_day: clinic.scheduleByDay || null, payment_type: clinic.paymentType || null,
        payment_amount: clinic.paymentAmount || null, pays_on_absence: clinic.paysOnAbsence ?? true,
        absence_payment_type: clinic.absencePaymentType || 'always',
        letterhead: clinic.letterhead || null, stamp: clinic.stamp || null,
        email: clinic.email || null, cnpj: clinic.cnpj || null, phone: clinic.phone || null, services_description: clinic.servicesDescription || null,
        is_archived: clinic.isArchived || false,
      }).select().single();
      if (error) throw error;
      const newClinic: Clinic = {
        id: data.id, name: data.name, type: data.type as 'propria' | 'terceirizada',
        address: data.address || undefined, notes: data.notes || undefined,
        weekdays: data.weekdays || undefined, scheduleTime: data.schedule_time || undefined,
        scheduleByDay: data.schedule_by_day as ScheduleByDay | undefined,
        paymentType: data.payment_type as 'fixo_mensal' | 'fixo_diario' | 'sessao' | undefined,
        paymentAmount: data.payment_amount ? Number(data.payment_amount) : undefined,
        paysOnAbsence: data.pays_on_absence, 
        absencePaymentType: (data as any).absence_payment_type as 'always' | 'never' | 'confirmed_only' | undefined,
        letterhead: data.letterhead || undefined,
        stamp: data.stamp || undefined,
        email: (data as any).email || undefined,
        cnpj: (data as any).cnpj || undefined,
        phone: (data as any).phone || undefined,
        servicesDescription: (data as any).services_description || undefined,
        isArchived: data.is_archived || false, createdAt: data.created_at,
      };
      setState(prev => ({ ...prev, clinics: [newClinic, ...prev.clinics] }));
      toast.success('Clínica adicionada!');
    } catch (error) { console.error(error); toast.error('Erro ao adicionar clínica'); }
  }, [user]);

  const updateClinic = useCallback(async (id: string, updates: Partial<Clinic>) => {
    if (!user) return;
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.address !== undefined) updateData.address = updates.address || null;
      if (updates.notes !== undefined) updateData.notes = updates.notes || null;
      if (updates.weekdays !== undefined) updateData.weekdays = updates.weekdays || null;
      if (updates.scheduleTime !== undefined) updateData.schedule_time = updates.scheduleTime || null;
      if (updates.scheduleByDay !== undefined) updateData.schedule_by_day = updates.scheduleByDay || null;
      if (updates.paymentType !== undefined) updateData.payment_type = updates.paymentType || null;
      if (updates.paymentAmount !== undefined) updateData.payment_amount = updates.paymentAmount || null;
      if (updates.paysOnAbsence !== undefined) updateData.pays_on_absence = updates.paysOnAbsence;
      if (updates.absencePaymentType !== undefined) updateData.absence_payment_type = updates.absencePaymentType;
      if (updates.letterhead !== undefined) updateData.letterhead = updates.letterhead || null;
      if (updates.stamp !== undefined) updateData.stamp = updates.stamp || null;
      if (updates.email !== undefined) updateData.email = updates.email || null;
      if (updates.cnpj !== undefined) updateData.cnpj = updates.cnpj || null;
      if (updates.phone !== undefined) updateData.phone = updates.phone || null;
      if (updates.servicesDescription !== undefined) updateData.services_description = updates.servicesDescription || null;
      if (updates.isArchived !== undefined) updateData.is_archived = updates.isArchived;
      const { error } = await supabase.from('clinics').update(updateData).eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, clinics: prev.clinics.map(c => c.id === id ? { ...c, ...updates } : c) }));
    } catch (error) { console.error(error); toast.error('Erro ao atualizar clínica'); }
  }, [user]);

  const deleteClinic = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('clinics').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, clinics: prev.clinics.filter(c => c.id !== id), patients: prev.patients.filter(p => p.clinicId !== id) }));
    } catch (error) { console.error(error); toast.error('Erro ao excluir clínica'); }
  }, [user]);

  const addPatient = useCallback(async (patient: Omit<Patient, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('patients').insert({
        user_id: user.id, clinic_id: patient.clinicId, name: patient.name, birthdate: patient.birthdate,
        phone: patient.phone || null, clinical_area: patient.clinicalArea || null, diagnosis: patient.diagnosis || null,
        professionals: patient.professionals || null, observations: patient.observations || null,
        responsible_name: patient.responsibleName || null, responsible_email: patient.responsibleEmail || null,
        payment_type: patient.paymentType || null, payment_value: patient.paymentValue || null,
        contract_start_date: patient.contractStartDate || null, weekdays: patient.weekdays || null,
        schedule_time: patient.scheduleTime || null, schedule_by_day: patient.scheduleByDay || null,
        package_id: patient.packageId || null,
      }).select().single();
      if (error) throw error;
      const newPatient: Patient = {
        id: data.id, clinicId: data.clinic_id, name: data.name, birthdate: data.birthdate,
        phone: data.phone || undefined, clinicalArea: data.clinical_area || undefined,
        diagnosis: data.diagnosis || undefined, professionals: data.professionals || undefined,
        observations: data.observations || undefined, responsibleName: data.responsible_name || undefined,
        responsibleEmail: data.responsible_email || undefined,
        paymentType: data.payment_type as 'sessao' | 'fixo' | undefined,
        paymentValue: data.payment_value ? Number(data.payment_value) : undefined,
        contractStartDate: data.contract_start_date || undefined, weekdays: data.weekdays || undefined,
        scheduleTime: data.schedule_time || undefined, scheduleByDay: data.schedule_by_day as ScheduleByDay | undefined,
        packageId: (data as any).package_id || undefined,
        createdAt: data.created_at,
      };
      setState(prev => ({ ...prev, patients: [newPatient, ...prev.patients] }));
      toast.success('Paciente adicionado!');
    } catch (error) { console.error(error); toast.error('Erro ao adicionar paciente'); }
  }, [user]);

  const updatePatient = useCallback(async (id: string, updates: Partial<Patient>) => {
    if (!user) return;
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.clinicId !== undefined) updateData.clinic_id = updates.clinicId;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.birthdate !== undefined) updateData.birthdate = updates.birthdate;
      if (updates.phone !== undefined) updateData.phone = updates.phone || null;
      if (updates.clinicalArea !== undefined) updateData.clinical_area = updates.clinicalArea || null;
      if (updates.diagnosis !== undefined) updateData.diagnosis = updates.diagnosis || null;
      if (updates.professionals !== undefined) updateData.professionals = updates.professionals || null;
      if (updates.observations !== undefined) updateData.observations = updates.observations || null;
      if (updates.responsibleName !== undefined) updateData.responsible_name = updates.responsibleName || null;
      if (updates.responsibleEmail !== undefined) updateData.responsible_email = updates.responsibleEmail || null;
      if (updates.paymentType !== undefined) updateData.payment_type = updates.paymentType || null;
      if (updates.paymentValue !== undefined) updateData.payment_value = updates.paymentValue || null;
      if (updates.contractStartDate !== undefined) updateData.contract_start_date = updates.contractStartDate || null;
      if (updates.weekdays !== undefined) updateData.weekdays = updates.weekdays || null;
      if (updates.scheduleTime !== undefined) updateData.schedule_time = updates.scheduleTime || null;
      if (updates.scheduleByDay !== undefined) updateData.schedule_by_day = updates.scheduleByDay || null;
      const { error } = await supabase.from('patients').update(updateData).eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, patients: prev.patients.map(p => p.id === id ? { ...p, ...updates } : p) }));
    } catch (error) { console.error(error); toast.error('Erro ao atualizar paciente'); }
  }, [user]);

  const deletePatient = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, patients: prev.patients.filter(p => p.id !== id) }));
    } catch (error) { console.error(error); toast.error('Erro ao excluir paciente'); }
  }, [user]);

  const addEvolution = useCallback(async (evolution: Omit<Evolution, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      // Check for duplicate: same patient, same date, same clinic
      const { data: existing } = await supabase.from('evolutions')
        .select('id')
        .eq('patient_id', evolution.patientId)
        .eq('date', evolution.date)
        .eq('clinic_id', evolution.clinicId)
        .maybeSingle();
      
      if (existing) {
        toast.error('Já existe uma evolução para este paciente nesta data.');
        return;
      }

      const { data, error } = await supabase.from('evolutions').insert({
        user_id: user.id, patient_id: evolution.patientId, clinic_id: evolution.clinicId,
        date: evolution.date, text: evolution.text, attendance_status: evolution.attendanceStatus,
        signature: evolution.signature || null, stamp_id: evolution.stampId || null,
        confirmed_attendance: evolution.confirmedAttendance || false,
        mood: evolution.mood || null,
      }).select().single();
      if (error) throw error;

      // Save attachment records to DB
      const savedAttachments: Attachment[] = [];
      if (evolution.attachments && evolution.attachments.length > 0) {
        for (const att of evolution.attachments) {
          try {
            const { data: attData, error: attError } = await supabase.from('attachments').insert({
              user_id: user.id, parent_id: data.id, parent_type: 'evolution',
              name: att.name, file_path: att.data, file_type: att.type,
            }).select().single();
            if (attError) {
              console.error('Error saving attachment record:', attError);
              continue;
            }
            if (attData) {
              savedAttachments.push({
                id: attData.id, parentId: attData.parent_id, parentType: attData.parent_type as Attachment['parentType'],
                name: attData.name, data: attData.file_path, type: attData.file_type, createdAt: attData.created_at,
              });
            }
          } catch (attErr) {
            console.error('Error inserting attachment:', attErr);
          }
        }
      }

      const newEvolution: Evolution = {
        id: data.id, patientId: data.patient_id, clinicId: data.clinic_id, date: data.date, text: data.text,
        attendanceStatus: data.attendance_status as 'presente' | 'falta' | 'falta_remunerada',
        confirmedAttendance: (data as any).confirmed_attendance || false,
        mood: (data as any).mood || undefined,
        signature: data.signature || undefined, stampId: data.stamp_id || undefined, createdAt: data.created_at,
        attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
      };
      setState(prev => ({
        ...prev,
        evolutions: [newEvolution, ...prev.evolutions],
        attachments: [...savedAttachments, ...prev.attachments],
      }));
      toast.success('Evolução adicionada!');
    } catch (error) { console.error(error); toast.error('Erro ao adicionar evolução'); }
  }, [user]);

  const updateEvolution = useCallback(async (id: string, updates: Partial<Evolution>) => {
    if (!user) return;
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.text !== undefined) updateData.text = updates.text;
      if (updates.attendanceStatus !== undefined) updateData.attendance_status = updates.attendanceStatus;
      if (updates.signature !== undefined) updateData.signature = updates.signature || null;
      if (updates.stampId !== undefined) updateData.stamp_id = updates.stampId || null;
      if (updates.mood !== undefined) updateData.mood = updates.mood || null;
      const { error } = await supabase.from('evolutions').update(updateData).eq('id', id);
      if (error) throw error;

      // Handle attachment sync
      if (updates.attachments !== undefined) {
        // Get existing DB attachments for this evolution
        const { data: existingAtts } = await supabase.from('attachments')
          .select('id')
          .eq('parent_id', id)
          .eq('parent_type', 'evolution');
        
        const existingIds = new Set((existingAtts || []).map(a => a.id));
        const newAttIds = new Set((updates.attachments || []).map(a => a.id));
        
        // Delete removed attachments
        const toDelete = [...existingIds].filter(aid => !newAttIds.has(aid));
        for (const aid of toDelete) {
          await supabase.from('attachments').delete().eq('id', aid);
        }
        
        // Insert new attachments (those with temp_ ids)
        const toInsert = (updates.attachments || []).filter(a => a.id.startsWith('temp_'));
        const savedAttachments: Attachment[] = [];
        for (const att of toInsert) {
          const { data: attData, error: attError } = await supabase.from('attachments').insert({
            user_id: user.id, parent_id: id, parent_type: 'evolution',
            name: att.name, file_path: att.data, file_type: att.type,
          }).select().single();
          if (!attError && attData) {
            savedAttachments.push({
              id: attData.id, parentId: attData.parent_id, parentType: attData.parent_type as Attachment['parentType'],
              name: attData.name, data: attData.file_path, type: attData.file_type, createdAt: attData.created_at,
            });
          }
        }

        // Update attachments in global state
        setState(prev => ({
          ...prev,
          attachments: [
            ...prev.attachments.filter(a => !(a.parentId === id && a.parentType === 'evolution' && toDelete.includes(a.id))),
            ...savedAttachments,
          ],
        }));
      }

      // Update evolution in state WITHOUT attachments (let the join handle it)
      const { attachments: _removed, ...evolutionUpdates } = updates;
      setState(prev => ({ ...prev, evolutions: prev.evolutions.map(e => e.id === id ? { ...e, ...evolutionUpdates } : e) }));
    } catch (error) { console.error(error); toast.error('Erro ao atualizar evolução'); }
  }, [user]);

  const deleteEvolution = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('evolutions').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, evolutions: prev.evolutions.filter(e => e.id !== id) }));
    } catch (error) { console.error(error); toast.error('Erro ao excluir evolução'); }
  }, [user]);

  const addAppointment = useCallback(async (appointment: Omit<Appointment, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('appointments').insert({
        user_id: user.id, patient_id: appointment.patientId, clinic_id: appointment.clinicId,
        date: appointment.date, time: appointment.time, notes: appointment.notes || null,
      }).select().single();
      if (error) throw error;
      const newAppointment: Appointment = {
        id: data.id, patientId: data.patient_id, clinicId: data.clinic_id, date: data.date, time: data.time,
        notes: data.notes || undefined, createdAt: data.created_at,
      };
      setState(prev => ({ ...prev, appointments: [newAppointment, ...prev.appointments] }));
    } catch (error) { console.error(error); toast.error('Erro ao adicionar agendamento'); }
  }, [user]);

  const deleteAppointment = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, appointments: prev.appointments.filter(a => a.id !== id) }));
    } catch (error) { console.error(error); toast.error('Erro ao excluir agendamento'); }
  }, [user]);

  const addTask = useCallback(async (title: string, patientId?: string) => {
    if (!user) return;
    try {
      const insertData: Record<string, unknown> = { user_id: user.id, title, completed: false };
      if (patientId) insertData.patient_id = patientId;
      const { data, error } = await supabase.from('tasks').insert(insertData).select().single();
      if (error) throw error;
      const newTask: Task = { id: data.id, title: data.title, completed: data.completed, patientId: (data as any).patient_id || undefined, createdAt: data.created_at };
      setState(prev => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
    } catch (error) { console.error(error); toast.error('Erro ao adicionar tarefa'); }
  }, [user]);

  const toggleTask = useCallback(async (id: string) => {
    if (!user) return;
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    try {
      const { error } = await supabase.from('tasks').update({ completed: !task.completed }).eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) }));
    } catch (error) { console.error(error); toast.error('Erro ao atualizar tarefa'); }
  }, [user, state.tasks]);

  const deleteTask = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
    } catch (error) { console.error(error); toast.error('Erro ao excluir tarefa'); }
  }, [user]);

  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const newPayment: Payment = { ...payment, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setState(prev => ({ ...prev, payments: [newPayment, ...prev.payments] }));
  }, []);

  const getClinicPatients = useCallback((clinicId: string) => state.patients.filter(p => p.clinicId === clinicId), [state.patients]);
  const getPatientEvolutions = useCallback((patientId: string) => state.evolutions.filter(e => e.patientId === patientId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [state.evolutions]);
  const getDateAppointments = useCallback((date: Date) => { const d = date.toISOString().split('T')[0]; return state.appointments.filter(a => a.date === d).sort((a, b) => a.time.localeCompare(b.time)); }, [state.appointments]);
  const getClinicPackages = useCallback((clinicId: string) => state.clinicPackages.filter(p => p.clinicId === clinicId && p.isActive), [state.clinicPackages]);

  const addPackage = useCallback(async (pkg: Omit<ClinicPackage, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('clinic_packages').insert({
        user_id: user.id, clinic_id: pkg.clinicId, name: pkg.name,
        description: pkg.description || null, price: pkg.price, is_active: pkg.isActive,
      }).select().single();
      if (error) throw error;
      const newPkg: ClinicPackage = {
        id: data.id, userId: data.user_id, clinicId: data.clinic_id, name: data.name,
        description: data.description || undefined, price: Number(data.price),
        isActive: data.is_active ?? true, createdAt: data.created_at,
      };
      setState(prev => ({ ...prev, clinicPackages: [newPkg, ...prev.clinicPackages] }));
      toast.success('Pacote adicionado!');
    } catch (error) { console.error(error); toast.error('Erro ao adicionar pacote'); }
  }, [user]);

  const updatePackage = useCallback(async (id: string, updates: Partial<ClinicPackage>) => {
    if (!user) return;
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description || null;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      const { error } = await supabase.from('clinic_packages').update(updateData).eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, clinicPackages: prev.clinicPackages.map(p => p.id === id ? { ...p, ...updates } : p) }));
    } catch (error) { console.error(error); toast.error('Erro ao atualizar pacote'); }
  }, [user]);

  const deletePackage = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('clinic_packages').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, clinicPackages: prev.clinicPackages.filter(p => p.id !== id) }));
      toast.success('Pacote excluído!');
    } catch (error) { console.error(error); toast.error('Erro ao excluir pacote'); }
  }, [user]);

  const getPatientTasks = useCallback((patientId: string) => state.tasks.filter(t => t.patientId === patientId), [state.tasks]);
  const getPatientAttachments = useCallback((patientId: string) => state.attachments.filter(a => a.parentType === 'patient' && a.parentId === patientId), [state.attachments]);

  const addAttachment = useCallback(async (attachment: Omit<Attachment, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('attachments').insert({
        user_id: user.id, parent_id: attachment.parentId, parent_type: attachment.parentType,
        name: attachment.name, file_path: attachment.data, file_type: attachment.type,
      }).select().single();
      if (error) throw error;
      const newAtt: Attachment = {
        id: data.id, parentId: data.parent_id, parentType: data.parent_type as Attachment['parentType'],
        name: data.name, data: data.file_path, type: data.file_type, createdAt: data.created_at,
      };
      setState(prev => ({ ...prev, attachments: [newAtt, ...prev.attachments] }));
    } catch (error) { console.error(error); toast.error('Erro ao salvar anexo'); }
  }, [user]);

  const deleteAttachment = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
    } catch (error) { console.error(error); toast.error('Erro ao excluir anexo'); }
  }, [user]);

  return (
    <AppContext.Provider value={{ ...state, setCurrentClinic, setCurrentPatient, setSelectedDate, addClinic, updateClinic, deleteClinic, addPatient, updatePatient, deletePatient, addEvolution, updateEvolution, deleteEvolution, addAppointment, deleteAppointment, addTask, toggleTask, deleteTask, addPayment, getClinicPatients, getPatientEvolutions, getDateAppointments, addPackage, updatePackage, deletePackage, getClinicPackages, getPatientTasks, getPatientAttachments, addAttachment, deleteAttachment, refreshData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
}
