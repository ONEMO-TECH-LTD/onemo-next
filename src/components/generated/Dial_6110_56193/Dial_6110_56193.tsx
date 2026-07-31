import NewValueVariant from './variants/6110-56191/StateNewValue';
import ActiveVariant from './variants/6110-56192/StateActive';
import Hexagon from '../Hexagon/Hexagon';

export type Dial_6110_56193Props =
  | {
  state: 'Active';
  icons?: never;
  value?: string;
}
  | {
  state?: 'New value';
  icons?: typeof Hexagon;
  value?: never;
};

export default function Dial_6110_56193(props: Dial_6110_56193Props) {
  const state = props.state ?? 'New value';
  switch (state) {
    case 'New value': return <NewValueVariant icons={props.icons} />;
    case 'Active': return <ActiveVariant value={props.value} />;
  }
}
