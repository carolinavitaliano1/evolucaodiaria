import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { toLocalDateString } from '@/lib/utils';
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
  // Lazy-load tracking
  loadedEvolutionsForClinics: Set<string>;
  loadedAppointmentsForClinics: Set<string>;
  loadedAttachmentsForPatients: Set<string>;
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
  updateTaskNotes: (id: string, notes: string) => void;
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
  loadEvolutionsForClinic: (clinicId: string) => Promise<void>;
  loadAppointmentsForClinic: (clinicId: string) => Promise<void>;
  loadAttachmentsForPatient: (patientId: string) => Promise<void>;
  loadAllEvolutions: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Mapper helpers ---
function mapClinic(c: Record<string, unknown>): Clinic {
  return {
    id: c.id as string, name: c.name as string, type: c.type as 'propria' | 'terceirizada',
    address: (c.address as string) || undefined, notes: (c.notes as string) || undefined,
    weekdays: (c.weekdays as string[]) || undefined, scheduleTime: (c.schedule_time as string) || undefined,
    scheduleByDay: c.schedule_by_day as ScheduleByDay | undefined,
    paymentType: c.payment_type as 'fixo_mensal' | 'fixo_diario' | 'sessao' | undefined,
    paymentAmount: c.payment_amount ? Number(c.payment_amount) : undefined,
    paysOnAbsence: c.pays_on_absence as boolean,
    absencePaymentType: c.absence_payment_type as 'always' | 'never' | 'confirmed_only' | undefined,
    letterhead: (c.letterhead as string) || undefined, stamp: (c.stamp as string) || undefined,
    email: (c.email as string) || undefined, cnpj: (c.cnpj as string) || undefined,
    phone: (c.phone as string) || undefined, servicesDescription: (c.services_description as string) || undefined,
    discountPercentage: c.discount_percentage ? Number(c.discount_percentage) : 0,
    isArchived: (c.is_archived as boolean) || false, createdAt: c.created_at as string,
  };
}

function mapPatient(p: Record<string, unknown>): Patient {
  return {
    id: p.id as string, clinicId: p.clinic_id as string, name: p.name as string, birthdate: p.birthdate as string,
    phone: (p.phone as string) || undefined, clinicalArea: (p.clinical_area as string) || undefined,
    diagnosis: (p.diagnosis as string) || undefined, professionals: (p.professionals as string) || undefined,
    observations: (p.observations as string) || undefined, responsibleName: (p.responsible_name as string) || undefined,
    responsibleEmail: (p.responsible_email as string) || undefined,
    paymentType: p.payment_type as 'sessao' | 'fixo' | undefined,
    paymentValue: p.payment_value ? Number(p.payment_value) : undefined,
    contractStartDate: (p.contract_start_date as string) || undefined,
    weekdays: (p.weekdays as string[]) || undefined, scheduleTime: (p.schedule_time as string) || undefined,
    scheduleByDay: p.schedule_by_day as ScheduleByDay | undefined,
    packageId: (p.package_id as string) || undefined, isArchived: (p.is_archived as boolean) || false,
    avatarUrl: (p.avatar_url as string) || undefined, createdAt: p.created_at as string,
  };
}

function mapEvolution(e: Record<string, unknown>): Evolution {
  return {
    id: e.id as string, patientId: e.patient_id as string, clinicId: e.clinic_id as string,
    date: e.date as string, text: e.text as string,
    attendanceStatus: e.attendance_status as Evolution['attendanceStatus'],
    confirmedAttendance: (e.confirmed_attendance as boolean) || false,
    mood: (e.mood as Evolution['mood']) || undefined, signature: (e.signature as string) || undefined,
    stampId: (e.stamp_id as string) || undefined, createdAt: e.created_at as string,
  };
}

function mapAppointment(a: Record<string, unknown>): Appointment {
  return {
    id: a.id as string, patientId: a.patient_id as string, clinicId: a.clinic_id as string,
    date: a.date as string, time: a.time as string, notes: (a.notes as string) || undefined,
    createdAt: a.created_at as string,
  };
}

