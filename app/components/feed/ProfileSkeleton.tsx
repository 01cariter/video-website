/** Profile identity, stats, and media grid while `/u/[handle]` loads. */
export default function ProfileSkeleton() {
  return (
    <div
      className="pf pf-shell pf-skeleton"
      role="status"
      aria-label="Loading profile"
    >
      <span className="sr-only">Loading profile</span>
      <header className="pf-topbar">
        <i className="pd-skel-circle" />
        <div className="pf-topbar-title">
          <i className="pd-skel-line" style={{ width: 68, height: 14 }} />
        </div>
      </header>
      <section className="pf-hero">
        <div className="pf-identity">
          <i className="pf-skel-av" />
          <div className="pf-id">
            <div className="pf-name-row">
              <div style={{ display: 'grid', gap: 7 }}>
                <i className="pd-skel-line" style={{ width: 142, height: 23 }} />
                <i className="pd-skel-line" style={{ width: 92, height: 10 }} />
              </div>
              <i
                className="pd-skel-line"
                style={{ width: 64, height: 30, borderRadius: 10 }}
              />
            </div>
            <i
              className="pd-skel-line"
              style={{ width: '68%', height: 11, marginTop: 10 }}
            />
            <div className="pf-level">
              <i className="pd-skel-line" style={{ width: 124, height: 9 }} />
              <i
                className="pd-skel-line"
                style={{ width: '100%', height: 4, marginTop: 7 }}
              />
            </div>
          </div>
        </div>
      </section>
      <div className="pf-stats pf-stats-skel" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className="pf-grid-skel" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <i key={index} style={{ animationDelay: `${(index % 3) * 0.08}s` }} />
        ))}
      </div>
    </div>
  );
}
