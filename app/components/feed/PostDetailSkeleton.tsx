export default function PostDetailSkeleton() {
  return (
    <div className="pd pd-skeleton" role="status" aria-label="Loading post">
      <span className="sr-only">Loading post</span>
      <header className="pd-top">
        <i className="pd-skel-circle" />
        <i className="pd-skel-line" style={{ width: 56 }} />
        <div className="pd-top-author">
          <i className="pd-skel-circle" style={{ width: 26, height: 26, borderRadius: '50%' }} />
          <div className="pd-top-who" style={{ gap: 4 }}>
            <i className="pd-skel-line" style={{ width: 88, height: 10 }} />
            <i className="pd-skel-line" style={{ width: 64, height: 8 }} />
          </div>
        </div>
      </header>
      <div className="pd-body">
        <i className="pd-skel-line" style={{ width: '70%', height: 18 }} />
        <i className="pd-skel-line" style={{ width: '95%', marginTop: 10 }} />
        <i className="pd-skel-line" style={{ width: '55%', marginTop: 8 }} />
      </div>
      <i className="pd-skel-media" />
      <div className="pd-actions">
        <i className="pd-skel-line" style={{ width: 220, height: 28 }} />
      </div>
    </div>
  );
}
