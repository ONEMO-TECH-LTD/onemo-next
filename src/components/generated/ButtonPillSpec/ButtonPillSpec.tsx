import DefaultVariant from './variants/6105-18342/StateDefault';
import PressedVariant from './variants/8018-28069/StatePressed';
import Menu from '../Menu/Menu';

export type ButtonPillSpecProps =
  | {
  state?: 'Default';
  icon?: typeof Menu;
}
  | {
  state: 'Pressed';
  icon?: typeof Menu;
};

export default function ButtonPillSpec(props: ButtonPillSpecProps) {
  const state = props.state ?? 'Default';
  switch (state) {
    case 'Default': return <DefaultVariant icon={props.icon} />;
    case 'Pressed': return <PressedVariant icon={props.icon} />;
  }
}
