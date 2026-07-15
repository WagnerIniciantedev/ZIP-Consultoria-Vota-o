import React, { useState } from 'react';
import { User } from '../types';
import { Button, Input, Card } from './ui';
import { Eye, EyeOff, UserCog, Shield, Briefcase, Lock, CheckCircle, X } from 'lucide-react';
import { saveUsers } from '../services/dataService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  setCurrentUser,
  users,
  setUsers,
}) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedJobTitle = jobTitle.trim();
    const trimmedPass = password.trim();
    const trimmedConfirmPass = confirmPassword.trim();

    if (!trimmedName) {
      setError('O nome completo é obrigatório.');
      return;
    }

    if (!trimmedUsername) {
      setError('O login do usuário é obrigatório.');
      return;
    }

    // Validation login regex
    const loginRegex = /^[a-z0-9._-]+$/;
    if (!loginRegex.test(trimmedUsername)) {
      setError('O login deve conter apenas letras minúsculas, números, pontos, sublinhados (_) ou hífens (-).');
      return;
    }

    // Check collision with other users
    const exists = users.some(u => u.username === trimmedUsername && u.id !== currentUser.id);
    if (exists) {
      setError('Este login de usuário já está em uso por outro funcionário.');
      return;
    }

    if (trimmedPass) {
      if (trimmedPass.length < 6) {
        setError('A nova senha deve ter pelo menos 6 caracteres por segurança.');
        return;
      }
      if (trimmedPass !== trimmedConfirmPass) {
        setError('A nova senha e a confirmação de senha não coincidem.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const updatedUser: User = {
        ...currentUser,
        name: trimmedName,
        username: trimmedUsername,
        jobTitle: trimmedJobTitle,
        password: trimmedPass ? trimmedPass : currentUser.password,
      };

      // Update users list
      const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
      setUsers(updatedUsers);
      await saveUsers(updatedUsers);

      // Update current user
      setCurrentUser(updatedUser);

      // Persist in session or local storage
      const storageKey = 'condovote_user';
      if (localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify(updatedUser));
      }
      if (sessionStorage.getItem(storageKey)) {
        sessionStorage.setItem(storageKey, JSON.stringify(updatedUser));
      }

      setSuccess('Perfil atualizado com sucesso!');
      setPassword('');
      setConfirmPassword('');

      // Auto close after 1.5s
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);

    } catch (err: any) {
      setError('Erro ao salvar as alterações no perfil: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <UserCog size={22} className="text-white animate-pulse" />
            <div>
              <h3 className="text-lg font-bold">Editar Meu Perfil</h3>
              <p className="text-xs text-red-100">Atualize suas credenciais e dados pessoais</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2 animate-shake">
              <span className="font-bold">⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600 animate-bounce" />
              <div className="font-semibold">{success}</div>
            </div>
          )}

          {/* Section: Basic Data */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100">Dados do Funcionário</h4>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Nome Completo</label>
              <div className="relative">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="pl-3"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Cargo / Função</label>
              <div className="relative flex items-center">
                <Briefcase size={16} className="absolute left-3 text-gray-400" />
                <Input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex: Gerente, Supervisor, etc."
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Login (Usuário)</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-semibold text-gray-400">@</span>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="usuario"
                    required
                    className="pl-7 text-sm font-semibold text-gray-700"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Apenas minúsculas, números e pontos.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nível de Permissão</label>
                <div className="relative flex items-center">
                  <Shield size={16} className="absolute left-3 text-gray-400" />
                  <Input
                    type="text"
                    value={currentUser.role === 'TI' ? 'Administrador T.I.' : 'Administrador'}
                    disabled
                    className="pl-10 bg-gray-50 text-gray-500 cursor-not-allowed font-medium text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Password Update */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center pb-1 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alterar Senha</h4>
              <span className="text-[10px] text-gray-400 font-medium">Deixe em branco para manter a atual</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nova Senha</label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3 text-gray-400" />
                  <Input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Confirmar Nova Senha</label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3 text-gray-400" />
                  <Input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="pl-10 pr-10"
                    required={!!password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 text-gray-600 border-gray-200 hover:bg-gray-50 font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold flex justify-center items-center gap-2"
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
