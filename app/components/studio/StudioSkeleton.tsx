/** Full-bleed studio placeholder while the Solo iframe route loads. */
export default function StudioSkeleton() {
  return (
    <div className="studio-view studio-skel" role="status" aria-label="Loading studio">
      <span className="sr-only">Loading studio</span>
      <div className="studio-skel-chrome">
        <i />
        <i />
        <i />
      </div>
      <div className="studio-skel-stage" />
    </div>
  );
}
