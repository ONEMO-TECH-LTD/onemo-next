import Link from 'next/link';
import registry from './_lib/registry.json';

type Comp = {
  name: string; kind: string; figmaName: string;
  props?: Record<string, { type: string; values: string[] }>;
  variants?: Record<string, unknown>;
  collides?: boolean;
};

export default function ComponentsIndex() {
  const comps = Object.entries(registry.components as Record<string, Comp>)
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sets = comps.filter((c) => c.kind === 'set');
  const singles = comps.filter((c) => c.kind !== 'set');

  return (
    <>
      <div className="lib-grid">
        {comps.map((c) => {
          const axis = c.props ? Object.entries(c.props)[0] : undefined;
          return (
            <Link key={c.id} href={`/converted/components/${c.name}`} className="lib-card">
              <div className="lib-name">{c.name}</div>
              <div className="lib-meta">
                {axis ? `${axis[1].values.length} variants` : ''}
                {c.collides ? <span className="lib-warn"> · duplicate name</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
