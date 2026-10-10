import { PROJECT_SCHEMA_VERSION } from '@tg-creator/project-schema';

const apiUrl = import.meta.env.VITE_CREATOR_API_URL ?? 'http://localhost:3010';

/**
 * G0 editor shell: chrome with hierarchy / viewport / inspector placeholders.
 * No engine adapters yet — those arrive in later gates.
 */
export function StudioShell() {
  return (
    <div
      data-testid="studio-shell"
      style={{
        display: 'grid',
        gridTemplateRows: '48px 1fr 28px',
        height: '100%',
        minHeight: '100dvh',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 12px',
          borderBottom: '1px solid var(--studio-border)',
          background: 'var(--studio-panel)',
        }}
      >
        <strong style={{ letterSpacing: '0.02em' }}>TG Creator Studio</strong>
        <nav style={{ display: 'flex', gap: 8, color: 'var(--studio-muted)', fontSize: 13 }}>
          <span>Файл</span>
          <span>Правка</span>
          <span>Вид</span>
        </nav>
        <button
          type="button"
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            background: 'var(--studio-accent)',
            color: '#052016',
            fontWeight: 600,
          }}
        >
          Play
        </button>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(160px, 22%) 1fr minmax(180px, 26%)',
          minHeight: 0,
        }}
      >
        <aside
          data-testid="studio-hierarchy"
          style={{
            borderRight: '1px solid var(--studio-border)',
            background: 'var(--studio-panel)',
            padding: 12,
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--studio-muted)', marginBottom: 8 }}>
            Иерархия
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 14 }}>
            <li>Main Scene</li>
            <li>Cube</li>
            <li>Camera</li>
          </ul>
        </aside>

        <main
          data-testid="studio-viewport"
          style={{
            background: 'var(--studio-viewport)',
            display: 'grid',
            placeItems: 'center',
            minHeight: 0,
          }}
        >
          <div style={{ textAlign: 'center', color: 'var(--studio-muted)', padding: 24 }}>
            <div style={{ fontSize: 15, color: 'var(--studio-ink)', marginBottom: 6 }}>
              Viewport
            </div>
            <div style={{ fontSize: 13 }}>
              Оболочка редактора · schema v{PROJECT_SCHEMA_VERSION}
            </div>
            <div style={{ fontSize: 12, marginTop: 8 }}>API: {apiUrl}</div>
          </div>
        </main>

        <aside
          data-testid="studio-inspector"
          style={{
            borderLeft: '1px solid var(--studio-border)',
            background: 'var(--studio-panel)',
            padding: 12,
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--studio-muted)', marginBottom: 8 }}>
            Инспектор
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--studio-muted)' }}>
            Выберите объект сцены. Панели свойств появятся в G3–G4.
          </p>
        </aside>
      </div>

      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderTop: '1px solid var(--studio-border)',
          background: 'var(--studio-panel)',
          fontSize: 12,
          color: 'var(--studio-muted)',
        }}
      >
        G0 · оболочка готова · движок Planned
      </footer>
    </div>
  );
}
