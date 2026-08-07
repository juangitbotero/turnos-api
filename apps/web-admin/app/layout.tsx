import './globals.css';
import MobileOverlay from './MobileOverlay';
import { LanguageProvider } from '../lib/i18n';
import { HtmlLangSync } from './HtmlLangSync';

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

        {/*
          Home-screen install ("Add to Home Screen").
          The icons are the SAME files the mobile app ships, so a shortcut on a
          phone is visually identical to the real app.
          `*-web-app-capable` is what makes it launch WITHOUT browser chrome —
          without it the shortcut opens an ordinary Safari/Chrome tab with a
          visible address bar. iOS still reads the `apple-` prefixed one; the
          unprefixed name is the standard it is being replaced by.
        */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* The label under the icon on the home screen — not the <title>. */}
        <meta name="apple-mobile-web-app-title" content="Turnos" />
        <meta name="application-name" content="Turnos" />
        <meta name="theme-color" content="#6a79ff" />
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
        <LanguageProvider>
          {/* Keeps <html lang> in step with the chosen language for screen
              readers and browser translation prompts. */}
          <HtmlLangSync />
          <MobileOverlay />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
