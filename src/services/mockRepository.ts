// Mock data repository using LocalStorage

export interface Paciente {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  whatsapp: string;
  email: string;
  dataNascimento: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agendamento {
  id: string;
  pacienteId: string;
  pacienteNome?: string; // Cache for easy displaying
  pacienteTelefone?: string;
  tipoAtendimento: string;
  data: string;
  horario: string;
  observacoes: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  protocolo: string;
  createdAt: string;
  updatedAt: string;
  pacienteCpf?: string;
  pacienteTelefoneFixo?: string;
  pacienteEmail?: string;
  pacienteDataNascimento?: string;
}

export interface Evolution {
  data: string;
  texto: string;
}

export interface Anexo {
  nome: string;
  url: string;
  tipo: string;
  tamanho: string;
  dataAnexo: string;
}

export interface Prontuario {
  id: string;
  pacienteId: string;
  queixaPrincipal: string;
  avaliacaoFisica: string;
  diagnosticoFuncional: string;
  planoTratamento: string;
  evolucoes: Evolution[];
  anexos: Anexo[];
  createdAt: string;
  updatedAt: string;
}

export interface Depoimento {
  id: string;
  nome: string;
  estrelas: number;
  comentario: string;
  data: string;
}

// Helper to check if database is seeded
const isSeeded = (): boolean => !!localStorage.getItem('kf_seeded');

const seedData = () => {
  const initialPacientes: Paciente[] = [];
  const initialAgendamentos: Agendamento[] = [];
  const initialProntuarios: Prontuario[] = [];
  const initialDepoimentos: Depoimento[] = [];

  localStorage.setItem('kf_pacientes', JSON.stringify(initialPacientes));
  localStorage.setItem('kf_agendamentos', JSON.stringify(initialAgendamentos));
  localStorage.setItem('kf_prontuarios', JSON.stringify(initialProntuarios));
  localStorage.setItem('kf_depoimentos', JSON.stringify(initialDepoimentos));
  localStorage.setItem('kf_seeded', 'true');
};

export const initMockDb = () => {
  if (!isSeeded()) {
    seedData();
  }
};

// --- PACIENTES API ---
export const mockGetPacientes = (): Paciente[] => {
  initMockDb();
  return JSON.parse(localStorage.getItem('kf_pacientes') || '[]');
};

export const mockSavePaciente = (paciente: Omit<Paciente, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Paciente => {
  const pacientes = mockGetPacientes();
  const now = new Date().toISOString();
  
  if (paciente.id) {
    // Update
    const idx = pacientes.findIndex(p => p.id === paciente.id);
    if (idx !== -1) {
      const updated: Paciente = {
        ...pacientes[idx],
        ...paciente,
        id: paciente.id,
        updatedAt: now
      };
      pacientes[idx] = updated;
      localStorage.setItem('kf_pacientes', JSON.stringify(pacientes));
      // Update names cached in appointments
      mockUpdateCachedNames(paciente.id, paciente.nome, paciente.telefone);
      return updated;
    }
  }
  
  // Create
  const newPaciente: Paciente = {
    ...paciente,
    id: `pac-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  };
  pacientes.push(newPaciente);
  localStorage.setItem('kf_pacientes', JSON.stringify(pacientes));
  return newPaciente;
};

export const mockDeletePaciente = (id: string): boolean => {
  let pacientes = mockGetPacientes();
  const lengthBefore = pacientes.length;
  pacientes = pacientes.filter(p => p.id !== id);
  localStorage.setItem('kf_pacientes', JSON.stringify(pacientes));
  
  // Also delete bookings related to this patient
  let agendamentos = mockGetAgendamentos();
  agendamentos = agendamentos.filter(a => a.pacienteId !== id);
  localStorage.setItem('kf_agendamentos', JSON.stringify(agendamentos));
  
  // Also delete medical record
  let prontuarios = JSON.parse(localStorage.getItem('kf_prontuarios') || '[]');
  prontuarios = prontuarios.filter((p: any) => p.pacienteId !== id);
  localStorage.setItem('kf_prontuarios', JSON.stringify(prontuarios));

  return pacientes.length < lengthBefore;
};

// --- AGENDAMENTOS API ---
export const mockGetAgendamentos = (): Agendamento[] => {
  initMockDb();
  return JSON.parse(localStorage.getItem('kf_agendamentos') || '[]');
};

export const mockSaveAgendamento = (agendamento: Omit<Agendamento, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Agendamento => {
  const agendamentos = mockGetAgendamentos();
  const now = new Date().toISOString();

  // Find or create patient first to tie the appointment
  let pacienteId = agendamento.pacienteId;
  if (!pacienteId && agendamento.pacienteNome) {
    // Check if patient exists by name/tel, otherwise create
    const pacientes = mockGetPacientes();
    const existing = pacientes.find(p => p.nome.toLowerCase() === agendamento.pacienteNome?.toLowerCase());
    if (existing) {
      pacienteId = existing.id;
    } else {
      const newP = mockSavePaciente({
        nome: agendamento.pacienteNome,
        cpf: agendamento.pacienteCpf || '',
        telefone: agendamento.pacienteTelefoneFixo || agendamento.pacienteTelefone || '',
        whatsapp: agendamento.pacienteTelefone || '',
        email: agendamento.pacienteEmail || '',
        dataNascimento: agendamento.pacienteDataNascimento || ''
      });
      pacienteId = newP.id;
    }
  }

  if (agendamento.id) {
    // Update
    const idx = agendamentos.findIndex(a => a.id === agendamento.id);
    if (idx !== -1) {
      const updated: Agendamento = {
        ...agendamentos[idx],
        ...agendamento,
        pacienteId,
        id: agendamento.id,
        updatedAt: now
      };
      agendamentos[idx] = updated;
      localStorage.setItem('kf_agendamentos', JSON.stringify(agendamentos));
      return updated;
    }
  }

  // Create
  const newAgendamento: Agendamento = {
    ...agendamento,
    pacienteId,
    id: `age-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  };
  agendamentos.push(newAgendamento);
  localStorage.setItem('kf_agendamentos', JSON.stringify(agendamentos));
  return newAgendamento;
};

export const mockUpdateAgendamentoStatus = (id: string, status: Agendamento['status']): boolean => {
  const agendamentos = mockGetAgendamentos();
  const idx = agendamentos.findIndex(a => a.id === id);
  if (idx !== -1) {
    agendamentos[idx].status = status;
    agendamentos[idx].updatedAt = new Date().toISOString();
    localStorage.setItem('kf_agendamentos', JSON.stringify(agendamentos));
    return true;
  }
  return false;
};

export const mockDeleteAgendamento = (id: string): boolean => {
  let agendamentos = mockGetAgendamentos();
  const lengthBefore = agendamentos.length;
  agendamentos = agendamentos.filter(a => a.id !== id);
  localStorage.setItem('kf_agendamentos', JSON.stringify(agendamentos));
  return agendamentos.length < lengthBefore;
};

const mockUpdateCachedNames = (pacienteId: string, nome: string, tel: string) => {
  const agendamentos = mockGetAgendamentos();
  let updated = false;
  agendamentos.forEach(a => {
    if (a.pacienteId === pacienteId) {
      a.pacienteNome = nome;
      a.pacienteTelefone = tel;
      updated = true;
    }
  });
  if (updated) {
    localStorage.setItem('kf_agendamentos', JSON.stringify(agendamentos));
  }
};

// --- PRONTUÁRIOS API ---
export const mockGetProntuario = (pacienteId: string): Prontuario | null => {
  initMockDb();
  const prontuarios: Prontuario[] = JSON.parse(localStorage.getItem('kf_prontuarios') || '[]');
  const found = prontuarios.find(p => p.pacienteId === pacienteId);
  return found || null;
};

export const mockSaveProntuario = (prontuario: Omit<Prontuario, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Prontuario => {
  const prontuarios: Prontuario[] = JSON.parse(localStorage.getItem('kf_prontuarios') || '[]');
  const now = new Date().toISOString();

  if (prontuario.id) {
    const idx = prontuarios.findIndex(p => p.id === prontuario.id);
    if (idx !== -1) {
      const updated: Prontuario = {
        ...prontuarios[idx],
        ...prontuario,
        id: prontuario.id,
        updatedAt: now
      };
      prontuarios[idx] = updated;
      localStorage.setItem('kf_prontuarios', JSON.stringify(prontuarios));
      return updated;
    }
  }

  // Create
  const newProntuario: Prontuario = {
    ...prontuario,
    id: `pront-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  };
  prontuarios.push(newProntuario);
  localStorage.setItem('kf_prontuarios', JSON.stringify(prontuarios));
  return newProntuario;
};

export const mockAddEvolution = (pacienteId: string, texto: string): Evolution => {
  const nowStr = new Date().toISOString().split('T')[0];
  const newEvolution: Evolution = {
    data: nowStr,
    texto
  };
  
  let prontuario = mockGetProntuario(pacienteId);
  if (!prontuario) {
    prontuario = mockSaveProntuario({
      pacienteId,
      queixaPrincipal: '',
      avaliacaoFisica: '',
      diagnosticoFuncional: '',
      planoTratamento: '',
      evolucoes: [newEvolution],
      anexos: []
    });
  } else {
    prontuario.evolucoes.unshift(newEvolution); // Add to beginning (latest first)
    mockSaveProntuario(prontuario);
  }
  
  return newEvolution;
};

export const mockAddAnexo = (pacienteId: string, anexo: Omit<Anexo, 'dataAnexo'>): Anexo => {
  const nowStr = new Date().toISOString().split('T')[0];
  const newAnexo: Anexo = {
    ...anexo,
    dataAnexo: nowStr
  };

  let prontuario = mockGetProntuario(pacienteId);
  if (!prontuario) {
    prontuario = mockSaveProntuario({
      pacienteId,
      queixaPrincipal: '',
      avaliacaoFisica: '',
      diagnosticoFuncional: '',
      planoTratamento: '',
      evolucoes: [],
      anexos: [newAnexo]
    });
  } else {
    prontuario.anexos.push(newAnexo);
    mockSaveProntuario(prontuario);
  }

  return newAnexo;
};

// --- DEPOIMENTOS API ---
export const mockGetDepoimentos = (): Depoimento[] => {
  initMockDb();
  return JSON.parse(localStorage.getItem('kf_depoimentos') || '[]');
};

export const mockSaveDepoimento = (depoimento: Omit<Depoimento, 'id' | 'data'>): Depoimento => {
  const depoimentos = mockGetDepoimentos();
  const newDep: Depoimento = {
    ...depoimento,
    id: `dep-${Date.now()}`,
    data: new Date().toISOString().split('T')[0]
  };
  depoimentos.push(newDep);
  localStorage.setItem('kf_depoimentos', JSON.stringify(depoimentos));
  return newDep;
};
