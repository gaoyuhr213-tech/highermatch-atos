/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
        },
        slate: {
          25: '#FCFCFD',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        success: { 50: '#F0FDF4', 500: '#22C55E', 600: '#16A34A' },
        warning: { 50: '#FFFBEB', 500: '#F59E0B', 600: '#D97706' },
        error: { 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626' },
        trust: { 50: '#ECFDF5', 500: '#10B981', 600: '#059669' },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'glass': '0 0 0 1px rgba(37, 99, 235, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'glass-hover': '0 0 0 1px rgba(37, 99, 235, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [],
};
