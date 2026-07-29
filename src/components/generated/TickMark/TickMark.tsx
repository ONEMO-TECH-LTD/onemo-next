import SmallVariant from './variants/8014-3388/SizeSmall';
import CenterVariant from './variants/8014-3390/SizeCenter';

export type TickMarkProps = {
  size?: 'Small' | 'Center';
};

export default function TickMark({ size = 'Small' }: TickMarkProps) {

  switch (size) {
    case 'Small': return <SmallVariant />;
    case 'Center': return <CenterVariant />;
  }
}
