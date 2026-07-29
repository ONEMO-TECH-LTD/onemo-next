import FrontsideVariant from './variants/8017-21218/StateFrontside';
import BacksideVariant from './variants/8017-21220/StateBackside';

export type MicroSectionCardModeProps = {
  state?: 'Frontside' | 'Backside';
};

export default function MicroSectionCardMode({ state = 'Frontside' }: MicroSectionCardModeProps) {

  switch (state) {
    case 'Frontside': return <FrontsideVariant />;
    case 'Backside': return <BacksideVariant />;
  }
}
