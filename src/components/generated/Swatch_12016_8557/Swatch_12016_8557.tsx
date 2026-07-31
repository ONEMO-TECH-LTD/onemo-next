import DefaultVariant from './variants/12016-8556/StateDefault';
import SelectedVariant from './variants/12016-8606/StateSelected';

export type Swatch_12016_8557Props = {
  state?: 'Default' | 'Selected';
};

export default function Swatch_12016_8557({ state = 'Default' }: Swatch_12016_8557Props) {

  switch (state) {
    case 'Default': return <DefaultVariant />;
    case 'Selected': return <SelectedVariant />;
  }
}
