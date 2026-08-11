import { getSoloUrl } from '@/lib/solo';
import StudioView from '../../components/studio/StudioView';

export default function StudioPage() {
  return <StudioView soloUrl={getSoloUrl()} />;
}
