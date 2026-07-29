import SmallVariant from './variants/8051-20699/SizeSmall';
import MediumVariant from './variants/8053-2724/SizeMedium';
import LargeVariant from './variants/8053-2726/SizeLarge';

export type SProps = {
  size?: 'SMALL' | 'Medium' | 'LARGE';
};

export default function S({ size = 'SMALL' }: SProps) {

  switch (size) {
    case 'SMALL': return <SmallVariant />;
    case 'Medium': return <MediumVariant />;
    case 'LARGE': return <LargeVariant />;
  }
}
