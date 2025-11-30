
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Button } from './ui';
import { X, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react';

export interface TourStep {
  targetId?: string; // ID do elemento HTML para focar. Se nulo, centraliza.
  title: string;
  content: string;
  position?: 'right' | 'bottom' | 'left' | 'top' | 'center';
}

interface TourGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  steps: TourStep[];
}

export const TourGuide: React.FC<TourGuideProps> = ({ isOpen, onClose, onComplete, steps }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  // Reset step when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  // Calculate position of the target element
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (currentStep.targetId) {
        const element = document.getElementById(currentStep.targetId);
        if (element) {
          const rect = element.getBoundingClientRect();
          setCoords({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          });
          return;
        }
      }
      // Fallback to center if no ID or element not found
      setCoords(null);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [currentStepIndex, isOpen, currentStep.targetId]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  // Determine Popover Position style
  let popoverStyle: React.CSSProperties = {};
  
  if (coords) {
    // Positioning logic relative to target
    // Default to 'right' for sidebar items
    const gap = 12;
    
    // Simple logic: If right, put it to the right of the element
    if (!currentStep.position || currentStep.position === 'right') {
        popoverStyle = {
            top: coords.top,
            left: coords.left + coords.width + gap,
            maxWidth: '350px'
        };
    } else if (currentStep.position === 'bottom') {
        popoverStyle = {
            top: coords.top + coords.height + gap,
            left: coords.left,
            maxWidth: '350px'
        };
    }
    // Add mobile fallback inside CSS or logic if needed, but for now absolute is fine
  } else {
    // Center logic
    popoverStyle = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '450px',
        width: '90%'
    };
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 transition-opacity duration-300">
      
      {/* Spotlight Effect (Optional/Simple implementation) */}
      {coords && (
        <div 
            className="absolute border-2 border-white rounded transition-all duration-300 ease-in-out box-content shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            style={{
                top: coords.top - 4,
                left: coords.left - 4,
                width: coords.width + 4,
                height: coords.height + 4,
                pointerEvents: 'none' 
            }}
        />
      )}

      {/* Content Box */}
      <div 
        className="absolute bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300"
        style={popoverStyle}
      >
        <div className="bg-red-600 p-4 flex justify-between items-center text-white">
            <h3 className="font-bold text-lg flex items-center gap-2">
                <HelpCircle size={20} />
                {currentStep.title}
            </h3>
            <button onClick={onClose} className="hover:bg-red-700 rounded p-1 transition-colors">
                <X size={18} />
            </button>
        </div>
        
        <div className="p-6">
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {currentStep.content}
            </p>

            <div className="flex justify-between items-center pt-2">
                <div className="flex gap-1">
                    {steps.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`h-1.5 rounded-full transition-all ${idx === currentStepIndex ? 'w-6 bg-red-600' : 'w-2 bg-gray-300'}`} 
                        />
                    ))}
                </div>

                <div className="flex gap-2">
                    {currentStepIndex > 0 && (
                        <Button variant="outline" size="sm" onClick={handlePrev}>
                            <ChevronLeft size={16} /> Voltar
                        </Button>
                    )}
                    <Button onClick={handleNext} size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                        {isLastStep ? 'Concluir' : 'Próximo'} {isLastStep ? <CheckIcon /> : <ChevronRight size={16} className="ml-1" />}
                    </Button>
                </div>
            </div>
            
            {!isLastStep && (
                <button 
                    onClick={onClose} 
                    className="text-xs text-gray-400 hover:text-gray-600 mt-4 underline w-full text-center block"
                >
                    Pular Tour
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polyline points="20 6 9 17 4 12"></polyline></svg>
)
