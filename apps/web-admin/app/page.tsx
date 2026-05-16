export default function AdminHomePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        gap: '12px',
      }}
    >
      <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: 0 }}>
        Turnos Admin
      </h1>
      <p style={{ color: '#94A3B8', fontSize: '1.1rem', margin: 0 }}>
        Employer Dashboard — coming in Stint 8
      </p>
      <span
        style={{
          marginTop: '16px',
          padding: '8px 20px',
          background: '#1E293B',
          borderRadius: '999px',
          color: '#6366F1',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        🚧 Placeholder — Stint 0 Scaffold
      </span>
    </main>
  );
}
