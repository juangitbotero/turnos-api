import './globals.css';
import MobileOverlay from './MobileOverlay';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <head>
        <title>Turnos Admin</title>
        <meta name="description" content="Turnos Employer Admin Dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --color-primary: #6a79ff;
            --color-primary-dark: #5260e0;
            --color-primary-light: #eef0ff;
            --color-secondary: #fafdff;
            --color-neutral: #d9d9d9;
            --color-text-primary: #1a1a2e;
            --color-text-secondary: #6b7280;
            --color-success: #22c55e;
            --color-warning: #f59e0b;
            --color-error: #ef4444;
          }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--color-secondary);
            color: var(--color-text-primary);
            -webkit-font-smoothing: antialiased;
          }
        `}</style>
      </head>
      <body>
        <MobileOverlay />
        {children}
      </body>
    </html>
  );
}
