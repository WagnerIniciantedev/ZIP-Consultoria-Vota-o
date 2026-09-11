import React, { useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';

interface RemoteVideoProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  label?: string;
  objectFit?: 'cover' | 'contain';
}

export const RemoteVideo: React.FC<RemoteVideoProps> = ({
  stream,
  muted = false,
  className = '',
  label = 'Transmissão ao Vivo',
  objectFit = 'cover'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      videoEl.srcObject = stream;
      videoEl.play().then(() => {
        setIsPlaying(true);
        setNeedsGesture(false);
      }).catch(err => {
        console.warn('[RemoteVideo] Autoplay blocked or failed:', err);
        if (!muted) {
          setNeedsGesture(true);
        }
      });
    } else {
      videoEl.srcObject = null;
      setIsPlaying(false);
    }
  }, [stream, muted]);

  const handleStartAudio = async () => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      try {
        videoEl.muted = false;
        await videoEl.play();
        setIsPlaying(true);
        setNeedsGesture(false);
      } catch (err) {
        console.error('[RemoteVideo] Failed to start audio on gesture:', err);
      }
    }
  };

  return (
    <div className={`relative bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center shadow-lg ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-${objectFit}`}
      />

      {/* Overlay label */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-white/10">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-medium">{label}</span>
      </div>

      {/* Mobile autoplay gesture unlock */}
      {needsGesture && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-20">
          <div className="bg-blue-600 text-white p-3 rounded-full mb-3 shadow-lg animate-bounce">
            <Volume2 className="w-6 h-6" />
          </div>
          <h4 className="text-white font-semibold text-base mb-1">Áudio bloqueado pelo navegador</h4>
          <p className="text-slate-300 text-xs mb-4 max-w-xs">
            Toque no botão abaixo para ativar o som da assembleia ao vivo.
          </p>
          <button
            onClick={handleStartAudio}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-md transition"
          >
            <Play className="w-4 h-4 fill-current" />
            Ativar Áudio da Transmissão
          </button>
        </div>
      )}

      {!stream && !needsGesture && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-2 border border-slate-700">
            <VolumeX className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm font-medium">Aguardando transmissão do administrador...</p>
        </div>
      )}
    </div>
  );
};
