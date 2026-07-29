import MagneticVariant from './variants/8017-20929/ModeMagnetic';
import StickyVariant from './variants/8017-20930/ModeSticky';

export type ToggleComboProps = {
  mode?: 'Magnetic' | 'Sticky';
};

export default function ToggleCombo({ mode = 'Magnetic' }: ToggleComboProps) {

  switch (mode) {
    case 'Magnetic': return <MagneticVariant />;
    case 'Sticky': return <StickyVariant />;
  }
}
