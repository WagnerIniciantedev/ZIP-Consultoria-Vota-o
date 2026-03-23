import React, { useState } from 'react';
import { User } from '../types';
import { Button, Input, Card, Badge } from './ui';
import { saveUsers } from '../services/dataService'; // IMPORT SAVE FUNCTION
import { 
  Trash2, 
  Pencil, 
  Save, 
  X, 
  Plus, 
  Shield, 
  Briefcase,
  UserCog,
  CheckCircle2,
  Lock,
  Check
} from 'lucide-react';

interface UsersProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User | null;
  onDeleteUser: (id: string) => void;
}

// Helper to generate ID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const UsersManagement: React.FC<UsersProps> = ({ 
  users, 
  setUsers, 
  currentUser, 
  onDeleteUser 
}) => {
  // Creation State
  const [newUserName, setNewUserName] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserJobTitle, setNewUserJobTitle] = useState('');

  // Editing State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'ADMIN' as 'ADMIN' | 'TI',
    jobTitle: ''
  });

  // Deletion Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isPrivileged = currentUser?.role === 'TI' || currentUser?.role === 'ADMIN';
  const isTI = currentUser?.role === 'TI';

  // --- Handlers ---

  const handleCreateUser = async () => {
    if (!newUserName || !newUserLogin || !newUserPass) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    if (users.some(u => u.username === newUserLogin)) {
      alert("Este login já está em uso.");
      return;
    }

    setIsSaving(true);
    try {
      const newUser: User = {
        id: generateId(),
        name: newUserName,
        username: newUserLogin,
        password: newUserPass,
        role: 'ADMIN', // Default is ADMIN
        jobTitle: newUserJobTitle
      };

      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      await saveUsers(updatedUsers); // EXPLICIT SAVE
      
      alert("Usuário criado com sucesso e salvo no banco de dados!");
      
      // Reset form
      setNewUserName('');
      setNewUserLogin('');
      setNewUserPass('');
      setNewUserJobTitle('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (user: User, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Cancel any pending delete
    setDeleteConfirmId(null);
    
    setEditingUser(user);
    setEditForm({
      name: user.name,
      username: user.username,
      password: '', // Blank password implies no change
      role: user.role || 'ADMIN',
      jobTitle: user.jobTitle || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({ name: '', username: '', password: '', role: 'ADMIN', jobTitle: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (!editForm.name) {
      alert("Nome é obrigatório");
      return;
    }

    // Check duplicate login (excluding self)
    if (editForm.username !== editingUser.username) {
      if (users.some(u => u.username === editForm.username && u.id !== editingUser.id)) {
        alert("Este login já está em uso.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const updatedUsers = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            name: editForm.name,
            username: isPrivileged ? editForm.username : u.username, // Only privileged changes username
            jobTitle: isPrivileged ? editForm.jobTitle : u.jobTitle,
            password: editForm.password ? editForm.password : u.password 
          };
        }
        return u;
      });

      setUsers(updatedUsers);
      await saveUsers(updatedUsers); // EXPLICIT SAVE

      alert("Alterações salvas com sucesso no banco de dados!");
      handleCancelEdit();
    } catch (error) {
      alert("Erro ao salvar no banco de dados. Verifique sua conexão ou permissões.");
    } finally {
      setIsSaving(false);
    }
  };

  // INLINE DELETE HANDLER (No Alerts)
  const handleDeleteRequest = (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirmId(userId);
  };

  const handleConfirmDelete = (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Excluindo usuário:", userId);
    onDeleteUser(userId);
    
    setDeleteConfirmId(null);
    if (editingUser?.id === userId) {
      handleCancelEdit();
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <UserCog className="text-red-600" /> Gestão de Usuários
        </h2>
        <Badge color="gray">{users.length} usuários cadastrados</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        
        {/* LEFT COLUMN: Form (Create or Edit) */}
        <div className="lg:col-span-4 h-full">
          <Card 
            title={editingUser ? `Editando: ${editingUser.name}` : "Adicionar Novo Funcionário"} 
            className={`h-full border-t-4 ${editingUser ? 'border-t-blue-500' : 'border-t-red-500'}`}
          >
            <div className="space-y-5 py-2">
              {editingUser ? (
                // EDIT MODE FORM
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome Completo</label>
                    <Input 
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usuário (Login)</label>
                    <Input 
                      value={editForm.username}
                      disabled={!isPrivileged} 
                      onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                      className={!isPrivileged ? "bg-gray-200 text-gray-500 cursor-not-allowed opacity-70" : "bg-white text-gray-900"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Alterar Senha
                    </label>
                    <Input 
                      type="password" 
                      placeholder="Deixe em branco para manter" 
                      value={editForm.password}
                      onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                      className="bg-white text-gray-900"
                    />
                  </div>
                  
                  {isPrivileged && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cargo (Visível)</label>
                        <Input 
                          placeholder="Ex: Gerente"
                          value={editForm.jobTitle}
                          onChange={(e) => setEditForm({...editForm, jobTitle: e.target.value})}
                          className="bg-white text-gray-900"
                        />
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                      <Button onClick={handleCancelEdit} variant="outline" className="flex-1 text-sm" disabled={isSaving}>
                        <X size={16} className="mr-1" /> Cancelar
                      </Button>
                      <Button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm" disabled={isSaving}>
                        {isSaving ? <span className="animate-pulse">Salvando...</span> : <><Save size={16} className="mr-1" /> Salvar</>}
                      </Button>
                  </div>
                </div>
              ) : (
                // CREATE MODE FORM
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome Completo</label>
                    <Input 
                      placeholder="Ex: João Souza" 
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="bg-gray-50 focus:bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usuário (Login)</label>
                    <Input 
                      placeholder="Ex: joao.souza" 
                      value={newUserLogin}
                      onChange={(e) => setNewUserLogin(e.target.value)}
                      className="bg-gray-50 focus:bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha</label>
                    <Input 
                      type="password" 
                      placeholder="••••••" 
                      value={newUserPass}
                      onChange={(e) => setNewUserPass(e.target.value)}
                      className="bg-gray-50 focus:bg-white text-gray-900"
                    />
                  </div>
                  
                  {isPrivileged && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cargo (Opcional)</label>
                        <Input 
                          placeholder="Ex: Gerente"
                          value={newUserJobTitle}
                          onChange={(e) => setNewUserJobTitle(e.target.value)}
                          className="bg-gray-50 focus:bg-white text-gray-900"
                        />
                    </div>
                  )}

                  <div className="pt-4">
                    <Button onClick={handleCreateUser} disabled={isSaving} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                      {isSaving ? <span className="animate-pulse">Cadastrando...</span> : <><Plus size={18} className="mr-2" /> Cadastrar Usuário</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: List */}
        <div className="lg:col-span-8 h-full">
          <Card title="Usuários do Sistema" className="h-full border-t-4 border-t-gray-400 flex flex-col">
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 flex-1 custom-scrollbar pb-2">
                {users.map((user) => {
                  const isMe = currentUser?.id === user.id;
                  const isTargetTI = user.role === 'TI';
                  const isEditing = editingUser?.id === user.id;
                  const isConfirmingDelete = deleteConfirmId === user.id;
                  
                  // LÓGICA DE PERMISSÃO OTIMIZADA
                  let canDelete = false;
                  let message = "";

                  if (isMe) {
                    canDelete = false;
                    message = "Você não pode se auto-excluir.";
                  } else if (isTargetTI && !isTI) {
                    canDelete = false;
                    message = "Apenas T.I. pode excluir outro T.I.";
                  } else if (isPrivileged) {
                    canDelete = true; 
                    message = "Excluir Usuário";
                  } else {
                    canDelete = false;
                    message = "Sem permissão para excluir.";
                  }

                  return (
                    <div 
                      key={user.id} 
                      className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-200 relative ${
                        isEditing 
                          ? 'bg-blue-50 border-blue-300 shadow-md ring-1 ring-blue-200 z-20' 
                          : 'bg-white hover:border-red-200 hover:shadow-sm z-0'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Avatar / Icon */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                           isTargetTI 
                             ? 'bg-purple-100 text-purple-700 border-purple-200' 
                             : 'bg-red-50 text-red-600 border-red-100'
                        }`}>
                          {isTargetTI ? <Shield size={22} /> : <Briefcase size={22} />}
                        </div>

                        {/* User Info */}
                        <div className="truncate">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm truncate">{user.name}</p>
                            {isTargetTI ? (
                               <Badge color="purple">T.I.</Badge>
                            ) : (
                               user.jobTitle && <Badge color="gray">{user.jobTitle}</Badge>
                            )}
                            {isMe && (
                               <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200 flex items-center gap-1">
                                 <CheckCircle2 size={10} /> VOCÊ
                               </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-1 truncate">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                      
                      {/* Action Buttons Container */}
                      <div className="flex items-center gap-2 relative z-50 shrink-0 ml-2">
                          
                          {/* EDIT Button */}
                          {(isPrivileged || isMe) && !isConfirmingDelete && (
                            <button
                              type="button"
                              onClick={(e) => handleStartEdit(user, e)}
                              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                                isEditing 
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                              title="Editar Usuário"
                            >
                              <Pencil size={18} />
                            </button>
                          )}

                          {/* DELETE LOGIC - INLINE CONFIRMATION */}
                          {isConfirmingDelete ? (
                             <div className="flex items-center bg-red-50 rounded-lg p-1 border border-red-200 animate-in fade-in zoom-in duration-200 shadow-lg absolute right-0 min-w-[120px] justify-center z-[100]">
                                <span className="text-[10px] text-red-700 font-bold mr-2 ml-1">Confirmar?</span>
                                <button
                                    onClick={(e) => handleConfirmDelete(user.id, e)}
                                    className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 mr-1 shadow-sm"
                                    title="Sim, excluir"
                                >
                                    <Check size={16} />
                                </button>
                                <button
                                    onClick={handleCancelDelete}
                                    className="p-1.5 bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-100 shadow-sm"
                                    title="Cancelar"
                                >
                                    <X size={16} />
                                </button>
                             </div>
                          ) : (
                              canDelete ? (
                                <button 
                                  type="button"
                                  onClick={(e) => handleDeleteRequest(user.id, e)}
                                  className="p-2 rounded-lg border bg-white border-red-100 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 hover:shadow-md transition-all cursor-pointer"
                                  title={message}
                                >
                                  <Trash2 size={18} />
                                </button>
                              ) : (
                                <div 
                                    className="p-2 text-gray-300 cursor-not-allowed flex items-center justify-center border border-transparent" 
                                    title={message}
                                >
                                    {isMe ? <Shield size={18} /> : <Lock size={18} />}
                                </div>
                              )
                          )}
                          
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};