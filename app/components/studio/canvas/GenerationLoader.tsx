interface GenerationLoaderProps {
  prompt: string;
  resolution?: string;
  label?: string;
}

export default function GenerationLoader({
  resolution = '1024 × 1024',
  label = 'Generating',
}: GenerationLoaderProps) {
  return (
    <div className="relative h-full overflow-hidden bg-[#161412]" role="img" aria-label={label}>
      <span
        className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,.22)_1px,transparent_1.2px)] bg-size-[14px_14px] animate-[ig-drift_2.4s_linear_infinite]"
        aria-hidden
      />
      <span
        className="absolute inset-0 animate-[ig-pulse_1.6s_ease-in-out_infinite_alternate] bg-[radial-gradient(circle_at_50%_55%,color-mix(in_srgb,var(--orange)_34%,transparent),transparent_42%)]"
        aria-hidden
      />
      <span className="absolute right-2 bottom-2 rounded-md bg-white/12 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {resolution}
      </span>
    </div>
  );
}
