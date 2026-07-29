import SmallVariant from './variants/12016-11252/SizeSmall';
import MediumVariant from './variants/12016-11251/SizeMedium';
import LargeVariant from './variants/12016-11250/SizeLarge';
import CustomVariant from './variants/12016-11282/SizeCustom';

export type SizeIndicatorProps = {
  size?: 'Large' | 'Small' | 'Medium' | 'Custom';
};

export default function SizeIndicator({ size = 'Small' }: SizeIndicatorProps) {

  switch (size) {
    case 'Small': return <SmallVariant />;
    case 'Medium': return <MediumVariant />;
    case 'Large': return <LargeVariant />;
    case 'Custom': return <CustomVariant />;
  }
}
