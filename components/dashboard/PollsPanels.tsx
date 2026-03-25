
import React, { useState } from 'react';
import { Poll, PollCalculationType, User } from '../../types';
import { Button, Input, Card, Badge } from '../ui';
import { Trash2, Plus, PlayCircle, PauseCircle, StopCircle, BarChart3, Link as LinkIcon, Copy, Edit2 } from 'lucide-react';
import { savePolls, addLog, cleanText } from '../../services/dataService'; // Import updated

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// --- COMPONENT: CREATE POLL ---

interface PollCreatorProps {
  setPolls: React.Dispatch<React.SetStateAction<Poll[]>>;
  onSuccess: () => void;
  currentUser: User | null;
  pollToEdit?: Poll | null;
  onCancelEdit?: () => void;
}

export const PollCreator: React.FC<PollCreatorProps> = ({ setPolls, onSuccess, currentUser, pollToEdit, onCancelEdit }) => {
  const [pollTitle, setPollTitle] = useState(pollToEdit?.title || '');
  const [pollDesc, setPollDesc] = useState(pollToEdit?.description || '');
  const [pollOptions, setPollOptions] = useState<string[]>(pollToEdit?.options.map(o => o.text) || ['', '']);
  const [pollType, setPollType] = useState<PollCalculationType>(pollToEdit?.calculationType || PollCalculationType.NORMAL);

  const handleAddOption = () => setPollOptions([...pollOptions, '']);
  
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const createPoll = () => {
    if (!pollTitle || pollOptions.some(o => !o.trim())) {
      alert("Preencha o título e todas as opções.");
      return;
    }

    if (pollToEdit) {
      setPolls(prev => {
        const updated = prev.map(p => p.id === pollToEdit.id ? {
          ...p,
          title: pollTitle,
          description: pollDesc,
          options: pollOptions.map((text, idx) => ({ id: p.options[idx]?.id || `opt-${idx}-${Date.now()}`, text })),
          calculationType: pollType
        } : p);
        savePolls(updated);
        if (currentUser) {
          addLog(currentUser, 'EDITAR_ENQUETE', `Editou a enquete: ${pollTitle}`);
        }
        return updated;
      });
      alert("Enquete atualizada com sucesso!");
      onSuccess();
      return;
    }

    const newPoll: Poll = {
      id: generateId(),
      title: pollTitle,
      description: pollDesc,
      options: pollOptions.map((text, idx) => ({ id: `opt-${idx}-${Date.now()}`, text })),
      isActive: false, 
      isEnded: false,
      createdAt: Date.now(),
      calculationType: pollType
    };
    
    // UPDATE AND SAVE EXPLICITLY
    setPolls(prev => {
        const updated = [...prev, newPoll];
        savePolls(updated); // Explicit Save
        if (currentUser) {
          addLog(currentUser, 'CRIAR_ENQUETE', `Criou a enquete: ${newPoll.title}`);
        }
        return updated;
    });
    
    // Reset
    setPollTitle('');
    setPollDesc('');
    setPollOptions(['', '']);
    setPollType(PollCalculationType.NORMAL);
    
    alert("Enquete criada com sucesso!");
    onSuccess();
  };

  return (
    <Card title={pollToEdit ? "Editar Enquete" : "Criar Nova Enquete"} className="min-h-[500px]">
      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título da Assembleia/Votação</label>
          <Input 
            placeholder="Ex: Aprovação da Reforma da Fachada" 
            value={pollTitle}
            onChange={(e) => setPollTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
          <textarea 
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 outline-none"
            rows={3}
            placeholder="Detalhes sobre a pauta..."
            value={pollDesc}
            onChange={(e) => setPollDesc(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Apuração</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setPollType(PollCalculationType.NORMAL)}
              className={`p-3 rounded-lg border text-sm text-left transition-all ${pollType === PollCalculationType.NORMAL ? 'border-red-500 bg-red-50 text-red-800 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <div>Condomínio Normal</div>
              <div className="text-xs text-gray-500 mt-1 font-normal">1 Unidade = 1 Voto</div>
            </button>
            <button
              type="button"
              onClick={() => setPollType(PollCalculationType.HABITE_SE)}
              className={`p-3 rounded-lg border text-sm text-left transition-all ${pollType === PollCalculationType.HABITE_SE ? 'border-red-500 bg-red-50 text-red-800 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <div>Condomínio Habite-se</div>
              <div className="text-xs text-gray-500 mt-1 font-normal">+1 Voto se tiver Habite-se</div>
            </button>
            <button
              type="button"
              onClick={() => setPollType(PollCalculationType.FRACTION)}
              className={`p-3 rounded-lg border text-sm text-left transition-all ${pollType === PollCalculationType.FRACTION ? 'border-red-500 bg-red-50 text-red-800 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <div>Fração Ideal</div>
              <div className="text-xs text-gray-500 mt-1 font-normal">Soma das frações</div>
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Opções de Voto</label>
          <div className="space-y-3">
            {pollOptions.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input 
                  placeholder={`Opção ${idx + 1}`} 
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                />
                {pollOptions.length > 2 && (
                  <button 
                    type="button"
                    onClick={() => handleRemoveOption(idx)} 
                    className="text-red-500 hover:bg-red-50 p-2 rounded"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button 
            type="button"
            onClick={handleAddOption} 
            className="mt-3 text-sm text-red-600 font-medium flex items-center gap-1 hover:text-red-700"
          >
            <Plus size={16} /> Adicionar Opção
          </button>
        </div>

        <div className="pt-4 border-t flex gap-3">
          <Button onClick={createPoll} className="w-full sm:w-auto">
            {pollToEdit ? "Salvar Alterações" : "Criar Enquete"}
          </Button>
          {pollToEdit && onCancelEdit && (
            <Button onClick={onCancelEdit} variant="outline" className="w-full sm:w-auto">
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};


// --- COMPONENT: MANAGE POLLS LIST ---

interface PollListProps {
  polls: Poll[];
  onTogglePoll: (id: string) => void;
  onEndPoll: (id: string) => void;
  onDeletePoll: (id: string) => void;
  onSelectPoll: (id: string) => void;
  onEditPoll: (poll: Poll) => void;
  currentUser: User | null;
  condoName: string;
  selectedAssemblyId?: string;
}

export const PollList: React.FC<PollListProps> = ({ 
  polls, 
  onTogglePoll, 
  onEndPoll, 
  onDeletePoll, 
  onSelectPoll,
  onEditPoll,
  currentUser,
  condoName,
  selectedAssemblyId
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEndId, setConfirmEndId] = useState<string | null>(null);

  const handleCopyLink = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const safeKey = selectedAssemblyId || condoName.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const token = btoa(JSON.stringify({ a: 'r', id: safeKey }));
    const link = `${window.location.origin}?t=${token}`;
    navigator.clipboard.writeText(link).then(() => {
        alert("Link copiado! Envie este link para os moradores.\n\n" + link);
        if (currentUser) {
          addLog(currentUser, 'COPIAR_LINK', 'Copiou o link de acesso geral para moradores');
        }
    });
  };

  const handleClickToggle = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTogglePoll(id);
    if (currentUser) {
      const poll = polls.find(p => p.id === id);
      if (poll) {
        addLog(currentUser, poll.isActive ? 'PAUSAR_ENQUETE' : 'ATIVAR_ENQUETE', `Alterou status da enquete: ${poll.title}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <h2 className="text-xl font-bold text-gray-800">Enquetes e Votações</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex items-start gap-3">
               <div className="bg-blue-100 p-2 rounded-full mt-1">
                   <LinkIcon size={20} className="text-blue-600" />
               </div>
               <div>
                   <h4 className="font-bold text-blue-900">Link de Acesso para Moradores</h4>
                   <p className="text-sm text-blue-700">Envie este link para que os condôminos acessem diretamente a votação.</p>
               </div>
           </div>
           <Button onClick={handleCopyLink} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
               <Copy size={16} className="mr-2" /> Copiar Link
           </Button>
      </div>
      
      {polls.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            Nenhuma votação criada ainda. Vá para a aba "Criar Enquete".
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {polls.map((poll) => {
             const isConfirmingDelete = confirmDeleteId === poll.id;
             const isConfirmingEnd = confirmEndId === poll.id;

             return (
              <div 
                key={poll.id} 
                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${poll.isEnded ? 'opacity-75 bg-gray-50' : 'hover:border-red-200'}`}
              >
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => onSelectPoll(poll.id)}
                >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-gray-900">{cleanText(poll.title)}</h3>
                      {poll.isActive ? (
                        <Badge color="green">Ativa</Badge>
                      ) : poll.isEnded ? (
                        <Badge color="red">Encerrada</Badge>
                      ) : (
                        <Badge color="yellow">Pausada / Rascunho</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate max-w-md">{cleanText(poll.description) || "Sem descrição"}</p>
                </div>

                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end items-center gap-2 flex-wrap">
                        {!poll.isEnded && !isConfirmingDelete && !isConfirmingEnd && !poll.hasStarted && (
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onEditPoll(poll);
                            }}
                            variant="outline"
                            className="text-sm py-1 px-3 h-8 flex gap-1 items-center border-blue-200 text-blue-600 hover:bg-blue-50"
                          >
                            <Edit2 size={14} /> Editar
                          </Button>
                        )}

                        {!poll.isEnded && !isConfirmingDelete && !isConfirmingEnd ? (
                      <>
                        <Button 
                          type="button"
                          onClick={(e) => handleClickToggle(poll.id, e)}
                          variant={poll.isActive ? "outline" : "primary"}
                          className="text-sm py-1 px-3 h-8"
                        >
                          {poll.isActive ? (
                              <div className="flex gap-1 items-center"><PauseCircle size={14} /> Pausar</div>
                          ) : (
                              <div className="flex gap-1 items-center"><PlayCircle size={14} /> Ativar</div>
                          )}
                        </Button>

                        <Button
                          type="button"
                          onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmEndId(poll.id);
                          }}
                          variant="danger"
                          className="text-sm py-1 px-3 h-8 z-10"
                          title="Encerrar apenas esta votação"
                        >
                          <div className="flex gap-1 items-center"><StopCircle size={14} /> Encerrar</div>
                        </Button>
                      </>
                    ) : null}

                    {/* CONFIRM END POLL UI */}
                    {isConfirmingEnd && (
                         <div className="flex items-center bg-red-50 rounded p-1 border border-red-200 animate-in fade-in zoom-in">
                            <span className="text-xs text-red-700 font-bold mr-2 ml-1">Encerrar Votação?</span>
                            <Button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEndPoll(poll.id);
                                    setConfirmEndId(null);
                                }}
                                className="h-6 px-2 bg-red-600 hover:bg-red-700 text-white text-xs mr-1"
                            >
                                Sim
                            </Button>
                            <Button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmEndId(null);
                                }}
                                variant="outline"
                                className="h-6 px-2 text-xs hover:bg-gray-50"
                            >
                                Não
                            </Button>
                         </div>
                    )}

                    {!isConfirmingDelete && !isConfirmingEnd && (
                        <Button 
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectPoll(poll.id);
                          }} 
                          variant="outline"
                          className="text-sm py-1 px-3 h-8 flex gap-1 items-center"
                        >
                          <BarChart3 size={14} /> Ver Resultados
                        </Button>
                    )}

                    {/* CONFIRM DELETE UI */}
                    {isConfirmingDelete ? (
                         <div className="flex items-center bg-red-50 rounded p-1 border border-red-200 animate-in fade-in zoom-in">
                            <span className="text-xs text-red-700 font-bold mr-2 ml-1">Deletar Tudo?</span>
                            <Button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDeletePoll(poll.id);
                                    setConfirmDeleteId(null);
                                }}
                                className="h-6 px-2 bg-red-600 hover:bg-red-700 text-white text-xs mr-1"
                            >
                                Sim
                            </Button>
                            <Button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                }}
                                variant="outline"
                                className="h-6 px-2 text-xs hover:bg-gray-50"
                            >
                                Não
                            </Button>
                         </div>
                    ) : !isConfirmingEnd && (
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConfirmDeleteId(poll.id);
                            }}
                            className="p-2 ml-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Excluir Enquete"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
