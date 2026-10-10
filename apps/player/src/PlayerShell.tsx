/**
 * G0 public player shell — no hierarchy/inspector/editor chrome.
 * Must not import @tg-creator/editor-core (enforced by package dependency graph).
 */
export function PlayerShell() {
  return (
    <div
      data-testid="player-shell"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
      }}
    >
      <header style={{ padding: '16px 20px 8px' }}>
        <div style={{ fontSize: 13, color: 'var(--player-muted)' }}>Публичный плеер</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 650 }}>TG Creator Player</h1>
      </header>

      <main
        data-testid="player-stage"
        style={{
          margin: 12,
          borderRadius: 16,
          border: '1px solid #1c2733',
          background: 'radial-gradient(circle at 30% 20%, #122033 0%, #070b10 55%, #05080c 100%)',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 16 }}>Ожидание опубликованного проекта</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--player-muted)' }}>
            Здесь будет runtime 3D/2D/App без панели редактора.
          </p>
        </div>
      </main>

      <footer
        style={{
          padding: '10px 20px 18px',
          fontSize: 12,
          color: 'var(--player-muted)',
        }}
      >
        G0 · player shell · без editor-core
      </footer>
    </div>
  );
}
