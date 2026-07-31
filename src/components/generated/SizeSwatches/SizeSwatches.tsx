import FreeformVariant from './variants/12016-8539/SizeFreeform';
import NoneVariant from './variants/12016-8613/SizeNone';
import LargeVariant from './variants/12016-8550/SizeLarge';
import SmallVariant from './variants/12016-8548/SizeSmall';
import MediumVariant from './variants/12016-8546/SizeMedium';

export type SizeSwatchesProps = {
  size?: 'Freeform' | 'Medium' | 'Small' | 'Large' | 'None';
};

export default function SizeSwatches({ size = 'Freeform' }: SizeSwatchesProps) {

  switch (size) {
    case 'Freeform': return <FreeformVariant />;
    case 'None': return <NoneVariant />;
    case 'Large': return <LargeVariant />;
    case 'Small': return <SmallVariant />;
    case 'Medium': return <MediumVariant />;
  }
}