function mapTask(t: Record<string, unknown>): Task {
  return {
    id: t.id as string, title: t.title as string, completed: t.completed as boolean,
    notes: (t.notes as string) || undefined, patientId: (t.patient_id as string) || undefined,
    createdAt: t.created_at as string,
  };
}

function mapPackage(p: Record<string, unknown>): ClinicPackage {
  return {
    id: p.id as string, userId: p.user_id as string, clinicId: p.clinic_id as string,
    name: p.name as string, description: (p.description as string) || undefined,
    price: Number(p.price), isActive: (p.is_active as boolean) ?? true,
    createdAt: p.created_at as string,
  };
}

function mapAttachment(a: Record<string, unknown>): Attachment {
  return {
    id: a.id as string, parentId: a.parent_id as string,
    parentType: a.parent_type as Attachment['parentType'],
    name: a.name as string, data: a.file_path as string,
    type: a.file_type as string, createdAt: a.created_at as string,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, sessionReady } = useAuth();
  const [state, setState] = useState<AppState>({
    clinics: [], patients: [], evolutions: [], appointments: [],
    tasks: [], payments: [], attachments: [], clinicNotes: [], clinicPackages: [],
    currentClinic: null, currentPatient: null, selectedDate: new Date(), isLoading: true,
    loadedEvolutionsForClinics: new Set(),
    loadedAppointmentsForClinics: new Set(),
    loadedAttachmentsForPatients: new Set(),
  });

  // In-flight guards to prevent duplicate fetches
  const loadingEvolutionsRef = useRef<Set<string>>(new Set());
  const loadingAppointmentsRef = useRef<Set<string>>(new Set());
  const loadingAttachmentsRef = useRef<Set<string>>(new Set());
  const loadingAllEvolutionsRef = useRef(false);

  // === PHASE 1: Fast initial load — only clinics, patients, tasks, packages ===
  const loadInitialData = useCallback(async () => {
    if (!user) {
      setState(prev => ({
        ...prev, clinics: [], patients: [], evolutions: [], appointments: [],
        tasks: [], clinicPackages: [], isLoading: false,
        loadedEvolutionsForClinics: new Set(),
        loadedAppointmentsForClinics: new Set(),
        loadedAttachmentsForPatients: new Set(),
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [clinicsRes, patientsRes, tasksRes, packagesRes] = await Promise.all([
        supabase.from('clinics').select('*').order('created_at', { ascending: false }),
        supabase.from('patients').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('clinic_packages').select('*').order('created_at', { ascending: false }),
      ]);

      const clinics = (clinicsRes.data || []).map(c => mapClinic(c as Record<string, unknown>));
      const patients = (patientsRes.data || []).map(p => mapPatient(p as Record<string, unknown>));
      const tasks = (tasksRes.data || []).map(t => mapTask(t as Record<string, unknown>));
      const clinicPackages = (packagesRes.data || []).map(p => mapPackage(p as Record<string, unknown>));

      setState(prev => ({
        ...prev, clinics, patients, tasks, clinicPackages, isLoading: false,
        loadedEvolutionsForClinics: new Set(),
        loadedAppointmentsForClinics: new Set(),
        loadedAttachmentsForPatients: new Set(),
      }));
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Erro ao carregar dados');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => {
    if (!sessionReady) return; // Wait for session to be fully restored before loading data
    loadInitialData();
    // Reset in-flight refs on user change
    loadingEvolutionsRef.current = new Set();
    loadingAppointmentsRef.current = new Set();
    loadingAttachmentsRef.current = new Set();
    loadingAllEvolutionsRef.current = false;
  }, [loadInitialData, sessionReady]);

  // === PHASE 2: Lazy loaders ===

  const loadEvolutionsForClinic = useCallback(async (clinicId: string) => {
    if (!user || !clinicId) return;
    if (loadingEvolutionsRef.current.has(clinicId)) return;

    setState(prev => {
      if (prev.loadedEvolutionsForClinics.has(clinicId)) return prev; // already loaded
      return prev;
    });

    // Check if already loaded (outside setState to avoid stale closure issues)
    const alreadyLoaded = await new Promise<boolean>(resolve => {
      setState(prev => {
        resolve(prev.loadedEvolutionsForClinics.has(clinicId));
        return prev;
      });
    });
    if (alreadyLoaded) return;

    loadingEvolutionsRef.current.add(clinicId);
    try {
      const { data, error } = await supabase
        .from('evolutions').select('*')
        .eq('clinic_id', clinicId)
        .order('date', { ascending: false });
      if (error) throw error;

      const newEvolutions = (data || []).map(e => mapEvolution(e as Record<string, unknown>));
      setState(prev => {
        const existingIds = new Set(prev.evolutions.map(e => e.id));
        const toAdd = newEvolutions.filter(e => !existingIds.has(e.id));
        const updated = new Set(prev.loadedEvolutionsForClinics);
        updated.add(clinicId);
        return {
          ...prev,
          evolutions: [...prev.evolutions, ...toAdd],
          loadedEvolutionsForClinics: updated,
        };
      });
    } catch (error) {
      console.error('Error loading evolutions for clinic:', error);
    } finally {
      loadingEvolutionsRef.current.delete(clinicId);
    }
  }, [user]);

  const loadAppointmentsForClinic = useCallback(async (clinicId: string) => {
    if (!user || !clinicId) return;
    if (loadingAppointmentsRef.current.has(clinicId)) return;

    const alreadyLoaded = await new Promise<boolean>(resolve => {
      setState(prev => {
        resolve(prev.loadedAppointmentsForClinics.has(clinicId));
        return prev;
      });
    });
    if (alreadyLoaded) return;

    loadingAppointmentsRef.current.add(clinicId);
    try {
      const { data, error } = await supabase
        .from('appointments').select('*')
        .eq('clinic_id', clinicId)
        .order('date', { ascending: false });
      if (error) throw error;

      const newAppointments = (data || []).map(a => mapAppointment(a as Record<string, unknown>));
      setState(prev => {
        const existingIds = new Set(prev.appointments.map(a => a.id));
        const toAdd = newAppointments.filter(a => !existingIds.has(a.id));
        const updated = new Set(prev.loadedAppointmentsForClinics);
        updated.add(clinicId);
        return {
          ...prev,
          appointments: [...prev.appointments, ...toAdd],
          loadedAppointmentsForClinics: updated,
        };
      });
    } catch (error) {
      console.error('Error loading appointments for clinic:', error);
    } finally {
      loadingAppointmentsRef.current.delete(clinicId);
    }
  }, [user]);

  const loadAttachmentsForPatient = useCallback(async (patientId: string) => {
    if (!user || !patientId) return;
    if (loadingAttachmentsRef.current.has(patientId)) return;

    const alreadyLoaded = await new Promise<boolean>(resolve => {
      setState(prev => {
        resolve(prev.loadedAttachmentsForPatients.has(patientId));
        return prev;
      });
    });
    if (alreadyLoaded) return;

    loadingAttachmentsRef.current.add(patientId);
    try {
      // Load attachments for the patient itself and all their evolutions
      const { data, error } = await supabase
        .from('attachments').select('*')
        .or(`parent_id.eq.${patientId},and(parent_type.eq.evolution,parent_id.in.(select id from evolutions where patient_id='${patientId}'))`);

      // Simpler: load patient attachments + separately load evolution attachments
      const { data: patientAtts } = await supabase
        .from('attachments').select('*')
        .eq('parent_id', patientId).eq('parent_type', 'patient');

      // Get evolution IDs for this patient
      const patientEvolutionIds = state.evolutions
        .filter(e => e.patientId === patientId)
        .map(e => e.id);

      let evolutionAtts: Attachment[] = [];
      if (patientEvolutionIds.length > 0) {
        const { data: evoAtts } = await supabase
          .from('attachments').select('*')
          .in('parent_id', patientEvolutionIds)
          .eq('parent_type', 'evolution');
        evolutionAtts = (evoAtts || []).map(a => mapAttachment(a as Record<string, unknown>));
      }

      const allAtts = [
        ...(patientAtts || []).map(a => mapAttachment(a as Record<string, unknown>)),
        ...evolutionAtts,
      ];

      setState(prev => {
        const existingIds = new Set(prev.attachments.map(a => a.id));
        const toAdd = allAtts.filter(a => !existingIds.has(a.id));
        const updated = new Set(prev.loadedAttachmentsForPatients);
        updated.add(patientId);
        return {
          ...prev,
          attachments: [...prev.attachments, ...toAdd],
          loadedAttachmentsForPatients: updated,
        };
      });
    } catch (error) {
      console.error('Error loading attachments for patient:', error);
    } finally {
      loadingAttachmentsRef.current.delete(patientId);
    }
  }, [user, state.evolutions]);

  /** Load ALL evolutions at once — used in pages like Dashboard stats, Reports, Financial */
  const loadAllEvolutions = useCallback(async () => {
    if (!user || loadingAllEvolutionsRef.current) return;
    loadingAllEvolutionsRef.current = true;
    try {
      const { data, error } = await supabase
        .from('evolutions').select('*')
        .order('date', { ascending: false });
      if (error) throw error;

      const allEvolutions = (data || []).map(e => mapEvolution(e as Record<string, unknown>));
      setState(prev => {
        // Mark all clinics as loaded
        const allClinicIds = new Set(prev.clinics.map(c => c.id));
        return { ...prev, evolutions: allEvolutions, loadedEvolutionsForClinics: allClinicIds };
      });
    } catch (error) {
      console.error('Error loading all evolutions:', error);
    } finally {
      loadingAllEvolutionsRef.current = false;
    }
  }, [user]);

  const refreshData = useCallback(async () => {
    // Reset lazy-load tracking so everything reloads
    loadingEvolutionsRef.current = new Set();
    loadingAppointmentsRef.current = new Set();
    loadingAttachmentsRef.current = new Set();
    loadingAllEvolutionsRef.current = false;
    setState(prev => ({
      ...prev,
      evolutions: [], appointments: [], attachments: [],
      loadedEvolutionsForClinics: new Set(),
      loadedAppointmentsForClinics: new Set(),
      loadedAttachmentsForPatients: new Set(),
    }));
    await loadInitialData();
  }, [loadInitialData]);

  // === Setters ===
  const setCurrentClinic = useCallback((clinic: Clinic | null) => {
    setState(prev => ({ ...prev, currentClinic: clinic, currentPatient: null }));
  }, []);

  const setCurrentPatient = useCallback((patient: Patient | null) => {
    setState(prev => ({ ...prev, currentPatient: patient }));
  }, []);

  const setSelectedDate = useCallback((date: Date) => {
    setState(prev => ({ ...prev, selectedDate: date }));
  }, []);

  // === Clinic CRUD ===
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
        email: clinic.email || null, cnpj: clinic.cnpj || null, phone: clinic.phone || null,
        services_description: clinic.servicesDescription || null, is_archived: clinic.isArchived || false,
      }).select().single();
      if (error) throw error;
      const newClinic = mapClinic(data as Record<string, unknown>);
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
      if (updates.discountPercentage !== undefined) updateData.discount_percentage = updates.discountPercentage;
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
      setState(prev => ({
        ...prev,
        clinics: prev.clinics.filter(c => c.id !== id),
        patients: prev.patients.filter(p => p.clinicId !== id),
      }));
    } catch (error) { console.error(error); toast.error('Erro ao excluir clínica'); }
  }, [user]);

  // === Patient CRUD ===
  const addPatient = useCallback(async (patient: Omit<Patient, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('patients').insert({
        user_id: user.id, clinic_id: patient.clinicId, name: patient.name, birthdate: patient.birthdate,
        phone: patient.phone || null, clinical_area: patient.clinicalArea || null,
        diagnosis: patient.diagnosis || null, professionals: patient.professionals || null,
        observations: patient.observations || null, responsible_name: patient.responsibleName || null,
        responsible_email: patient.responsibleEmail || null, payment_type: patient.paymentType || null,
        payment_value: patient.paymentValue || null, contract_start_date: patient.contractStartDate || null,
        weekdays: patient.weekdays || null, schedule_time: patient.scheduleTime || null,
        schedule_by_day: patient.scheduleByDay || null, package_id: patient.packageId || null,
      }).select().single();
      if (error) throw error;
      const newPatient = mapPatient(data as Record<string, unknown>);
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
      if (updates.isArchived !== undefined) updateData.is_archived = updates.isArchived;
      if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl || null;
      if (updates.packageId !== undefined) updateData.package_id = updates.packageId || null;
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

  // === Evolution CRUD ===
  const addEvolution = useCallback(async (evolution: Omit<Evolution, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase.from('evolutions')
        .select('id').eq('patient_id', evolution.patientId)
        .eq('date', evolution.date).eq('clinic_id', evolution.clinicId).maybeSingle();
      if (existing) { toast.error('Já existe uma evolução para este paciente nesta data.'); return; }

      const { data, error } = await supabase.from('evolutions').insert({
        user_id: user.id, patient_id: evolution.patientId, clinic_id: evolution.clinicId,
        date: evolution.date, text: evolution.text, attendance_status: evolution.attendanceStatus,
        signature: evolution.signature || null, stamp_id: evolution.stampId || null,
        confirmed_attendance: evolution.confirmedAttendance || false, mood: evolution.mood || null,
        template_id: evolution.templateId || null, template_data: evolution.templateData || null,
      }).select().single();
      if (error) throw error;

      const savedAttachments: Attachment[] = [];
      if (evolution.attachments && evolution.attachments.length > 0) {
        for (const att of evolution.attachments) {
          try {
            const { data: attData, error: attError } = await supabase.from('attachments').insert({
              user_id: user.id, parent_id: data.id, parent_type: 'evolution',
              name: att.name, file_path: att.data, file_type: att.type,
            }).select().single();
            if (attError) { console.error('Error saving attachment:', attError); continue; }
            if (attData) savedAttachments.push(mapAttachment(attData as Record<string, unknown>));
          } catch (attErr) { console.error('Error inserting attachment:', attErr); }
        }
      }

      const newEvolution: Evolution = {
        ...mapEvolution(data as Record<string, unknown>),
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
      if (updates.templateId !== undefined) updateData.template_id = updates.templateId || null;
      if (updates.templateData !== undefined) updateData.template_data = updates.templateData || null;
      const { error } = await supabase.from('evolutions').update(updateData).eq('id', id);
      if (error) throw error;

      if (updates.attachments !== undefined) {
        const { data: existingAtts } = await supabase.from('attachments')
          .select('id').eq('parent_id', id).eq('parent_type', 'evolution');
        const existingIds = new Set((existingAtts || []).map(a => a.id));
        const newAttIds = new Set((updates.attachments || []).map(a => a.id));
        const toDelete = [...existingIds].filter(aid => !newAttIds.has(aid));
        for (const aid of toDelete) await supabase.from('attachments').delete().eq('id', aid);
        const toInsert = (updates.attachments || []).filter(a => a.id.startsWith('temp_'));
        const savedAttachments: Attachment[] = [];
        for (const att of toInsert) {
          const { data: attData, error: attError } = await supabase.from('attachments').insert({
            user_id: user.id, parent_id: id, parent_type: 'evolution',
            name: att.name, file_path: att.data, file_type: att.type,
          }).select().single();
          if (!attError && attData) savedAttachments.push(mapAttachment(attData as Record<string, unknown>));
        }
        setState(prev => ({
          ...prev,
          attachments: [
            ...prev.attachments.filter(a => !(a.parentId === id && a.parentType === 'evolution' && toDelete.includes(a.id))),
            ...savedAttachments,
          ],
        }));
      }

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

  // === Appointment CRUD ===
  const addAppointment = useCallback(async (appointment: Omit<Appointment, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('appointments').insert({
        user_id: user.id, patient_id: appointment.patientId, clinic_id: appointment.clinicId,
        date: appointment.date, time: appointment.time, notes: appointment.notes || null,
      }).select().single();
      if (error) throw error;
      setState(prev => ({ ...prev, appointments: [mapAppointment(data as Record<string, unknown>), ...prev.appointments] }));
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

  // === Task CRUD ===
  const addTask = useCallback(async (title: string, patientId?: string) => {
    if (!user) return;
    try {
      const insertData: Record<string, unknown> = { user_id: user.id, title, completed: false };
      if (patientId) insertData.patient_id = patientId;
      const { data, error } = await supabase.from('tasks').insert(insertData).select().single();
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: [mapTask(data as Record<string, unknown>), ...prev.tasks] }));
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

  const updateTaskNotes = useCallback(async (id: string, notes: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('tasks').update({ notes }).eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, notes } : t) }));
    } catch (error) { console.error(error); toast.error('Erro ao atualizar notas'); }
  }, [user]);

  // === Packages CRUD ===
  const addPackage = useCallback(async (pkg: Omit<ClinicPackage, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('clinic_packages').insert({
        user_id: user.id, clinic_id: pkg.clinicId, name: pkg.name,
        description: pkg.description || null, price: pkg.price, is_active: pkg.isActive,
      }).select().single();
      if (error) throw error;
      setState(prev => ({ ...prev, clinicPackages: [mapPackage(data as Record<string, unknown>), ...prev.clinicPackages] }));
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

  // === Attachments CRUD ===
  const addAttachment = useCallback(async (attachment: Omit<Attachment, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('attachments').insert({
        user_id: user.id, parent_id: attachment.parentId, parent_type: attachment.parentType,
        name: attachment.name, file_path: attachment.data, file_type: attachment.type,
      }).select().single();
      if (error) throw error;
      setState(prev => ({ ...prev, attachments: [mapAttachment(data as Record<string, unknown>), ...prev.attachments] }));
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

  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const newPayment: Payment = { ...payment, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setState(prev => ({ ...prev, payments: [newPayment, ...prev.payments] }));
  }, []);

  // === Selectors ===
  const getClinicPatients = useCallback((clinicId: string) => state.patients.filter(p => p.clinicId === clinicId), [state.patients]);
  const getPatientEvolutions = useCallback((patientId: string) => state.evolutions.filter(e => e.patientId === patientId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [state.evolutions]);
  const getDateAppointments = useCallback((date: Date) => { const d = toLocalDateString(date); return state.appointments.filter(a => a.date === d).sort((a, b) => a.time.localeCompare(b.time)); }, [state.appointments]);
  const getClinicPackages = useCallback((clinicId: string) => state.clinicPackages.filter(p => p.clinicId === clinicId && p.isActive), [state.clinicPackages]);
  const getPatientTasks = useCallback((patientId: string) => state.tasks.filter(t => t.patientId === patientId), [state.tasks]);
  const getPatientAttachments = useCallback((patientId: string) => state.attachments.filter(a => a.parentType === 'patient' && a.parentId === patientId), [state.attachments]);

  return (
    <AppContext.Provider value={{
      ...state,
      setCurrentClinic, setCurrentPatient, setSelectedDate,
      addClinic, updateClinic, deleteClinic,
      addPatient, updatePatient, deletePatient,
      addEvolution, updateEvolution, deleteEvolution,
      addAppointment, deleteAppointment,
      addTask, toggleTask, deleteTask, updateTaskNotes,
      addPayment,
      getClinicPatients, getPatientEvolutions, getDateAppointments,
      addPackage, updatePackage, deletePackage, getClinicPackages,
      getPatientTasks, getPatientAttachments, addAttachment, deleteAttachment,
      loadEvolutionsForClinic, loadAppointmentsForClinic, loadAttachmentsForPatient,
      loadAllEvolutions, refreshData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
}
