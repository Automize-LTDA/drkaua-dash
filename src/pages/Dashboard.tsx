import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/logo.png';
import { 
  getPacientes, 
  savePaciente, 
  deletePaciente, 
  getAgendamentos, 
  saveAgendamento, 
  updateAgendamentoStatus, 
  deleteAgendamento,
  getProntuario,
  saveProntuario,
  addEvolution,
  addAnexo
} from '../services/dataService';
import type { Paciente, Agendamento, Prontuario } from '../services/mockRepository';
import { 
  Users, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  LogOut, 
  Search, 
  Edit, 
  Trash2, 
  UserPlus, 
  Paperclip, 
  Download,
  Menu,
  Sun,
  Moon
} from 'lucide-react';
import { maskCPF, maskPhone } from '../utils/masks';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard: React.FC = () => {
  const { logout, currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'agendamentos' | 'pacientes'>('agendamentos');
  
  // Data States
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  
  // Search and Filters
  const [pacienteSearch, setPacienteSearch] = useState('');
  const [agendamentoFilterDate, setAgendamentoFilterDate] = useState('');
  
  // Selected Patient for Medical Record (Prontuário)
  const [selectedPacienteRecord, setSelectedPacienteRecord] = useState<Paciente | null>(null);
  const [activeProntuario, setActiveProntuario] = useState<Prontuario | null>(null);
  
  // Prontuário form fields
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [avaliacaoFisica, setAvaliacaoFisica] = useState('');
  const [diagnosticoFuncional, setDiagnosticoFuncional] = useState('');
  const [planoTratamento, setPlanoTratamento] = useState('');
  const [novaEvolucao, setNovaEvolucao] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);
  
  // Modals
  const [pacienteModalOpen, setPacienteModalOpen] = useState(false);
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null);
  
  const [agendamentoModalOpen, setAgendamentoModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);

  // Patient registration fields (modal)
  const [pNome, setPNome] = useState('');
  const [pCpf, setPCpf] = useState('');
  const [pTelefone, setPTelefone] = useState('');
  const [pWhatsapp, setPWhatsapp] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pDataNasc, setPDataNasc] = useState('');

  // Appointment edit fields (modal)
  const [aData, setAData] = useState('');
  const [aHorario, setAHorario] = useState('');
  const [aTipo, setATipo] = useState('');
  const [aObs, setAObs] = useState('');

  // Mobile navigation
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Custom dialog state and helper functions
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'success' | 'error';
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);

  const showAlertDialog = (title: string, message: string, type: 'success' | 'error' | 'alert' = 'alert') => {
    setDialogConfig({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => setDialogConfig(null)
    });
  };

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setDialogConfig({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        onConfirm();
        setDialogConfig(null);
      },
      onCancel: () => setDialogConfig(null)
    });
  };

  // Fetch initial dashboard data
  const loadData = async () => {
    try {
      const pacList = await getPacientes();
      const ageList = await getAgendamentos();
      setPacientes(pacList);
      setAgendamentos(ageList);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Calculations for KPI Cards
  const totalPacientes = pacientes.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const consultasHoje = agendamentos.filter(a => a.data === todayStr && a.status !== 'cancelled').length;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const consultasMes = agendamentos.filter(a => {
    const aDate = new Date(a.data + 'T00:00:00');
    return aDate.getMonth() === currentMonth && aDate.getFullYear() === currentYear && a.status === 'completed';
  }).length;

  const agendamentosPendentes = agendamentos.filter(a => a.status === 'pending').length;

  // Filtered lists
  const filteredAgendamentos = agendamentos
    .filter(a => {
      const matchDate = agendamentoFilterDate ? a.data === agendamentoFilterDate : true;
      return matchDate;
    })
    .sort((a, b) => {
      // Sort pending first, then by date/time
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(`${a.data}T${a.horario}`).getTime() - new Date(`${b.data}T${b.horario}`).getTime();
    });

  const filteredPacientes = pacientes.filter(p => {
    const search = pacienteSearch.toLowerCase().trim();
    return p.nome.toLowerCase().includes(search) || p.cpf.includes(search);
  });

  // --- ACTIONS ---
  const handleUpdateStatus = async (id: string, status: Agendamento['status']) => {
    let success = false;
    let updatedAgendamento: Agendamento | null = null;

    if (status === 'confirmed') {
      const age = agendamentos.find(a => a.id === id);
      if (age) {
        const ageCpf = (age as any).pacienteCpf || '';
        const ageNome = age.pacienteNome || '';
        
        const cleanCpf = (val: string) => val.replace(/\D/g, '');
        const ageCpfClean = cleanCpf(ageCpf);

        let existingPatient = pacientes.find(p => {
          const pCpfClean = p.cpf ? cleanCpf(p.cpf) : '';
          const matchCpf = pCpfClean && ageCpfClean && pCpfClean === ageCpfClean;
          const matchNome = p.nome && ageNome && p.nome.toLowerCase().trim() === ageNome.toLowerCase().trim();
          return matchCpf || matchNome;
        });

        let pacienteId = age.pacienteId;

        if (!existingPatient && ageNome) {
          try {
            const newP = await savePaciente({
              nome: ageNome,
              cpf: ageCpf,
              telefone: (age as any).pacienteTelefoneFixo || age.pacienteTelefone || '',
              whatsapp: age.pacienteTelefone || '',
              email: (age as any).pacienteEmail || '',
              dataNascimento: (age as any).pacienteDataNascimento || ''
            });
            setPacientes(prev => [...prev, newP]);
            pacienteId = newP.id;
          } catch (err) {
            console.error("Failed to automatically create patient:", err);
          }
        } else if (existingPatient) {
          pacienteId = existingPatient.id;
          
          const ageTelefone = (age as any).pacienteTelefoneFixo || age.pacienteTelefone || '';
          const ageWhatsapp = age.pacienteTelefone || '';
          const ageEmail = (age as any).pacienteEmail || '';
          const ageDataNasc = (age as any).pacienteDataNascimento || '';

          let needsUpdate = false;
          const updatedPatientData = { ...existingPatient };

          if (!existingPatient.cpf && ageCpf) {
            updatedPatientData.cpf = ageCpf;
            needsUpdate = true;
          }
          if (!existingPatient.telefone && ageTelefone) {
            updatedPatientData.telefone = ageTelefone;
            needsUpdate = true;
          }
          if (!existingPatient.whatsapp && ageWhatsapp) {
            updatedPatientData.whatsapp = ageWhatsapp;
            needsUpdate = true;
          }
          if (!existingPatient.email && ageEmail) {
            updatedPatientData.email = ageEmail;
            needsUpdate = true;
          }
          if (!existingPatient.dataNascimento && ageDataNasc) {
            updatedPatientData.dataNascimento = ageDataNasc;
            needsUpdate = true;
          }

          if (needsUpdate) {
            try {
              const updatedP = await savePaciente(updatedPatientData);
              setPacientes(prev => prev.map(p => p.id === updatedP.id ? updatedP : p));
            } catch (err) {
              console.error("Failed to update existing patient fields:", err);
            }
          }
        }

        const payload = {
          ...age,
          pacienteId,
          status
        };

        try {
          const saved = await saveAgendamento(payload);
          updatedAgendamento = saved;
          success = true;
        } catch (err) {
          console.error("Error saving booking on confirmation:", err);
        }
      }
    }

    if (!success) {
      success = await updateAgendamentoStatus(id, status);
    }

    if (success) {
      setAgendamentos(prev => prev.map(a => {
        if (a.id === id) {
          return updatedAgendamento ? updatedAgendamento : { ...a, status, updatedAt: new Date().toISOString() };
        }
        return a;
      }));

      if (status === 'confirmed') {
        const age = agendamentos.find(a => a.id === id);
        if (age) {
          const phoneClean = age.pacienteTelefone ? age.pacienteTelefone.replace(/\D/g, '') : '';
          if (phoneClean) {
            const formattedPhone = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;
            const formattedDate = age.data ? age.data.split('-').reverse().join('/') : '';
            const messageText = `Olá, *${age.pacienteNome}*! Seu agendamento com o Dr. Kauã Felipe foi confirmado com sucesso. 🎉\n\n📅 *Data:* ${formattedDate}\n⏰ *Horário:* ${age.horario}\n🏥 *Especialidade:* ${age.tipoAtendimento}\n🔢 *Protocolo:* ${age.protocolo}\n\nEstamos ansiosos pelo seu atendimento! Caso precise de alguma alteração ou tenha alguma dúvida, basta responder a esta mensagem. 📲`;
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(messageText)}`;
            window.open(whatsappUrl, '_blank');
          }
        }
      }
    }
  };

  const handleDeleteAgendamento = async (id: string) => {
    showConfirmDialog(
      "Confirmar Exclusão",
      "Deseja realmente excluir este agendamento?",
      async () => {
        const success = await deleteAgendamento(id);
        if (success) {
          setAgendamentos(prev => prev.filter(a => a.id !== id));
        }
      }
    );
  };

  const handleOpenEditAgendamento = (age: Agendamento) => {
    setEditingAgendamento(age);
    setAData(age.data);
    setAHorario(age.horario);
    setATipo(age.tipoAtendimento);
    setAObs(age.observacoes);
    setAgendamentoModalOpen(true);
  };

  const handleSaveAgendamentoEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgendamento) return;

    const updatedPayload = {
      ...editingAgendamento,
      data: aData,
      horario: aHorario,
      tipoAtendimento: aTipo,
      observacoes: aObs
    };

    const saved = await saveAgendamento(updatedPayload);
    setAgendamentos(prev => prev.map(a => a.id === saved.id ? saved : a));
    setAgendamentoModalOpen(false);
    setEditingAgendamento(null);
  };

  // --- PACIENTE ACTIONS ---
  const handleOpenCreatePaciente = () => {
    setEditingPaciente(null);
    setPNome('');
    setPCpf('');
    setPTelefone('');
    setPWhatsapp('');
    setPEmail('');
    setPDataNasc('');
    setPacienteModalOpen(true);
  };

  const handleOpenEditPaciente = (pac: Paciente) => {
    setEditingPaciente(pac);
    setPNome(pac.nome);
    setPCpf(pac.cpf);
    setPTelefone(pac.telefone);
    setPWhatsapp(pac.whatsapp);
    setPEmail(pac.email);
    setPDataNasc(pac.dataNascimento);
    setPacienteModalOpen(true);
  };

  const handleSavePaciente = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      nome: pNome,
      cpf: pCpf,
      telefone: pTelefone,
      whatsapp: pWhatsapp,
      email: pEmail,
      dataNascimento: pDataNasc
    };

    if (editingPaciente) {
      const updated = await savePaciente({ ...payload, id: editingPaciente.id });
      setPacientes(prev => prev.map(p => p.id === updated.id ? updated : p));
    } else {
      const created = await savePaciente(payload);
      setPacientes(prev => [...prev, created]);
    }

    setPacienteModalOpen(false);
    setEditingPaciente(null);
  };

  const handleDeletePaciente = async (id: string) => {
    showConfirmDialog(
      "Excluir Paciente",
      "Atenção! Ao excluir este paciente, todos os agendamentos e prontuários vinculados a ele serão excluídos permanentemente. Deseja continuar?",
      async () => {
        const success = await deletePaciente(id);
        if (success) {
          setPacientes(prev => prev.filter(p => p.id !== id));
          // Reload appointments to clear deleted cascade
          const ageList = await getAgendamentos();
          setAgendamentos(ageList);
          // Clear record if selected
          if (selectedPacienteRecord?.id === id) {
            setSelectedPacienteRecord(null);
            setActiveProntuario(null);
          }
        }
      }
    );
  };

  // --- PRONTUÁRIO ACTIONS ---
  const handleLoadProntuario = async (pac: Paciente) => {
    setSelectedPacienteRecord(pac);
    const pront = await getProntuario(pac.id);
    if (pront) {
      setActiveProntuario(pront);
      setQueixaPrincipal(pront.queixaPrincipal);
      setAvaliacaoFisica(pront.avaliacaoFisica);
      setDiagnosticoFuncional(pront.diagnosticoFuncional);
      setPlanoTratamento(pront.planoTratamento);
    } else {
      setActiveProntuario(null);
      setQueixaPrincipal('');
      setAvaliacaoFisica('');
      setDiagnosticoFuncional('');
      setPlanoTratamento('');
    }
    setNovaEvolucao('');
  };

  const handleSaveProntuarioMain = async () => {
    if (!selectedPacienteRecord) return;

    const payload = {
      pacienteId: selectedPacienteRecord.id,
      queixaPrincipal,
      avaliacaoFisica,
      diagnosticoFuncional,
      planoTratamento,
      evolucoes: activeProntuario?.evolucoes || [],
      anexos: activeProntuario?.anexos || []
    };

    const saved = await saveProntuario({
      ...payload,
      id: activeProntuario?.id
    });
    setActiveProntuario(saved);
    showAlertDialog('Sucesso!', 'Ficha clínica do prontuário salva com sucesso!', 'success');
  };

  const handleAddEvolutionClick = async () => {
    if (!selectedPacienteRecord || !novaEvolucao.trim()) return;

    const added = await addEvolution(selectedPacienteRecord.id, novaEvolucao.trim());
    
    // Update state local view
    if (activeProntuario) {
      setActiveProntuario({
        ...activeProntuario,
        evolucoes: [added, ...activeProntuario.evolucoes]
      });
    } else {
      // Refresh
      const pront = await getProntuario(selectedPacienteRecord.id);
      setActiveProntuario(pront);
    }
    
    setNovaEvolucao('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedPacienteRecord || !file) return;

    setUploadProgress(true);
    
    // Calculate file size in readable format
    const size = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
      : `${(file.size / 1024).toFixed(2)} KB`;

    try {
      // Upload
      const uploaded = await addAnexo(
        selectedPacienteRecord.id, 
        file.name, 
        file.type, 
        size, 
        file
      );

      // Update local view
      if (activeProntuario) {
        setActiveProntuario({
          ...activeProntuario,
          anexos: [...activeProntuario.anexos, uploaded]
        });
      } else {
        const pront = await getProntuario(selectedPacienteRecord.id);
        setActiveProntuario(pront);
      }
      showAlertDialog('Sucesso!', 'Anexo carregado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showAlertDialog('Erro', 'Falha ao carregar anexo.', 'error');
    } finally {
      setUploadProgress(false);
      // Clear file input
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-brand-text dark:bg-brand-bg-dark dark:text-white flex transition-colors duration-300">
      {/* SIDEBAR FOR DESKTOP */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-brand-text text-white p-6 shrink-0 z-40 flex flex-col justify-between dark:bg-brand-bg-dark/80 dark:border-r dark:border-white/5 transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-10 w-auto object-contain brightness-0 invert" />
            <span className="font-heading font-bold text-base tracking-tight">
              Dr. Kauã <span className="text-brand-sage font-medium">Felipe</span>
            </span>
          </div>

          {/* Nav menu */}
          <nav className="flex flex-col gap-2 font-semibold text-sm">
            <button
              onClick={() => { setActiveTab('agendamentos'); setSelectedPacienteRecord(null); setSidebarOpen(false); }}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'agendamentos' && !selectedPacienteRecord
                  ? 'bg-brand-sage text-brand-teal'
                  : 'hover:bg-white/5 text-brand-menta/70 hover:text-white'
              }`}
            >
              <Calendar className="h-5 w-5 shrink-0" /> Agendamentos
            </button>

            <button
              onClick={() => { setActiveTab('pacientes'); setSidebarOpen(false); }}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'pacientes' || selectedPacienteRecord
                  ? 'bg-brand-sage text-brand-teal'
                  : 'hover:bg-white/5 text-brand-menta/70 hover:text-white'
              }`}
            >
              <Users className="h-5 w-5 shrink-0" /> Pacientes & Prontuários
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-4">
          <div className="h-px bg-white/10"></div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all font-semibold text-sm cursor-pointer"
          >
            <LogOut className="h-5 w-5" /> Sair do Painel
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        ></div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar */}
        <header className="h-20 border-b border-brand-border/40 dark:border-white/5 bg-white dark:bg-brand-bg-dark/40 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 cursor-pointer text-brand-text dark:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-extrabold text-brand-text dark:text-white uppercase tracking-wider">
              {selectedPacienteRecord 
                ? 'Prontuário Digital' 
                : activeTab === 'agendamentos' 
                  ? 'Gerenciamento de Agendamentos' 
                  : 'Fichas de Pacientes'
              }
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-brand-teal hover:bg-brand-menta dark:bg-white/5 dark:text-brand-sage dark:hover:bg-white/10 transition-colors cursor-pointer border border-brand-border/30 dark:border-white/5"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* User credentials */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-brand-text dark:text-white">Fisioterapeuta</span>
              <span className="text-xs text-brand-text-light/80 dark:text-brand-text-light/60">{currentUser?.email}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-brand-teal/10 border border-brand-teal/20 text-brand-teal dark:bg-brand-sage/10 dark:border-brand-sage/20 dark:text-brand-sage flex items-center justify-center font-bold">
              K
            </div>
          </div>
        </header>

        {/* CONTAINER VIEWPORTS */}
        <div className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* RENDER DISSOCIATED SCREEN IF WE WANT TO VIEW SPECIFIC PRONTUÁRIO */}
          {selectedPacienteRecord ? (
            <div className="space-y-6">
              {/* Record Header Profile */}
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <button 
                    onClick={() => setSelectedPacienteRecord(null)}
                    className="text-xs font-bold text-brand-teal dark:text-brand-sage hover:underline"
                  >
                    &larr; Voltar para Lista de Pacientes
                  </button>
                  <h2 className="text-2xl font-bold text-brand-text dark:text-white">{selectedPacienteRecord.nome}</h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-brand-text-light dark:text-brand-text-light/80">
                    <p><strong>CPF:</strong> {selectedPacienteRecord.cpf || 'Não cadastrado'}</p>
                    <p><strong>Nascimento:</strong> {selectedPacienteRecord.dataNascimento ? selectedPacienteRecord.dataNascimento.split('-').reverse().join('/') : 'Não cadastrado'}</p>
                    <p><strong>Tel:</strong> {selectedPacienteRecord.whatsapp}</p>
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleSaveProntuarioMain}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-white shadow-md shadow-brand-teal/15 hover:bg-brand-teal-dark dark:bg-brand-sage dark:text-brand-teal dark:shadow-brand-sage/5 dark:hover:bg-brand-sage/90 cursor-pointer"
                  >
                    <FileText className="h-4 w-4" /> Salvar Ficha Clínica
                  </button>
                </div>
              </div>

              {/* Main Record Body */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Clinical Evaluation Forms */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="rounded-3xl bg-white p-6 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 space-y-4">
                    <h3 className="text-lg font-bold border-b border-brand-border/30 dark:border-white/5 pb-2 text-brand-teal dark:text-brand-sage">
                      Avaliação Clínica & Diagnóstico
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-brand-text dark:text-white/80">Queixa Principal (Sintomas)</label>
                        <textarea
                          rows={2}
                          value={queixaPrincipal}
                          onChange={(e) => setQueixaPrincipal(e.target.value)}
                          placeholder="Ex: Dor na região lombar irradiada para coxa..."
                          className="w-full rounded-xl border border-brand-border dark:border-white/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-brand-text dark:text-white/80">Avaliação Física Lombar / Articular</label>
                        <textarea
                          rows={3}
                          value={avaliacaoFisica}
                          onChange={(e) => setAvaliacaoFisica(e.target.value)}
                          placeholder="Ex: Redução de arco de movimento, testes de flexibilidade, nível de dor na escala de 0 a 10..."
                          className="w-full rounded-xl border border-brand-border dark:border-white/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-brand-text dark:text-white/80">Diagnóstico Funcional (Fisioterapêutico)</label>
                        <textarea
                          rows={2}
                          value={diagnosticoFuncional}
                          onChange={(e) => setDiagnosticoFuncional(e.target.value)}
                          placeholder="Ex: Lombalgia mecânica aguda com rigidez articular secundária..."
                          className="w-full rounded-xl border border-brand-border dark:border-white/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-brand-text dark:text-white/80">Plano de Tratamento Proposto</label>
                        <textarea
                          rows={3}
                          value={planoTratamento}
                          onChange={(e) => setPlanoTratamento(e.target.value)}
                          placeholder="Ex: Exercícios de fortalecimento de core, pilates clínico, tração e manipulações articulares 2x por semana..."
                          className="w-full rounded-xl border border-brand-border dark:border-white/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Attachment Management */}
                  <div className="rounded-3xl bg-white p-6 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between border-b border-brand-border/30 dark:border-white/5 pb-2">
                      <h3 className="text-lg font-bold text-brand-teal dark:text-brand-sage">
                        Exames & Anexos (PDFs/Imagens)
                      </h3>
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-teal hover:text-brand-teal-dark dark:text-brand-sage dark:hover:text-brand-sage/90 cursor-pointer">
                        <Paperclip className="h-4 w-4" /> Anexar Arquivo
                        <input 
                          type="file" 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          disabled={uploadProgress} 
                        />
                      </label>
                    </div>

                    {uploadProgress && (
                      <div className="flex items-center justify-center gap-2 text-sm text-brand-teal dark:text-brand-sage py-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-teal border-t-transparent dark:border-brand-sage dark:border-t-transparent"></div>
                        <span>Carregando arquivo para o armazenamento...</span>
                      </div>
                    )}

                    {!activeProntuario?.anexos || activeProntuario.anexos.length === 0 ? (
                      <p className="text-sm text-brand-text-light/70 dark:text-brand-text-light/60 italic py-2">
                        Nenhum exame ou anexo vinculado a este prontuário.
                      </p>
                    ) : (
                      <div className="divide-y divide-brand-border/40 dark:divide-white/5">
                        {activeProntuario.anexos.map((anexo, idx) => (
                          <div key={idx} className="flex items-center justify-between py-3 text-sm">
                            <div className="space-y-0.5">
                              <p className="font-semibold text-brand-text dark:text-white">{anexo.nome}</p>
                              <div className="flex gap-4 text-xs text-brand-text-light/80 dark:text-brand-text-light/60">
                                <span>{anexo.tamanho}</span>
                                <span>Adicionado em {anexo.dataAnexo.split('-').reverse().join('/')}</span>
                              </div>
                            </div>
                            <a
                              href={anexo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex h-9 w-9 items-center justify-center rounded-xl bg-brand-bg text-brand-teal hover:bg-brand-menta dark:bg-brand-bg-dark dark:text-brand-sage dark:hover:bg-white/5 transition-all ${
                                anexo.url === '#' ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                              }`}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Log Timeline */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="rounded-3xl bg-white p-6 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 space-y-4">
                    <h3 className="text-lg font-bold border-b border-brand-border/30 dark:border-white/5 pb-2 text-brand-teal dark:text-brand-sage">
                      Evolução do Paciente
                    </h3>

                    {/* Input to log new evolution */}
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={novaEvolucao}
                        onChange={(e) => setNovaEvolucao(e.target.value)}
                        placeholder="Digite os progressos da sessão de hoje..."
                        className="w-full rounded-xl border border-brand-border dark:border-white/10 bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark transition-all"
                      />
                      <button
                        onClick={handleAddEvolutionClick}
                        className="w-full rounded-xl bg-brand-sage py-3 text-xs font-bold text-brand-teal hover:bg-brand-sage/95 cursor-pointer shadow-md shadow-brand-sage/5 transition-all"
                      >
                        Registrar Evolução
                      </button>
                    </div>

                    {/* Timeline of logs */}
                    <div className="pt-4 space-y-6 relative before:absolute before:top-4 before:bottom-0 before:left-2.5 before:w-0.5 before:bg-brand-border/50 dark:before:bg-white/5 max-h-[400px] overflow-y-auto pr-2">
                      {!activeProntuario?.evolucoes || activeProntuario.evolucoes.length === 0 ? (
                        <p className="text-sm text-brand-text-light/70 dark:text-brand-text-light/60 italic text-center py-4">
                          Nenhum registro de evolução anotado.
                        </p>
                      ) : (
                        activeProntuario.evolucoes.map((evo, idx) => (
                          <div key={idx} className="relative pl-7 text-sm">
                            {/* Dot indicator */}
                            <div className="absolute top-1 left-1.5 h-2.5 w-2.5 rounded-full bg-brand-sage border-2 border-white dark:border-brand-bg-dark shadow"></div>
                            
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-brand-teal dark:text-brand-sage">
                                {evo.data.split('-').reverse().join('/')}
                              </span>
                              <p className="text-brand-text-light dark:text-brand-text-light/95 bg-brand-bg/40 dark:bg-brand-bg-dark/40 p-3.5 rounded-2xl border border-brand-border/20 dark:border-white/5 leading-relaxed">
                                {evo.texto}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // STANDARD TABS (AGENDAMENTOS OR PACIENTES)
            <div className="space-y-6">
              {/* METRICS GENERAL CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="rounded-3xl bg-white p-5 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal dark:bg-brand-sage/10 dark:text-brand-sage">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-text-light dark:text-brand-text-light/80 uppercase">Total Pacientes</span>
                    <p className="text-2xl font-extrabold">{totalPacientes}</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal dark:bg-brand-sage/10 dark:text-brand-sage">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-text-light dark:text-brand-text-light/80 uppercase">Consultas Hoje</span>
                    <p className="text-2xl font-extrabold">{consultasHoje}</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-text-light dark:text-brand-text-light/80 uppercase">Concluídas Mês</span>
                    <p className="text-2xl font-extrabold">{consultasMes}</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-text-light dark:text-brand-text-light/80 uppercase">Solicitações Pendentes</span>
                    <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{agendamentosPendentes}</p>
                  </div>
                </div>
              </div>

              {/* ACTIVE TAB: AGENDAMENTOS VIEW */}
              {activeTab === 'agendamentos' && (
                <div className="rounded-3xl bg-white shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 overflow-hidden">
                  {/* Table header operations */}
                  <div className="p-6 border-b border-brand-border/40 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-brand-bg-dark/20">
                    <h3 className="font-bold text-lg text-brand-text dark:text-white">Agenda e Solicitações</h3>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <input
                          type="date"
                          value={agendamentoFilterDate}
                          onChange={(e) => setAgendamentoFilterDate(e.target.value)}
                          className="rounded-xl border border-brand-border bg-brand-bg px-4 py-2 text-xs font-semibold text-brand-text outline-none focus:border-brand-teal dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white"
                        />
                        {agendamentoFilterDate && (
                          <button 
                            onClick={() => setAgendamentoFilterDate('')}
                            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold"
                          >
                            X
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Table view */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-brand-border/40 bg-brand-bg/40 text-xs font-bold uppercase tracking-wider text-brand-text-light dark:border-white/5 dark:bg-brand-bg-dark/60 dark:text-brand-text-light/80">
                          <th className="px-6 py-4">Paciente</th>
                          <th className="px-6 py-4">Especialidade</th>
                          <th className="px-6 py-4">Data/Horário</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border/30 dark:divide-white/5">
                        {filteredAgendamentos.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-brand-text-light dark:text-brand-text-light/60 italic">
                              Nenhum agendamento encontrado para os filtros selecionados.
                            </td>
                          </tr>
                        ) : (
                          filteredAgendamentos.map((age) => (
                            <tr key={age.id} className="hover:bg-brand-bg/20 dark:hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-brand-text dark:text-white">{age.pacienteNome}</p>
                                  <p className="text-xs text-brand-text-light dark:text-brand-text-light/80">WhatsApp: {age.pacienteTelefone}</p>
                                  {(age as any).pacienteCpf && (
                                    <p className="text-xs text-brand-text-light/70 dark:text-brand-text-light/50 font-mono">CPF: {(age as any).pacienteCpf}</p>
                                  )}
                                  {(age as any).pacienteEmail && (
                                    <p className="text-xs text-brand-text-light/70 dark:text-brand-text-light/50">Email: {(age as any).pacienteEmail}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <span className="font-semibold">{age.tipoAtendimento}</span>
                                  {age.observacoes && (
                                    <p className="text-xs text-brand-text-light/70 dark:text-brand-text-light/50 italic max-w-xs truncate" title={age.observacoes}>
                                      Obs: {age.observacoes}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-semibold">{age.data.split('-').reverse().join('/')}</p>
                                  <p className="text-xs text-brand-text-light dark:text-brand-text-light/80">{age.horario}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                                  age.status === 'confirmed'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                    : age.status === 'pending'
                                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                      : age.status === 'cancelled'
                                        ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                                }`}>
                                  {age.status === 'confirmed' ? 'Confirmado' : age.status === 'pending' ? 'Pendente' : age.status === 'cancelled' ? 'Cancelado' : 'Concluído'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {age.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateStatus(age.id, 'confirmed')}
                                        title="Confirmar Agendamento"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer dark:bg-emerald-950/10 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleUpdateStatus(age.id, 'cancelled')}
                                        title="Recusar/Cancelar"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all cursor-pointer dark:bg-red-950/10 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white"
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                  {age.status === 'confirmed' && (
                                    <button
                                      onClick={() => handleUpdateStatus(age.id, 'completed')}
                                      title="Concluir Consulta"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal text-white hover:bg-brand-teal-dark transition-all cursor-pointer dark:bg-brand-sage dark:text-brand-teal dark:hover:bg-brand-sage/90"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => handleOpenEditAgendamento(age)}
                                    title="Editar Data/Horário"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-brand-text hover:bg-brand-teal hover:text-white dark:bg-white/5 dark:text-white dark:hover:bg-brand-sage dark:hover:text-brand-teal transition-all cursor-pointer"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAgendamento(age.id)}
                                    title="Excluir Permanente"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all cursor-pointer dark:bg-red-950/10 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ACTIVE TAB: PACIENTES VIEW */}
              {activeTab === 'pacientes' && (
                <div className="rounded-3xl bg-white shadow-sm border border-brand-border/40 dark:bg-brand-bg-dark/40 dark:border-white/5 overflow-hidden">
                  {/* Table header controls */}
                  <div className="p-6 border-b border-brand-border/40 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-brand-bg-dark/20">
                    <h3 className="font-bold text-lg text-brand-text dark:text-white">Fichas de Pacientes</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-text-light/50">
                          <Search className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          value={pacienteSearch}
                          onChange={(e) => setPacienteSearch(e.target.value)}
                          placeholder="Buscar por Nome ou CPF"
                          className="rounded-xl border border-brand-border bg-brand-bg pl-9 pr-4 py-2 text-xs font-semibold text-brand-text outline-none focus:border-brand-teal dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white placeholder-brand-text-light/50"
                        />
                      </div>

                      <button
                        onClick={handleOpenCreatePaciente}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white shadow-md shadow-brand-teal/15 hover:bg-brand-teal-dark dark:bg-brand-sage dark:text-brand-teal dark:shadow-brand-sage/5 dark:hover:bg-brand-sage/90 cursor-pointer"
                      >
                        <UserPlus className="h-4 w-4" /> Cadastrar Paciente
                      </button>
                    </div>
                  </div>

                  {/* Table list */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-brand-border/40 bg-brand-bg/40 text-xs font-bold uppercase tracking-wider text-brand-text-light dark:border-white/5 dark:bg-brand-bg-dark/60 dark:text-brand-text-light/80">
                          <th className="px-6 py-4">Nome do Paciente</th>
                          <th className="px-6 py-4">Contato (WhatsApp)</th>
                          <th className="px-6 py-4">CPF</th>
                          <th className="px-6 py-4">Idade / Nasc.</th>
                          <th className="px-6 py-4 text-right">Ficha Médica</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border/30 dark:divide-white/5">
                        {filteredPacientes.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-brand-text-light dark:text-brand-text-light/60 italic">
                              Nenhum paciente cadastrado.
                            </td>
                          </tr>
                        ) : (
                          filteredPacientes.map((pac) => {
                            // Calculate age
                            let ageText = '-';
                            if (pac.dataNascimento) {
                              const dob = new Date(pac.dataNascimento + 'T00:00:00');
                              const diff = Date.now() - dob.getTime();
                              const ageDate = new Date(diff);
                              ageText = `${Math.abs(ageDate.getUTCFullYear() - 1970)} anos`;
                            }
                            
                            return (
                              <tr key={pac.id} className="hover:bg-brand-bg/20 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                  <span className="font-bold text-brand-text dark:text-white">{pac.nome}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="space-y-0.5">
                                    <p className="font-semibold">{pac.whatsapp}</p>
                                    <p className="text-xs text-brand-text-light dark:text-brand-text-light/80">{pac.email || 'Sem e-mail'}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-mono text-xs">{pac.cpf || 'Não informado'}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="space-y-0.5">
                                    <p className="font-semibold">{ageText}</p>
                                    <p className="text-xs text-brand-text-light dark:text-brand-text-light/80">
                                      {pac.dataNascimento ? pac.dataNascimento.split('-').reverse().join('/') : '-'}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleLoadProntuario(pac)}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-sage/20 px-3 py-1.5 text-xs font-bold text-brand-teal dark:bg-brand-sage/10 dark:text-brand-sage hover:bg-brand-sage/35 transition-all cursor-pointer"
                                    >
                                      <FileText className="h-4 w-4" /> Prontuário
                                    </button>
                                    
                                    <button
                                      onClick={() => handleOpenEditPaciente(pac)}
                                      title="Editar Dados"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-brand-text hover:bg-brand-teal hover:text-white dark:bg-white/5 dark:text-white dark:hover:bg-brand-sage dark:hover:text-brand-teal transition-all cursor-pointer"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePaciente(pac.id)}
                                      title="Excluir Paciente"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all cursor-pointer dark:bg-red-950/10 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL: PACIENTE SAVE (NEW OR EDIT) --- */}
      <AnimatePresence>
        {pacienteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPacienteModalOpen(false)}
              className="absolute inset-0 bg-black/50"
            ></motion.div>
            
            {/* Card Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-brand-bg-dark dark:border dark:border-white/5 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold text-brand-text dark:text-white mb-6">
                {editingPaciente ? 'Editar Dados do Paciente' : 'Cadastrar Novo Paciente'}
              </h3>
              
              <form onSubmit={handleSavePaciente} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={pNome}
                    onChange={(e) => setPNome(e.target.value)}
                    placeholder="Nome do paciente"
                    className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">CPF</label>
                    <input
                      type="text"
                      required
                      value={pCpf}
                      onChange={(e) => setPCpf(maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Data de Nascimento</label>
                    <input
                      type="date"
                      required
                      value={pDataNasc}
                      onChange={(e) => setPDataNasc(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Telefone</label>
                    <input
                      type="tel"
                      required
                      value={pTelefone}
                      onChange={(e) => setPTelefone(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">WhatsApp</label>
                    <input
                      type="tel"
                      required
                      value={pWhatsapp}
                      onChange={(e) => setPWhatsapp(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">E-mail</label>
                  <input
                    type="email"
                    value={pEmail}
                    onChange={(e) => setPEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPacienteModalOpen(false)}
                    className="rounded-xl border border-brand-border dark:border-white/10 px-5 py-3 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-brand-teal text-white dark:bg-brand-sage dark:text-brand-teal px-6 py-3 text-xs font-bold hover:opacity-90 cursor-pointer shadow-md"
                  >
                    Salvar Cadastro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: AGENDAMENTO EDIT (DATE/TIME/OBS) --- */}
      <AnimatePresence>
        {agendamentoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAgendamentoModalOpen(false)}
              className="absolute inset-0 bg-black/50"
            ></motion.div>
            
            {/* Card Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-brand-bg-dark dark:border dark:border-white/5"
            >
              <h3 className="text-xl font-bold text-brand-text dark:text-white mb-6">
                Remarcar / Editar Agendamento
              </h3>
              
              <form onSubmit={handleSaveAgendamentoEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Paciente</label>
                  <input
                    type="text"
                    disabled
                    value={editingAgendamento?.pacienteNome || ''}
                    className="w-full rounded-xl border border-brand-border bg-slate-100 px-4 py-3 text-sm text-brand-text-light dark:border-white/10 dark:bg-brand-bg-dark/40 dark:text-brand-text-light outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Especialidade / Tratamento</label>
                  <select
                    required
                    value={aTipo}
                    onChange={(e) => setATipo(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                  >
                    <option value="Fisioterapia Ortopédica">Fisioterapia Ortopédica</option>
                    <option value="Fisioterapia Esportiva">Fisioterapia Esportiva</option>
                    <option value="Reabilitação Pós-Cirúrgica">Reabilitação Pós-Cirúrgica</option>
                    <option value="Tratamento de Coluna">Tratamento de Coluna</option>
                    <option value="RPG (Postural)">RPG (Postural)</option>
                    <option value="Liberação Miofascial">Liberação Miofascial</option>
                    <option value="Atendimento Domiciliar">Atendimento Domiciliar</option>
                    <option value="Prevenção de Lesões">Prevenção de Lesões</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Data da Consulta</label>
                    <input
                      type="date"
                      required
                      value={aData}
                      onChange={(e) => setAData(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Horário</label>
                    <select
                      required
                      value={aHorario}
                      onChange={(e) => setAHorario(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                    >
                      <option value="08:00">08:00</option>
                      <option value="09:00">09:00</option>
                      <option value="10:00">10:00</option>
                      <option value="11:00">11:00</option>
                      <option value="13:30">13:30</option>
                      <option value="14:30">14:30</option>
                      <option value="15:30">15:30</option>
                      <option value="16:30">16:30</option>
                      <option value="17:30">17:30</option>
                      <option value="18:30">18:30</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Observações Clínicas</label>
                  <textarea
                    rows={3}
                    value={aObs}
                    onChange={(e) => setAObs(e.target.value)}
                    placeholder="Sintomas, observações do agendamento..."
                    className="w-full rounded-xl border border-brand-border bg-brand-bg/50 px-4 py-3 text-sm text-brand-text dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white outline-none focus:border-brand-teal focus:bg-white dark:focus:bg-brand-bg-dark"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAgendamentoModalOpen(false)}
                    className="rounded-xl border border-brand-border dark:border-white/10 px-5 py-3 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-brand-teal text-white dark:bg-brand-sage dark:text-brand-teal px-6 py-3 text-xs font-bold hover:opacity-90 cursor-pointer shadow-md"
                  >
                    Salvar Alteração
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Dialog Modal */}
      <AnimatePresence>
        {dialogConfig && dialogConfig.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dialogConfig.onCancel || dialogConfig.onConfirm}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            ></motion.div>

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-brand-bg-dark dark:border dark:border-white/5 text-center"
            >
              {/* Type Indicator Icon */}
              <div className="flex justify-center mb-4">
                {dialogConfig.type === 'success' && (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                )}
                {dialogConfig.type === 'error' && (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                )}
                {dialogConfig.type === 'alert' && (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/20 dark:text-amber-400">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                )}
                {dialogConfig.type === 'confirm' && (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400">
                    <Trash2 className="h-8 w-8" />
                  </div>
                )}
              </div>

              {/* Title & Message */}
              <h3 className="text-lg font-bold text-brand-text dark:text-white mb-2">
                {dialogConfig.title}
              </h3>
              <p className="text-sm text-brand-text-light/80 dark:text-brand-text-light/65 leading-relaxed mb-6">
                {dialogConfig.message}
              </p>

              {/* Action Buttons */}
              <div className="flex justify-center gap-3">
                {dialogConfig.type === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      onClick={dialogConfig.onCancel}
                      className="flex-1 rounded-xl border border-brand-border dark:border-white/10 px-4 py-3 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-brand-text dark:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={dialogConfig.onConfirm}
                      className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white px-4 py-3 text-xs font-bold cursor-pointer shadow-md shadow-red-500/10"
                    >
                      Confirmar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={dialogConfig.onConfirm}
                    className="w-full rounded-xl bg-brand-teal text-white dark:bg-brand-sage dark:text-brand-teal px-6 py-3 text-xs font-bold hover:opacity-90 cursor-pointer shadow-md"
                  >
                    OK
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
