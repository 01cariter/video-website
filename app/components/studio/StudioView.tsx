'use client';

import SoloWorkspace from '../SoloWorkspace';

interface StudioViewProps {
  soloUrl: string;
}

/** CreatorStudio: Worksolo fills the main column with no header chrome. */
export default function StudioView({ soloUrl }: StudioViewProps) {
  return (
    <div className="studio-view">
      <SoloWorkspace soloUrl={soloUrl} />
    </div>
  );
}
