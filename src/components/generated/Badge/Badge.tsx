import ActiveVariant from './variants/12002-3882/StateActive';
import PassiveVariant from './variants/12002-3886/StatePassive';

export type BadgeProps = {
  state?: 'Active' | 'Passive';
};

export default function Badge({ state = 'Active' }: BadgeProps) {

  switch (state) {
    case 'Active': return <ActiveVariant />;
    case 'Passive': return <PassiveVariant />;
  }
}
