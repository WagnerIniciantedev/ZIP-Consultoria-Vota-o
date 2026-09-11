import React, { useState, useRef, useEffect } from 'react';
import { LiveChatMessage } from '../../types';
import { Button } from '../ui';
import { Send, MessageSquare } from 'lucide-react';

interface LiveChatPanelProps {
  messages: LiveChatMessage[];
  onSendMessage: (text: string) => Promise<void> | void;
  currentUserId: string;
}

export const LiveChatPanel: React.FC<LiveChatPanelProps> = ({
  messages,
  onSendMessage,
  currentUserId,
}) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage(trimmed);
      setText('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Não foi possível enviar a mensagem. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-3 border-b bg-slate-50 font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
        <MessageSquare size={14} className="text-slate-500" />
        <span>Chat da Assembleia</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs italic">
            Nenhuma mensagem enviada ainda. Seja o primeiro a participar!
          </div>
        ) : (
          messages.map(m => {
            const isSelf = m.userId === currentUserId;
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={m.id || Math.random()} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
                  <span className="font-bold text-slate-700">{m.name}</span>
                  <span>(Unidade {m.unit})</span>
                  {timeStr && <span className="text-slate-400">· {timeStr}</span>}
                </div>
                <div className={`p-2.5 rounded-xl text-xs max-w-[85%] break-words ${
                  isSelf ? 'bg-red-650 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'
                }`}>
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t bg-slate-50 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite sua mensagem..."
          maxLength={500}
          disabled={isSending}
          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-600 bg-white text-slate-800 placeholder-slate-400 shadow-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSending || !text.trim()}
          className="bg-red-650 hover:bg-red-700 text-white px-3.5 py-2.5 font-bold text-xs"
        >
          {isSending ? '...' : <Send size={14} />}
        </Button>
      </form>
    </div>
  );
};
