import LockedVariant from './variants/12002-17701/StateLocked';
import OpenVariant from './variants/12002-17703/StateOpen';
import DisabledVariant from './variants/12002-17754/StateDisabled';

export type RatioLockProps = {
  state?: 'Locked' | 'Open' | 'disabled';
};

export default function RatioLock({ state = 'Locked' }: RatioLockProps) {

  switch (state) {
    case 'Locked': return <LockedVariant />;
    case 'Open': return <OpenVariant />;
    case 'disabled': return <DisabledVariant />;
  }
}
