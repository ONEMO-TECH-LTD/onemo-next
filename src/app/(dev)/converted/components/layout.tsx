// Component library — the converted Figma Components Board, rendered under the exact
// token/font conditions the converted screens use. Same environment, so a component that
// renders correctly here renders correctly inside a screen.
import './_lib/tokens.css';
import './_lib/fonts.css';
import './library.css';

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return <div className="lib-root">{children}</div>;
}
