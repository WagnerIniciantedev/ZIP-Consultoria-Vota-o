import React, { useState, useEffect } from 'react';
import { getCompanySettings } from '../services/dataService';

interface LogoZipProps {
  variant?: 'white' | 'red' | 'red-bg' | 'grayscale';
  className?: string;
  style?: React.CSSProperties;
  logoType?: 'login' | 'system' | 'default';
}

export const LogoZip: React.FC<LogoZipProps> = ({
  variant = 'white',
  className = '',
  style,
  logoType = 'default',
}) => {
  const [logoSource, setLogoSource] = useState<string | null>(null);
  const [loginSize, setLoginSize] = useState<number>(280);
  const [systemSize, setSystemSize] = useState<number>(160);

  useEffect(() => {
    const updateLogo = () => {
      const settings = getCompanySettings();
      setLogoSource(settings.logo || null);
      setLoginSize(settings.loginLogoSize || 280);
      setSystemSize(settings.systemLogoSize || 160);
    };

    updateLogo();
    window.addEventListener('company-settings-updated', updateLogo);
    return () => {
      window.removeEventListener('company-settings-updated', updateLogo);
    };
  }, []);

  // Determine color based on variant
  const primaryColor = variant === 'red' ? '#E60000' : variant === 'grayscale' ? '#1e293b' : '#FFFFFF';
  const bgColor = variant === 'red-bg' ? '#E60000' : 'transparent';

  // Calculate dynamic dimensions
  const customWidth = logoType === 'login' ? `${loginSize}px` : logoType === 'system' ? `${systemSize}px` : undefined;

  if (logoSource) {
    const filterClass = variant === 'grayscale' ? 'grayscale opacity-75' : '';
    return (
      <img
        src={logoSource}
        alt="Logo"
        className={`${className} ${filterClass}`}
        style={{
          display: 'block',
          maxHeight: '100%',
          maxWidth: '100%',
          width: customWidth,
          objectFit: 'contain',
          ...style,
        }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (

    <svg
      viewBox="0 0 450 280"
      className={className}
      style={{
        backgroundColor: bgColor,
        display: 'block',
        width: customWidth,
        maxWidth: '100%',
        ...style,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Left Half Mask: Solid white area, with vertical windows cut out */}
        <mask id="building-left-mask-zip">
          <rect x="198" y="70" width="16" height="120" fill="#FFFFFF" />
          {/* Vertical dashed line to cut out */}
          <line 
            x1="204" 
            y1="85" 
            x2="204" 
            y2="180" 
            stroke="#000000" 
            strokeWidth="2.5" 
            strokeDasharray="5,4.5" 
          />
        </mask>

        {/* Right Half Mask: Solid white area, with horizontal slats cut out */}
        <mask id="building-right-mask-zip">
          <rect x="215" y="65" width="30" height="125" fill="#FFFFFF" />
          {/* Horizontal black slats to cut out */}
          <g stroke="#000000" strokeWidth="2.5">
            <line x1="215" y1="80" x2="242" y2="80" />
            <line x1="215" y1="87" x2="242" y2="87" />
            <line x1="215" y1="94" x2="242" y2="94" />
            <line x1="215" y1="101" x2="242" y2="101" />
            <line x1="215" y1="108" x2="242" y2="108" />
            <line x1="215" y1="115" x2="242" y2="115" />
            <line x1="215" y1="122" x2="242" y2="122" />
            <line x1="215" y1="129" x2="242" y2="129" />
            <line x1="215" y1="136" x2="242" y2="136" />
            <line x1="215" y1="143" x2="242" y2="143" />
            <line x1="215" y1="150" x2="242" y2="150" />
            <line x1="215" y1="157" x2="242" y2="157" />
            <line x1="215" y1="164" x2="242" y2="164" />
            <line x1="215" y1="171" x2="242" y2="171" />
            <line x1="215" y1="178" x2="242" y2="178" />
          </g>
        </mask>
      </defs>

      <g>
        {/* Letter Z (Double Line - parallel crisp strokes) */}
        <path
          d="M 105,75 H 185 L 105,185 H 185"
          fill="none"
          stroke={primaryColor}
          strokeWidth="14"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <path
          d="M 105,112 H 156 L 130,148 H 185"
          fill="none"
          stroke={primaryColor}
          strokeWidth="14"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* Letter I Left Half */}
        <path
          d="M 200,185 V 80 C 200,80 206,75 212,74 V 185 Z"
          fill={primaryColor}
          mask="url(#building-left-mask-zip)"
        />

        {/* Letter I Right Half with curving outer edge */}
        <path
          d="M 215.5,185 V 70 C 215.5,70 223,72 231,80 C 238,87 240,98 240,112 V 185 Z"
          fill={primaryColor}
          mask="url(#building-right-mask-zip)"
        />

        {/* Letter P (Slab Serif with clean curves and perfect proportions) */}
        <path
          d="M 255,185 H 311 V 177 H 297 V 145 C 325,145 358,133 358,110 C 358,87 325,75 297,75 H 255 V 83 H 270 V 177 H 255 Z M 297,87 C 315,87 340,94 340,110 C 340,126 315,133 297,133 Z"
          fill={primaryColor}
          fillRule="evenodd"
        />

        {/* Text: CONSULTORIA (Spans exactly flush to the outer edges) */}
        <g
          fontFamily="'Montserrat', 'Inter', 'Helvetica Neue', 'Arial', sans-serif"
          fontSize="20"
          fontWeight="700"
          textAnchor="middle"
          fill={primaryColor}
        >
          <text x="100" y="235">C</text>
          <text x="125.6" y="235">O</text>
          <text x="151.2" y="235">N</text>
          <text x="176.8" y="235">S</text>
          <text x="202.4" y="235">U</text>
          <text x="228" y="235">L</text>
          <text x="253.6" y="235">T</text>
          <text x="279.2" y="235">O</text>
          <text x="304.8" y="235">R</text>
          <text x="330.4" y="235">I</text>
          <text x="356" y="235">A</text>
        </g>
      </g>
    </svg>
  );
};
