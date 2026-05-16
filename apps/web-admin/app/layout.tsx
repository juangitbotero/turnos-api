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
      </head>
      <body style={{ margin: 0, background: '#0F172A', color: '#F8FAFC' }}>
        {children}
      </body>
    </html>
  );
}
