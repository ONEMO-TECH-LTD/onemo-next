import DefaultVariant from './variants/8017-25975/SelectedDefault';
import ShapeVariant from './variants/8017-26136/SelectedShape';
import AddVariant from './variants/8017-26272/SelectedAdd';
import StyleVariant from './variants/8017-26409/SelectedStyle';
import TuneVariant from './variants/8017-26546/SelectedTune';
import EditVariant from './variants/8017-26682/SelectedEdit';

export type DockProps = {
  selected?: 'Default' | 'Shape' | 'Add' | 'Style' | 'Tune' | 'Edit';
};

export default function Dock({ selected = 'Default' }: DockProps) {

  switch (selected) {
    case 'Default': return <DefaultVariant />;
    case 'Shape': return <ShapeVariant />;
    case 'Add': return <AddVariant />;
    case 'Style': return <StyleVariant />;
    case 'Tune': return <TuneVariant />;
    case 'Edit': return <EditVariant />;
  }
}
