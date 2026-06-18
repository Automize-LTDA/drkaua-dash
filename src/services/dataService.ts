import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseAvailable, auth } from '../firebase/firebase-config';
import * as mock from './mockRepository';

// Helper to wrap Firestore operations in a promise timeout
const withTimeout = <T>(promise: Promise<T>, ms: number = 7000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout de conexão com o banco de dados")), ms)
    )
  ]);
};

// --- PACIENTES SERVICES ---
export const getPacientes = async (): Promise<mock.Paciente[]> => {
  if (!isFirebaseAvailable) {
    return mock.mockGetPacientes();
  }
  
  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, 'pacientes')));
    const list: mock.Paciente[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        nome: data.nome,
        cpf: data.cpf,
        telefone: data.telefone,
        whatsapp: data.whatsapp,
        email: data.email,
        dataNascimento: data.dataNascimento,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
      });
    });
    return list;
  } catch (error) {
    console.error("Firebase error, loading mock data:", error);
    return mock.mockGetPacientes();
  }
};

export const savePaciente = async (
  paciente: Omit<mock.Paciente, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<mock.Paciente> => {
  if (!isFirebaseAvailable) {
    return mock.mockSavePaciente(paciente);
  }

  try {
    const now = new Date().toISOString();
    if (paciente.id) {
      // Update
      const docRef = doc(db, 'pacientes', paciente.id);
      const data = {
        ...paciente,
        updatedAt: serverTimestamp()
      };
      await withTimeout(updateDoc(docRef, data));
      
      return {
        ...paciente,
        id: paciente.id,
        createdAt: now, // Will be corrected on next fetch
        updatedAt: now
      } as mock.Paciente;
    } else {
      // Create
      const docRef = doc(collection(db, 'pacientes'));
      const newPaciente = {
        ...paciente,
        id: docRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await withTimeout(setDoc(docRef, newPaciente));
      
      return {
        ...paciente,
        id: docRef.id,
        createdAt: now,
        updatedAt: now
      } as mock.Paciente;
    }
  } catch (error) {
    console.error("Firebase error, using mock saving:", error);
    return mock.mockSavePaciente(paciente);
  }
};

export const deletePaciente = async (id: string): Promise<boolean> => {
  if (!isFirebaseAvailable) {
    return mock.mockDeletePaciente(id);
  }

  try {
    await deleteDoc(doc(db, 'pacientes', id));
    
    // Cascading delete for appointments
    const q = query(collection(db, 'agendamentos'), where('pacienteId', '==', id));
    const querySnapshot = await getDocs(q);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, 'agendamentos', docSnap.id)));
    });
    await Promise.all(deletePromises);

    // Cascading delete for prontuário
    const qPront = query(collection(db, 'prontuarios'), where('pacienteId', '==', id));
    const prontSnapshot = await getDocs(qPront);
    const prontPromises: Promise<void>[] = [];
    prontSnapshot.forEach((docSnap) => {
      prontPromises.push(deleteDoc(doc(db, 'prontuarios', docSnap.id)));
    });
    await Promise.all(prontPromises);

    return true;
  } catch (error) {
    console.error("Firebase error, deleting locally:", error);
    return mock.mockDeletePaciente(id);
  }
};

// --- AGENDAMENTOS SERVICES ---
export const getAgendamentos = async (): Promise<mock.Agendamento[]> => {
  if (!isFirebaseAvailable) {
    return mock.mockGetAgendamentos();
  }

  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, 'agendamentos')));
    const list: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        pacienteId: data.pacienteId,
        pacienteNome: data.pacienteNome,
        pacienteTelefone: data.pacienteTelefone,
        tipoAtendimento: data.tipoAtendimento,
        data: data.data,
        horario: data.horario,
        observacoes: data.observacoes || '',
        status: data.status,
        protocolo: data.protocolo,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
        pacienteCpf: data.pacienteCpf || '',
        pacienteTelefoneFixo: data.pacienteTelefoneFixo || '',
        pacienteEmail: data.pacienteEmail || '',
        pacienteDataNascimento: data.pacienteDataNascimento || '',
      });
    });
    return list;
  } catch (error) {
    console.error("Firebase error, listing mock bookings:", error);
    return mock.mockGetAgendamentos();
  }
};

