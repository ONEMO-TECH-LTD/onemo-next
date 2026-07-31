import SmallVariant from './variants/12016-11147/Property1Small';
import MediumVariant from './variants/12016-11146/Property1Medium';
import Variant4Variant from './variants/12016-11345/Property1Variant4';
import LargeVariant from './variants/12016-11145/Property1Large';

export type Component1Props = {
  property1?: 'LARGE' | 'MEDIUM' | 'SMALL' | 'Variant4';
};

export default function Component1({ property1 = 'SMALL' }: Component1Props) {

  switch (property1) {
    case 'SMALL': return <SmallVariant />;
    case 'MEDIUM': return <MediumVariant />;
    case 'Variant4': return <Variant4Variant />;
    case 'LARGE': return <LargeVariant />;
  }
}
