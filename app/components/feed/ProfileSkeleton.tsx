/** Profile identity, stats, and media grid while `/u/[handle]` loads. */
export default function ProfileSkeleton() {
  return (
    <div className="pf pf-shell pf-skeleton" role="status" aria-label="Loading profile">
      <span className="sr-only">Loading profile</span>
      <header className="pf-topbar">
        <i className="pd-skel-circle" />
        <div className="pf-topbar-title" style={{ gap: 6 }}>
          <i className="pd-skel-line" style={{ width: 120, height: 14 }} />
          <i className="pd-skel-line" style={{ width: 80, height: 10 }} />
        </div>
        <i className="pd-skel-line" style={{ width: 56, height: 28, borderRadius: 999 }} />
      </header>
      <section className="pf-hero">
        <div className="pf-identity">
          <i className="pf-skel-av" />
          <div className="pf-id" style={{ display: 'grid', gap: 9 }}>
            <i className="pd-skel-line" style={{ width: 72, height: 9 }} />
            <i className="pd-skel-line" style={{ width: 180, height: 28 }} />
            <i className="pd-skel-line" style={{ width: 104, height: 11 }} />
            <i className="pd-skel-line" style={{ width: '72%', height: 12 }} />
          </div>
          <i className="pd-skel-line" style={{ width: 118, height: 38, borderRadius: 999 }} />
        </div>
        <div className="pf-level">
          <i className="pd-skel-line" style={{ width: 122, height: 12 }} />
          <i className="pd-skel-line" style={{ width: '100%', height: 6, marginTop: 10 }} />
        </div>
      </section>
      <div className="pf-stats pf-stats-skel" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className="pf-content-head pf-content-head-skel" aria-hidden="true">
        <i className="pd-skel-line" style={{ width: 118, height: 20 }} />
        <i className="pd-skel-line" style={{ width: 180, height: 10 }} />
      </div>
      <div className="pf-grid-skel" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <i key={index} style={{ animationDelay: `${(index % 3) * 0.08}s` }} />
        ))}
      </div>
    </div>
  );
}
