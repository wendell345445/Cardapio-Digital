/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        sidebar: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(222.2 84% 4.9%)',
          active: 'hsl(0 84% 97%)',
          'active-text': 'hsl(0 84% 60%)',
          border: 'hsl(0 84% 60%)',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        menu: {
          // primary/gradient lidos via CSS variables — ThemeInjector sobrescreve por loja.
          // Defaults estão em src/index.css (:root).
          primary: 'var(--menu-primary)',
          'gradient-from': 'var(--menu-gradient-from)',
          'gradient-to': 'var(--menu-gradient-to)',
          text: '#403939',
          'text-soft': '#8b8080',
          'text-muted': '#746d6d',
          bg: '#fafafa',
          'card-border': '#ede8e8',
          divider: 'rgba(64,57,57,0.10)',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
