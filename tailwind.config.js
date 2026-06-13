/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // PRD Brand / AI蓝
        brand: {
          50: '#EEF4FF', 100: '#D9E5FF', 200: '#BCD0FF', 300: '#8FB1FF',
          400: '#5E8BFB', 500: '#3B6FF2', 600: '#2563EB', 700: '#1D4FD0',
          800: '#1E45A8', 900: '#1E3A82', 950: '#172554',
        },
        // 保留原primary别名兼容现有代码
        primary: {
          50: '#EEF4FF', 100: '#D9E5FF', 200: '#BCD0FF', 300: '#8FB1FF',
          400: '#5E8BFB', 500: '#2563EB', 600: '#1D4FD0', 700: '#1E45A8',
          800: '#1E3A82', 900: '#172554',
        },
        // PRD Ink / 冷中性
        ink: {
          0: '#FFFFFF', 50: '#F8FAFC', 100: '#F1F4F8', 200: '#E3E8EF',
          300: '#CDD5E0', 400: '#9AA6B8', 500: '#697586', 600: '#4B5565',
          700: '#364152', 800: '#202939', 900: '#121926', 950: '#0B0F1A',
        },
        // 保留原slate兼容
        slate: {
          25: '#FCFCFD', 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0',
          300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 600: '#475569',
          700: '#334155', 800: '#1E293B', 900: '#0F172A', 950: '#020617',
        },
        // 语义色
        trust: {
          50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
          400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857', 800: '#065F46',
        },
        risk: {
          50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
          400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C',
        },
        warn: {
          50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
          400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
        },
        // 保留原success/warning/error兼容
        success: { 50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D' },
        warning: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
        error: { 50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5', 400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
        // 证书印章色
        seal: {
          ev: '#047857',
          ov: '#2563EB',
          dv: '#697586',
        },
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'SF Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'h1': ['30px', { lineHeight: '1.2', fontWeight: '600' }],
        'h2': ['24px', { lineHeight: '1.25', fontWeight: '600' }],
        'h3': ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'overline': ['11px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.05em' }],
        'mono-sm': ['13px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      boxShadow: {
        'hairline': '0 0 0 1px rgba(0, 0, 0, 0.04)',
        'e2': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'e3': '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'e4': '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
        'focus': '0 0 0 3px rgba(37, 99, 235, 0.18)',
        // 保留原有
        'glass': '0 0 0 1px rgba(37, 99, 235, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'glass-hover': '0 0 0 1px rgba(37, 99, 235, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'button': '10px',
        'input': '10px',
        'card': '16px',
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      transitionDuration: {
        'fast': '140ms',
        'base': '200ms',
        'slow': '320ms',
        'ceremony': '800ms',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'fluid': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      spacing: {
        'sidebar': '264px',
        'sidebar-collapsed': '64px',
        'topbar': '56px',
      },
      height: {
        'row': '44px',
        'row-compact': '36px',
      },
      keyframes: {
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(5, 150, 105, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(5, 150, 105, 0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'stamp': {
          '0%': { transform: 'scale(2) rotate(-15deg)', opacity: '0' },
          '60%': { transform: 'scale(0.9) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'check-reveal': {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'pulse-glow': 'pulse-glow 2s infinite',
        'slide-in': 'slide-in 0.2s cubic-bezier(0.2, 0, 0, 1)',
        'stamp': 'stamp 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        'check-reveal': 'check-reveal 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
