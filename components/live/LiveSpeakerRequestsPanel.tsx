import React from 'react';
import { LiveSpeakerRequest } from '../../types';
import { Button } from '../ui';
import { Mic, Check, X, Hand, CheckCircle2 } from 'lucide-react';

interface LiveSpeakerRequestsPanelProps {
  requests: LiveSpeakerRequest[];
  isAdmin: boolean;
  onApprove: (requestId: string, userId: string) => void;
  onReject: (requestId: string) => void;
  onRequestWord: () => void;
  hasRequested: boolean;
  isApproved: boolean;
}

export const LiveSpeakerRequestsPanel: React.FC<LiveSpeakerRequestsPanelProps> = ({
  requests,
  isAdmin,
  onApprove,
  onReject,
  onRequestWord,
  hasRequested,
  isApproved,
}) => {
  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-3 border-b bg-slate-50 font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1.5">
          <Hand size={14} className="text-amber-500" /> Pedidos de Fala
        </span>
        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px]">
          {pendingRequests.length} pendentes
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!isAdmin && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
            {isApproved ? (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <div className="text-xs font-bold text-emerald-800">Sua fala foi autorizada!</div>
                <p className="text-[11px] text-emerald-700">
                  Clique no botão "Ativar Microfone" na barra inferior para começar a falar.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  Deseja se manifestar na assembleia? Clique para pedir a palavra ao administrador.
                </p>
                <Button
                  onClick={onRequestWord}
                  disabled={hasRequested}
                  className={`w-full text-xs font-bold py-2.5 flex items-center justify-center gap-2 ${
                    hasRequested ? 'bg-amber-500 text-white cursor-not-allowed' : 'bg-red-650 hover:bg-red-700 text-white'
                  }`}
                >
                  <Mic size={14} />
                  {hasRequested ? 'Palavra Solicitada (Aguardando)' : 'Pedir a Palavra'}
                </Button>
              </>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-2">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                Nenhum pedido de fala pendente no momento.
              </div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{req.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Unidade {req.unit}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => onApprove(req.id, req.userId)}
                      className="bg-green-600 hover:bg-green-700 text-white p-1.5 h-auto"
                      title="Autorizar Fala"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onReject(req.id)}
                      className="bg-red-600 hover:bg-red-700 text-white p-1.5 h-auto"
                      title="Recusar"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
