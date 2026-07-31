import Link from 'next/link';
import { notFound } from 'next/navigation';
import registry from '../_lib/registry.json';
import { COMPONENTS } from '../_lib';

type Comp = {
  name: string; kind: string; figmaName: string; file: string;
  props?: Record<string, { type: string; values: string[] }>;
  variants?: Record<string, { nodeId: string; elements: number; refusals: number }>;
  declaredProps?: string[];
  collides?: boolean;
};

export function generateStaticParams() {
  return Object.values(registry.components as Record<string, Comp>).map((c) => ({ name: c.name }));
}

export default async function ComponentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const entry = Object.entries(registry.components as Record<string, Comp>).find(([, c]) => c.name === name);
  if (!entry) notFound();
  const [figmaId, c] = entry;
  const Component = COMPONENTS[c.name];
  if (!Component) notFound();

  const axis = c.props ? Object.entries(c.props)[0] : undefined;
  const values = axis ? axis[1].values : [null];

  return (
    <>
      <Link href="/converted/components" className="lib-back">← all components</Link>

      <div className="lib-variants">
        {values.map((v) => (
          <div className="lib-variant" key={v ?? 'default'}>
            <div className="lib-stage">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Component {...(v && axis ? ({ [axis[0]]: v } as any) : {})} />
            </div>
          </div>
        ))}
      </div>

      <details className="lib-details">
        <summary>{c.name} · {figmaId}</summary>
        <table className="lib-props">
          <tbody>
            <tr><th>props</th><td>{axis ? `${axis[0]}: ${values.map((v) => `'${v}'`).join(' | ')}` : 'none'}</td></tr>
            {c.declaredProps?.length ? (
              <tr><th>declared in Figma</th><td>{c.declaredProps.join(' · ')}</td></tr>
            ) : null}
            <tr><th>variants</th><td>{values.map((v) => v ?? 'default').join(' · ')}</td></tr>
            <tr><th>source</th><td><code>{c.file}</code></td></tr>
            {c.collides ? <tr><th>warning</th><td className="lib-warn">duplicate Figma name — rename before publication</td></tr> : null}
          </tbody>
        </table>
      </details>
    </>
  );
}
