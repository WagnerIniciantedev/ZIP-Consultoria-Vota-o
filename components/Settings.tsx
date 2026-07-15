import React, { useState, useEffect } from 'react';
import { Button, Input, Card, Badge } from './ui';
import { 
  Building2, 
  Image as ImageIcon, 
  Users as UsersIcon, 
  Phone, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  Upload, 
  User, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { CompanySettings, saveCompanySettings, getCompanySettings } from '../services/dataService';
import { UsersManagement } from './Users';
import { User as UserType } from '../types';

interface SettingsProps {
  users: UserType[];
  setUsers: React.Dispatch<React.SetStateAction<UserType[]>>;
  currentUser: UserType | null;
  onDeleteUser: (id: string) => Promise<void>;
}

export const SettingsModule: React.FC<SettingsProps> = ({
  users,
  setUsers,
  currentUser,
  onDeleteUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'company' | 'logo' | 'employees'>('company');
  const [settings, setSettings] = useState<CompanySettings>(() => getCompanySettings());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Apply auto-masks for CNPJ and Phone
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.substring(0, 14);
    
    // Apply CNPJ mask: 00.000.000/0000-00
    if (value.length > 12) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    } else if (value.length > 8) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,3})/, "$1.$2");
    }
    
    setSettings(prev => ({ ...prev, cnpj: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    
    // Apply phone mask: (00) 00000-0000 or (00) 0000-0000
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (value.length > 6) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    }
    
    setSettings(prev => ({ ...prev, phone: value }));
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCompanySettings(settings);
      showSuccess('Informações da empresa salvas com sucesso!');
    } catch (err: any) {
      setErrorMsg('Erro ao salvar as configurações.');
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Drag and Drop File Upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Apenas arquivos de imagem são suportados.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB Limit
      setErrorMsg('A imagem deve ter no máximo 2MB.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        const updatedSettings = { ...settings, logo: base64 };
        setSettings(updatedSettings);
        saveCompanySettings(updatedSettings);
        showSuccess('Logotipo atualizado com sucesso!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    const updatedSettings = { ...settings, logo: '', loginLogoSize: 280, systemLogoSize: 160 };
    setSettings(updatedSettings);
    saveCompanySettings(updatedSettings);
    showSuccess('Logotipo redefinido para o padrão do sistema!');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-500 text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 size={20} className="text-white" />
          <p className="font-semibold text-sm">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <AlertCircle size={20} className="text-white" />
          <p className="font-semibold text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Settings Sub-Navigation */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden p-1 gap-1">
        <button
          onClick={() => setActiveSubTab('company')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
            activeSubTab === 'company'
              ? 'bg-red-50 text-[#E60000]'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Building2 size={18} />
          <span>Informações da Empresa</span>
        </button>
        <button
          onClick={() => setActiveSubTab('logo')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
            activeSubTab === 'logo'
              ? 'bg-red-50 text-[#E60000]'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <ImageIcon size={18} />
          <span>Logotipo do Sistema</span>
        </button>
        <button
          onClick={() => setActiveSubTab('employees')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
            activeSubTab === 'employees'
              ? 'bg-red-50 text-[#E60000]'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <UsersIcon size={18} />
          <span>Funcionários</span>
        </button>
      </div>

      {/* TAB CONTENT: COMPANY INFO */}
      {activeSubTab === 'company' && (
        <Card title="🏢 Informações Gerais da Empresa">
          <form onSubmit={handleSaveInfo} className="space-y-6">
            <p className="text-sm text-gray-500 leading-relaxed">
              Defina as informações institucionais da sua consultoria de assembleias. Estes dados serão aplicados e consolidados em relatórios, e-mails de convocação e cabeçalhos do sistema.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nome da Empresa */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <Building2 size={16} className="text-gray-400" />
                  Nome / Razão Social
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Ex: ZIP Consultoria Ltda"
                  value={settings.name}
                  onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-red-500 text-gray-900"
                />
              </div>

              {/* CNPJ */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <FileText size={16} className="text-gray-400" />
                  CNPJ
                </label>
                <Input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={settings.cnpj}
                  onChange={handleCnpjChange}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-red-500 text-gray-900"
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <Phone size={16} className="text-gray-400" />
                  Telefone de Contato
                </label>
                <Input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={settings.phone}
                  onChange={handlePhoneChange}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-red-500 text-gray-900"
                />
              </div>

              {/* Endereço */}
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <MapPin size={16} className="text-gray-400" />
                  Endereço Completo
                </label>
                <Input
                  type="text"
                  placeholder="Rua, Número, Bairro, Cidade - Estado, CEP"
                  value={settings.address}
                  onChange={e => setSettings(prev => ({ ...prev, address: e.target.value }))}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-red-500 text-gray-900"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <Button type="submit" className="px-6 py-2.5">
                Salvar Informações
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB CONTENT: LOGO */}
      {activeSubTab === 'logo' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form and Upload Side */}
          <div className="lg:col-span-2 space-y-6">
            <Card title="🎨 Customização do Logotipo">
              <div className="space-y-6">
                <p className="text-sm text-gray-500 leading-relaxed">
                  Envie a marca da sua empresa ou insira um link direto para espelhar em tempo real na tela de Login de Administradores, no painel corporativo e em todas as assinaturas internas.
                </p>

                {/* URL Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">
                    URL Direta da Imagem
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="https://exemplo.com/sua-logo.png"
                      value={settings.logo.startsWith('data:') ? '' : settings.logo}
                      onChange={e => {
                        const updated = { ...settings, logo: e.target.value };
                        setSettings(updated);
                        saveCompanySettings(updated);
                      }}
                      className="bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-red-500 text-gray-900 flex-1"
                    />
                    {settings.logo && (
                      <Button variant="outline" onClick={handleResetLogo} className="flex items-center gap-1.5 text-gray-500 border-gray-200 hover:bg-gray-50">
                        <RefreshCw size={15} /> Redefinir
                      </Button>
                    )}
                  </div>
                </div>

                <div className="relative flex items-center justify-center my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                  <span className="relative px-3 bg-white text-xs font-bold text-gray-400">OU FAÇA UPLOAD DO ARQUIVO</span>
                </div>

                {/* Drag and Drop Box */}
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    dragActive 
                      ? 'border-red-500 bg-red-50/20' 
                      : 'border-gray-200 hover:border-red-400 bg-gray-50/20'
                  }`}
                >
                  <input
                    type="file"
                    id="logo-upload-input"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="logo-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="p-3 bg-red-50 text-red-600 rounded-full">
                      <Upload size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        Clique para enviar ou arraste o logotipo aqui
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        PNG, JPG, WEBP ou SVG (Máx. 2MB)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Logo Dimensions Sizing Controls */}
                <div className="border-t border-gray-100 pt-6 space-y-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Ajuste de Dimensões</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Login Logo Size Range */}
                    <div className="space-y-2 p-4 bg-gray-50/50 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-gray-700">Tamanho na Tela de Login</label>
                        <span className="text-xs font-mono font-bold text-red-600 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-sm">
                          {settings.loginLogoSize || 280}px
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="120" 
                        max="400" 
                        step="10"
                        value={settings.loginLogoSize || 280} 
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const updated = { ...settings, loginLogoSize: val };
                          setSettings(updated);
                          saveCompanySettings(updated);
                        }}
                        className="w-full accent-[#E60000] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[11px] text-gray-400">Controla o tamanho da marca nas telas de login de administrador e moradores.</p>
                    </div>

                    {/* System Logo Size Range */}
                    <div className="space-y-2 p-4 bg-gray-50/50 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-gray-700">Tamanho no Painel Interno</label>
                        <span className="text-xs font-mono font-bold text-red-600 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-sm">
                          {settings.systemLogoSize || 160}px
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="80" 
                        max="240" 
                        step="5"
                        value={settings.systemLogoSize || 160} 
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const updated = { ...settings, systemLogoSize: val };
                          setSettings(updated);
                          saveCompanySettings(updated);
                        }}
                        className="w-full accent-[#E60000] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[11px] text-gray-400">Controla o tamanho da marca nos menus laterais e cabeçalhos do sistema.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Live Preview Side */}
          <div className="space-y-6">
            <Card title="👁️ Previsão em Tempo Real">
              <div className="space-y-6">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Veja como a sua identidade visual se adapta às principais telas e contrastes de fundo da plataforma:
                </p>

                {/* White Background (System Content & Tables) */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fundo Claro (Cabeçalhos / Relatórios)</span>
                  <div className="border border-gray-100 rounded-xl p-6 bg-white flex items-center justify-center min-h-[140px] shadow-inner relative overflow-hidden">
                    <div style={{ width: `${settings.systemLogoSize || 160}px` }} className="max-w-full flex justify-center transition-all duration-200">
                      {settings.logo ? (
                        <img 
                          src={settings.logo} 
                          alt="Custom Logo Preview Light" 
                          className="max-w-full max-h-[120px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">ZIP CONSULTORIA</p>
                          <p className="text-[9px] text-gray-400 mt-1 italic">Logotipo Padrão Ativo</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Red Background (Login Screen & Sidebars) */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fundo Escuro (Tela de Login / Sidebar)</span>
                  <div className="border border-red-700/20 rounded-xl p-6 bg-[#FE0000] flex items-center justify-center min-h-[140px] shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full blur-lg"></div>
                    <div style={{ width: `${settings.loginLogoSize || 280}px` }} className="max-w-full flex justify-center transition-all duration-200 z-10">
                      {settings.logo ? (
                        <img 
                          src={settings.logo} 
                          alt="Custom Logo Preview Dark" 
                          className="max-w-full max-h-[120px] object-contain drop-shadow-md"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-xs font-bold text-red-100 uppercase tracking-widest">ZIP CONSULTORIA</p>
                          <p className="text-[9px] text-red-200/70 mt-1 italic">Logotipo Padrão Ativo</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {settings.logo && (
                  <Button variant="outline" onClick={handleResetLogo} className="w-full text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 flex items-center justify-center gap-1.5 py-2.5">
                    <RefreshCw size={16} /> Restaurar Logo Padrão
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EMPLOYEES */}
      {activeSubTab === 'employees' && (
        <div className="animate-in fade-in duration-300">
          <UsersManagement
            users={users}
            setUsers={setUsers}
            currentUser={currentUser}
            onDeleteUser={onDeleteUser}
          />
        </div>
      )}
    </div>
  );
};