export const saveAgendamento = async (
  agendamento: Omit<mock.Agendamento, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<mock.Agendamento> => {
  if (!isFirebaseAvailable) {
    return mock.mockSaveAgendamento(agendamento);
  }

  try {
    const now = new Date().toISOString();
    let pacienteId = agendamento.pacienteId;
    
    // Check if user is logged in as an Admin. If not (public visitor), skip patients operations to avoid security rule blocks.
    const isUserAdmin = auth && auth.currentUser;
    
    if (isUserAdmin && !pacienteId && agendamento.pacienteNome) {
      try {
        const pacientes = await getPacientes();
        const existing = pacientes.find(p => p.nome.toLowerCase() === agendamento.pacienteNome?.toLowerCase());
        if (existing) {
          pacienteId = existing.id;
        } else {
          const newP = await savePaciente({
            nome: agendamento.pacienteNome,
            cpf: (agendamento as any).pacienteCpf || '',
            telefone: (agendamento as any).pacienteTelefoneFixo || agendamento.pacienteTelefone || '',
            whatsapp: agendamento.pacienteTelefone || '',
            email: (agendamento as any).pacienteEmail || '',
            dataNascimento: (agendamento as any).pacienteDataNascimento || ''
          });
          pacienteId = newP.id;
        }
      } catch (e) {
        console.warn("Failed to automatically link patient:", e);
      }
    }

    if (agendamento.id) {
      // Update
      const docRef = doc(db, 'agendamentos', agendamento.id);
      const data = {
        ...agendamento,
        pacienteId,
        updatedAt: serverTimestamp()
      };
      await withTimeout(updateDoc(docRef, data));
      
      return {
        ...agendamento,
        pacienteId,
        id: agendamento.id,
        createdAt: now,
        updatedAt: now
      } as mock.Agendamento;
    } else {
      // Create
      const docRef = doc(collection(db, 'agendamentos'));
      const newAge = {
        ...agendamento,
        pacienteId,
        id: docRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await withTimeout(setDoc(docRef, newAge));
      
      return {
        ...agendamento,
        pacienteId,
        id: docRef.id,
        createdAt: now,
        updatedAt: now
      } as mock.Agendamento;
    }
  } catch (error) {
    console.error("Firebase error, saving booking locally:", error);
    return mock.mockSaveAgendamento(agendamento);
  }
};

export const updateAgendamentoStatus = async (
  id: string, 
  status: mock.Agendamento['status']
): Promise<boolean> => {
  if (!isFirebaseAvailable) {
    return mock.mockUpdateAgendamentoStatus(id, status);
  }

  try {
    const docRef = doc(db, 'agendamentos', id);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Firebase error updating status, mock instead:", error);
    return mock.mockUpdateAgendamentoStatus(id, status);
  }
};

export const deleteAgendamento = async (id: string): Promise<boolean> => {
  if (!isFirebaseAvailable) {
    return mock.mockDeleteAgendamento(id);
  }

  try {
    await deleteDoc(doc(db, 'agendamentos', id));
    return true;
  } catch (error) {
    console.error("Firebase error deleting booking, mock instead:", error);
    return mock.mockDeleteAgendamento(id);
  }
};

// --- PRONTUÁRIOS SERVICES ---
export const getProntuario = async (pacienteId: string): Promise<mock.Prontuario | null> => {
  if (!isFirebaseAvailable) {
    return mock.mockGetProntuario(pacienteId);
  }

  try {
    const q = query(collection(db, 'prontuarios'), where('pacienteId', '==', pacienteId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      return {
        id: docSnap.id,
        pacienteId: data.pacienteId,
        queixaPrincipal: data.queixaPrincipal,
        avaliacaoFisica: data.avaliacaoFisica,
        diagnosticoFuncional: data.diagnosticoFuncional,
        planoTratamento: data.planoTratamento,
        evolucoes: data.evolucoes || [],
        anexos: data.anexos || [],
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch (error) {
    console.error("Firebase error reading record, mock instead:", error);
    return mock.mockGetProntuario(pacienteId);
  }
};

export const saveProntuario = async (
  prontuario: Omit<mock.Prontuario, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<mock.Prontuario> => {
  if (!isFirebaseAvailable) {
    return mock.mockSaveProntuario(prontuario);
  }

  try {
    const now = new Date().toISOString();
    if (prontuario.id) {
      const docRef = doc(db, 'prontuarios', prontuario.id);
      await updateDoc(docRef, {
        ...prontuario,
        updatedAt: serverTimestamp()
      });
      return {
        ...prontuario,
        id: prontuario.id,
        createdAt: now,
        updatedAt: now
      } as mock.Prontuario;
    } else {
      const docRef = doc(collection(db, 'prontuarios'));
      const newPront = {
        ...prontuario,
        id: docRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, newPront);
      return {
        ...prontuario,
        id: docRef.id,
        createdAt: now,
        updatedAt: now
      } as mock.Prontuario;
    }
  } catch (error) {
    console.error("Firebase error saving medical record, mock instead:", error);
    return mock.mockSaveProntuario(prontuario);
  }
};

export const addEvolution = async (pacienteId: string, texto: string): Promise<mock.Evolution> => {
  if (!isFirebaseAvailable) {
    return mock.mockAddEvolution(pacienteId, texto);
  }

  try {
    const nowStr = new Date().toISOString().split('T')[0];
    const newEvolution: mock.Evolution = {
      data: nowStr,
      texto
    };

    const prontuario = await getProntuario(pacienteId);
    if (!prontuario) {
      await saveProntuario({
        pacienteId,
        queixaPrincipal: '',
        avaliacaoFisica: '',
        diagnosticoFuncional: '',
        planoTratamento: '',
        evolucoes: [newEvolution],
        anexos: []
      });
    } else {
      const updatedEvolutions = [newEvolution, ...prontuario.evolucoes];
      await saveProntuario({
        ...prontuario,
        evolucoes: updatedEvolutions
      });
    }
    return newEvolution;
  } catch (error) {
    console.error("Firebase error adding evolution, mock instead:", error);
    return mock.mockAddEvolution(pacienteId, texto);
  }
};

// Handle file uploads to Firebase Storage or mock it locally
export const addAnexo = async (
  pacienteId: string, 
  nomeArquivo: string, 
  tipoArquivo: string, 
  tamanhoArquivo: string, 
  fileBlob?: Blob
): Promise<mock.Anexo> => {
  
  if (!isFirebaseAvailable || !fileBlob) {
    // Return mock attachment reference
    return mock.mockAddAnexo(pacienteId, {
      nome: nomeArquivo,
      url: '#', // In mock mode, url is just dummy
      tipo: tipoArquivo,
      tamanho: tamanhoArquivo
    });
  }

  try {
    const storageRef = ref(storage, `prontuarios/${pacienteId}/${Date.now()}_${nomeArquivo}`);
    await uploadBytes(storageRef, fileBlob);
    const downloadUrl = await getDownloadURL(storageRef);
    
    const nowStr = new Date().toISOString().split('T')[0];
    const newAnexo: mock.Anexo = {
      nome: nomeArquivo,
      url: downloadUrl,
      tipo: tipoArquivo,
      tamanho: tamanhoArquivo,
      dataAnexo: nowStr
    };

    const prontuario = await getProntuario(pacienteId);
    if (!prontuario) {
      await saveProntuario({
        pacienteId,
        queixaPrincipal: '',
        avaliacaoFisica: '',
        diagnosticoFuncional: '',
        planoTratamento: '',
        evolucoes: [],
        anexos: [newAnexo]
      });
    } else {
      const updatedAnexos = [...prontuario.anexos, newAnexo];
      await saveProntuario({
        ...prontuario,
        anexos: updatedAnexos
      });
    }

    return newAnexo;
  } catch (error) {
    console.error("Firebase Storage error, falling back to mock attachment:", error);
    return mock.mockAddAnexo(pacienteId, {
      nome: nomeArquivo,
      url: '#',
      tipo: tipoArquivo,
      tamanho: tamanhoArquivo
    });
  }
};

// --- DEPOIMENTOS SERVICES ---
export const getDepoimentos = async (): Promise<mock.Depoimento[]> => {
  if (!isFirebaseAvailable) {
    return mock.mockGetDepoimentos();
  }

  try {
    const querySnapshot = await getDocs(collection(db, 'depoimentos'));
    const list: mock.Depoimento[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        nome: data.nome,
        estrelas: data.estrelas,
        comentario: data.comentario,
        data: data.data,
      });
    });
    return list;
  } catch (error) {
    console.error("Firebase error loading testimonials, mock instead:", error);
    return mock.mockGetDepoimentos();
  }
};

export const saveDepoimento = async (depoimento: Omit<mock.Depoimento, 'id' | 'data'>): Promise<mock.Depoimento> => {
  if (!isFirebaseAvailable) {
    return mock.mockSaveDepoimento(depoimento);
  }

  try {
    const nowStr = new Date().toISOString().split('T')[0];
    const docRef = doc(collection(db, 'depoimentos'));
    const newDep = {
      ...depoimento,
      id: docRef.id,
      data: nowStr
    };
    await setDoc(docRef, newDep);
    return newDep;
  } catch (error) {
    console.error("Firebase error saving testimonial, mock instead:", error);
    return mock.mockSaveDepoimento(depoimento);
  }
};
