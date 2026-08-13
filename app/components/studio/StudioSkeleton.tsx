export default function StudioSkeleton() {
  return (
    <div className="px-8 pb-20 pt-10" role="status" aria-label="Loading studio">
      <span className="sr-only">Loading studio</span>
      <div className="mb-12 grid justify-items-center">
        <i className="mb-6 h-7 w-[min(420px,70%)] rounded-xl bg-secondary" />
        <div className="h-36 w-full max-w-[720px] rounded-[28px] bg-secondary" />
      </div>
      <i className="mb-3 block h-3 w-16 rounded bg-secondary" />
      <div className="grid auto-cols-[minmax(188px,1fr)] grid-flow-col gap-3.5">
        <i className="h-[138px] rounded-[18px] bg-secondary" />
        <i className="h-[138px] rounded-[18px] bg-secondary" />
        <i className="h-[138px] rounded-[18px] bg-secondary" />
        <i className="h-[138px] rounded-[18px] bg-secondary" />
      </div>
    </div>
  );
}
