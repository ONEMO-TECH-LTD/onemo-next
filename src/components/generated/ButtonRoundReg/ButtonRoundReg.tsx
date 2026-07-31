import DefaultVariant from './variants/6108-53400/StateDefault';
import SelectedVariant from './variants/8050-6869/StateSelected';
import Circle from '../Circle/Circle';

export type ButtonRoundRegProps =
  | {
  state?: 'Default';
  icons?: typeof Circle;
}
  | {
  state: 'Selected';
  icons?: typeof Circle;
};

export default function ButtonRoundReg(props: ButtonRoundRegProps) {
  const state = props.state ?? 'Default';
  switch (state) {
    case 'Default': return <DefaultVariant icons={props.icons} />;
    case 'Selected': return <SelectedVariant icons={props.icons} />;
  }
}
