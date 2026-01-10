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

// Sample data for demonstration
const sampleClinics: Clinic[] = [
  {
    id: 'clinic_1',
    name: 'Clínica Mente Saudável',
    type: 'propria',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    weekdays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
    scheduleTime: '08:00 às 18:00',
    paymentType: 'sessao',
    paymentAmount: 150,
    paysOnAbsence: true, // Clínica própria - recebe mesmo com falta
    createdAt: new Date().toISOString(),
  },
  {
    id: 'clinic_2',
    name: 'Centro de Psicologia Integrada',
    type: 'terceirizada',
    address: 'Rua Augusta, 500 - São Paulo, SP',
    weekdays: ['Segunda', 'Quarta', 'Sexta'],
    scheduleTime: '14:00 às 20:00',
    paymentType: 'fixo_mensal',
    paymentAmount: 3500,
    paysOnAbsence: false, // Terceirizada - não paga por faltas
    createdAt: new Date().toISOString(),
  },
];

const samplePatients: Patient[] = [
  {
    id: 'patient_1',
    clinicId: 'clinic_1',
    name: 'João Silva',
    birthdate: '1990-05-15',
    phone: '(11) 99999-1234',
    clinicalArea: 'Psicologia Clínica',
    diagnosis: 'F41.1 - Transtorno de Ansiedade Generalizada',
    paymentType: 'sessao',
    paymentValue: 150,
    weekdays: ['Segunda', 'Quinta'],
    scheduleTime: '10:00',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'patient_2',
    clinicId: 'clinic_1',
    name: 'Maria Santos',
    birthdate: '1985-08-22',
    phone: '(11) 98888-5678',
    clinicalArea: 'Neuropsicologia',
    diagnosis: 'F84.0 - Transtorno do Espectro Autista',
    paymentType: 'fixo',
    paymentValue: 600,
    weekdays: ['Terça', 'Sexta'],
    scheduleTime: '14:00',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'patient_3',
    clinicId: 'clinic_2',
    name: 'Pedro Oliveira',
    birthdate: '2015-03-10',
    phone: '(11) 97777-9012',
    clinicalArea: 'Fonoaudiologia',
    responsibleName: 'Ana Oliveira',
    responsibleEmail: 'ana@email.com',
    paymentType: 'sessao',
    paymentValue: 120,
    weekdays: ['Quarta'],
    scheduleTime: '15:00',
    createdAt: new Date().toISOString(),
  },
];

const sampleAppointments: Appointment[] = [
  {
    id: 'apt_1',
    patientId: 'patient_1',
    clinicId: 'clinic_1',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'apt_2',
    patientId: 'patient_2',
    clinicId: 'clinic_1',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    createdAt: new Date().toISOString(),
  },
];

// Generate sample evolutions for the last 30 days
const generateSampleEvolutions = (): Evolution[] => {
  const evolutions: Evolution[] = [];
  const patients = ['patient_1', 'patient_2', 'patient_3'];
  const clinics = ['clinic_1', 'clinic_1', 'clinic_2'];
  const evolutionTexts = [
    'Paciente apresentou melhora significativa no controle da ansiedade.',
    'Trabalhamos técnicas de respiração e relaxamento muscular progressivo.',
    'Sessão focada em reestruturação cognitiva de pensamentos automáticos.',
    'Paciente relatou melhora na qualidade do sono após exercícios de mindfulness.',
    'Aplicação de técnicas de exposição gradual para situações ansiogênicas.',
    'Discussão sobre estratégias de enfrentamento para situações de estresse.',
    'Avaliação do progresso terapêutico e ajuste dos objetivos.',
    'Treino de habilidades sociais e comunicação assertiva.',
  ];

  const today = new Date();
  
  // Generate evolutions for the last 30 days
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const dayOfWeek = date.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    // Randomly assign evolutions to patients (not every patient every day)
    patients.forEach((patientId, index) => {
      // ~70% chance of having an evolution on a given day
      if (Math.random() > 0.3) {
        // ~80% presence rate, 20% absence rate
        const isPresent = Math.random() > 0.2;
        
        evolutions.push({
          id: `evolution_${daysAgo}_${patientId}`,
          patientId,
          clinicId: clinics[index],
          date: date.toISOString().split('T')[0],
          text: isPresent 
            ? evolutionTexts[Math.floor(Math.random() * evolutionTexts.length)]
            : 'Paciente não compareceu à sessão.',
          attendanceStatus: isPresent ? 'presente' : 'falta',
          createdAt: date.toISOString(),
        });
      }
    });
  }
  
  return evolutions;
};

const sampleEvolutions = generateSampleEvolutions();

const sampleTasks: Task[] = [
  { id: 'task_1', title: 'Preparar relatório mensal', completed: false, createdAt: new Date().toISOString() },
  { id: 'task_2', title: 'Ligar para responsável do Pedro', completed: false, createdAt: new Date().toISOString() },
  { id: 'task_3', title: 'Atualizar prontuário da Maria', completed: true, createdAt: new Date().toISOString() },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    clinics: sampleClinics,
    patients: samplePatients,
    evolutions: sampleEvolutions,
    appointments: sampleAppointments,
    tasks: sampleTasks,
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
