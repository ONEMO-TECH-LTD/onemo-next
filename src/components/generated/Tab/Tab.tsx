import ActiveVariant from './variants/8017-21679/StateActive';
import PassiveVariant from './variants/8017-25624/StatePassive';
import IconBasket from '../IconBasket/IconBasket';

export type TabProps =
  | {
  state?: 'Active';
  instance?: typeof IconBasket;
  label?: string;
}
  | {
  state: 'Passive';
  instance?: typeof IconBasket;
  label?: string;
};

export default function Tab(props: TabProps) {
  const state = props.state ?? 'Active';
  switch (state) {
    case 'Active': return <ActiveVariant instance={props.instance} label={props.label} />;
    case 'Passive': return <PassiveVariant instance={props.instance} label={props.label} />;
  }
}
