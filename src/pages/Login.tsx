import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import { Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4 dark:bg-brand-bg-dark transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white p-8 shadow-xl dark:bg-brand-bg-dark/40 dark:border dark:border-white/5"
      >

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 justify-center">
            <img src={logo} alt="Logo Dr. Kauã Felipe" className="h-full object-contain dark:brightness-110" />
          </div>
          <h2 className="text-2xl font-bold text-brand-text dark:text-white">Central Administrativa</h2>
          <p className="mt-1 text-sm text-brand-text-light dark:text-brand-text-light/80">
            Acesse para gerenciar consultas e pacientes
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950/20 dark:text-red-400 dark:border dark:border-red-500/10"
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-text dark:text-white/80">
              Usuário
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-brand-text-light/60 dark:text-brand-text-light/40">
                <User className="h-5 w-5" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                className="w-full rounded-xl border border-brand-border bg-brand-bg py-3.5 pl-11 pr-4 text-sm font-medium text-brand-text focus:border-brand-teal focus:bg-white focus:ring-4 focus:ring-brand-teal/10 dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white dark:focus:border-brand-sage dark:focus:bg-brand-bg-dark dark:focus:ring-brand-sage/10 transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-brand-text dark:text-white/80">
              Senha de Acesso
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-brand-text-light/60 dark:text-brand-text-light/40">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-xl border border-brand-border bg-brand-bg py-3.5 pl-11 pr-4 text-sm font-medium text-brand-text focus:border-brand-teal focus:bg-white focus:ring-4 focus:ring-brand-teal/10 dark:border-white/10 dark:bg-brand-bg-dark/60 dark:text-white dark:focus:border-brand-sage dark:focus:bg-brand-bg-dark dark:focus:ring-brand-sage/10 transition-all outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-teal py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-teal/10 hover:bg-brand-teal-dark active:scale-[0.98] disabled:opacity-50 dark:bg-brand-sage dark:text-brand-teal dark:shadow-brand-sage/5 dark:hover:bg-brand-sage/90 transition-all cursor-pointer"
          >
            {loading ? 'Autenticando...' : 'Entrar no Painel'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-brand-text-light/60 dark:text-brand-text-light/40">
          Dr. Kauã Felipe — Fisioterapeuta | CREFITO 3
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
