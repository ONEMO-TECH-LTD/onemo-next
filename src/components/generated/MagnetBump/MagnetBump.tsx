import SmallVariant from './variants/12016-10919/SizeSmall';
import MediumVariant from './variants/12016-10933/SizeMedium';
import Size3Variant from './variants/12016-10985/SizeSize3';

export type MagnetBumpProps = {
  size?: 'Small' | 'Medium' | 'SIze3';
};

export default function MagnetBump({ size = 'Small' }: MagnetBumpProps) {

  switch (size) {
    case 'Small': return <SmallVariant />;
    case 'Medium': return <MediumVariant />;
    case 'SIze3': return <Size3Variant />;
  }
}
