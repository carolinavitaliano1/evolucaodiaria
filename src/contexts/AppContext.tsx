import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Clinic, Patient, Evolution, Appointment, Task, Payment, Attachment, ClinicNote } from '@/types';

interface AppState {
  clinics: Clinic[];
  patients: Patient[];
  evolutions: Evolution[];
  appointments: Appointment[];
  tasks: Task[];
  payments: Payment[];
  attachments: Attachment[];
  clinicNotes: ClinicNote[];
  currentClinic: Clinic | null;
  currentPatient: Patient | null;
  selectedDate: Date;
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
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void;
  getClinicPatients: (clinicId: string) => Patient[];
  getPatientEvolutions: (patientId: string) => Evolution[];
  getDateAppointments: (date: Date) => Appointment[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    clinics: [],
    patients: [],
    evolutions: [],
    appointments: [],
    tasks: [],
    payments: [],
    attachments: [],
    clinicNotes: [],
    currentClinic: null,
    currentPatient: null,
    selectedDate: new Date(),
  });

  const setCurrentClinic = useCallback((clinic: Clinic | null) => {
    setState(prev => ({ ...prev, currentClinic: clinic, currentPatient: null }));
  }, []);

  const setCurrentPatient = useCallback((patient: Patient | null) => {
    setState(prev => ({ ...prev, currentPatient: patient }));
  }, []);

  const setSelectedDate = useCallback((date: Date) => {
    setState(prev => ({ ...prev, selectedDate: date }));
  }, []);

  const addClinic = useCallback((clinic: Omit<Clinic, 'id' | 'createdAt'>) => {
    const newClinic: Clinic = {
      ...clinic,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, clinics: [...prev.clinics, newClinic] }));
  }, []);

  const updateClinic = useCallback((id: string, updates: Partial<Clinic>) => {
    setState(prev => ({
      ...prev,
      clinics: prev.clinics.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  }, []);

  const deleteClinic = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      clinics: prev.clinics.filter(c => c.id !== id),
      patients: prev.patients.filter(p => p.clinicId !== id),
    }));
  }, []);

  const addPatient = useCallback((patient: Omit<Patient, 'id' | 'createdAt'>) => {
    const newPatient: Patient = {
      ...patient,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, patients: [...prev.patients, newPatient] }));
  }, []);

  const updatePatient = useCallback((id: string, updates: Partial<Patient>) => {
    setState(prev => ({
      ...prev,
      patients: prev.patients.map(p => p.id === id ? { ...p, ...updates } : p),
    }));
  }, []);

  const deletePatient = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      patients: prev.patients.filter(p => p.id !== id),
    }));
  }, []);

  const addEvolution = useCallback((evolution: Omit<Evolution, 'id' | 'createdAt'>) => {
    const newEvolution: Evolution = {
      ...evolution,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, evolutions: [...prev.evolutions, newEvolution] }));
  }, []);

  const updateEvolution = useCallback((id: string, updates: Partial<Evolution>) => {
    setState(prev => ({
      ...prev,
      evolutions: prev.evolutions.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  }, []);

  const deleteEvolution = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      evolutions: prev.evolutions.filter(e => e.id !== id),
    }));
  }, []);

  const addAppointment = useCallback((appointment: Omit<Appointment, 'id' | 'createdAt'>) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, appointments: [...prev.appointments, newAppointment] }));
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      appointments: prev.appointments.filter(a => a.id !== id),
    }));
  }, []);

  const addTask = useCallback((title: string) => {
    const newTask: Task = {
      id: generateId(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id),
    }));
  }, []);

  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const newPayment: Payment = {
      ...payment,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
  }, []);

  const getClinicPatients = useCallback((clinicId: string) => {
    return state.patients.filter(p => p.clinicId === clinicId);
  }, [state.patients]);

  const getPatientEvolutions = useCallback((patientId: string) => {
    return state.evolutions.filter(e => e.patientId === patientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.evolutions]);

  const getDateAppointments = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return state.appointments.filter(a => a.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [state.appointments]);

  return (
    <AppContext.Provider value={{
      ...state,
      setCurrentClinic,
      setCurrentPatient,
      setSelectedDate,
      addClinic,
      updateClinic,
      deleteClinic,
      addPatient,
      updatePatient,
      deletePatient,
      addEvolution,
      updateEvolution,
      deleteEvolution,
      addAppointment,
      deleteAppointment,
      addTask,
      toggleTask,
      deleteTask,
      addPayment,
      getClinicPatients,
      getPatientEvolutions,
      getDateAppointments,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
