import FrontsideVariant from './variants/8017-20998/StateFrontside';
import BacksideVariant from './variants/8017-20996/StateBackside';

export type ButtonFBFlipProps = {
  state?: 'Frontside' | 'Backside';
};

export default function ButtonFBFlip({ state = 'Backside' }: ButtonFBFlipProps) {

  switch (state) {
    case 'Frontside': return <FrontsideVariant />;
    case 'Backside': return <BacksideVariant />;
  }
}
