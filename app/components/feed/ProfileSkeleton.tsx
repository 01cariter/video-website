/** Profile header + tabs + media grid while `/u/[handle]` loads. */
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
      <header className="pf-head">
        <i className="pf-skel-av" />
        <div className="pf-id" style={{ display: 'grid', gap: 10 }}>
          <i className="pd-skel-line" style={{ width: 160, height: 22 }} />
          <i className="pd-skel-line" style={{ width: 100, height: 12 }} />
          <i className="pd-skel-line" style={{ width: '70%', height: 12 }} />
          <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
            <i className="pd-skel-line" style={{ width: 64, height: 14 }} />
            <i className="pd-skel-line" style={{ width: 72, height: 14 }} />
            <i className="pd-skel-line" style={{ width: 56, height: 14 }} />
          </div>
        </div>
      </header>
      <div className="pf-tabs pf-tabs-skel" aria-hidden="true">
        <i className="pd-skel-line" style={{ width: 88, height: 34, borderRadius: 9 }} />
        <i className="pd-skel-line" style={{ width: 88, height: 34, borderRadius: 9 }} />
      </div>
      <div className="pf-grid-skel" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <i key={index} style={{ animationDelay: `${(index % 3) * 0.08}s` }} />
        ))}
      </div>
    </div>
  );
}
