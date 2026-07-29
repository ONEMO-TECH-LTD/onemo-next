import Option2Variant from './variants/12002-3902/Mode2';
import Option1Variant from './variants/12002-4330/Mode1';
import Option3Variant from './variants/12002-4339/Mode3';

export type ModeSelectorProps = {
  mode?: '2' | '1' | '3';
};

export default function ModeSelector({ mode = '2' }: ModeSelectorProps) {

  switch (mode) {
    case '2': return <Option2Variant />;
    case '1': return <Option1Variant />;
    case '3': return <Option3Variant />;
  }
}
