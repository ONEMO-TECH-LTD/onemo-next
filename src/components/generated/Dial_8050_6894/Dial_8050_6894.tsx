import DefaultVariant from './variants/8018-28194/StateDefault';
import SelectedVariant from './variants/8050-6895/StateSelected';

export type Dial_8050_6894Props = {
  state?: 'Selected' | 'Default';
};

export default function Dial_8050_6894({ state = 'Default' }: Dial_8050_6894Props) {

  switch (state) {
    case 'Default': return <DefaultVariant />;
    case 'Selected': return <SelectedVariant />;
  }
}
