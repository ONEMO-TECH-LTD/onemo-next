import FaceModifyFrame1Variant from './variants/8017-27662/SideFaceModifyFrame1';
import FaceVariant from './variants/12002-5763/SideFace';
import BackVariant from './variants/8054-4017/SideBack';

export type EffectCardProps = {
  side?: 'Face' | 'Back' | 'Face-Modify-frame1';
};

export default function EffectCard({ side = 'Face-Modify-frame1' }: EffectCardProps) {

  switch (side) {
    case 'Face-Modify-frame1': return <FaceModifyFrame1Variant />;
    case 'Face': return <FaceVariant />;
    case 'Back': return <BackVariant />;
  }
}
