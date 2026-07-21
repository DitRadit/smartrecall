export default function AiProgressBar({ title, description, progress = 68, active = true }) {
  const hasProgress = Number.isFinite(progress);
  const safeProgress = hasProgress ? Math.max(8, Math.min(100, progress)) : null;

  return (
    <div className="rounded-xl border border-primary-fixed-dim bg-primary-fixed/40 p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
          <span className={`material-symbols-outlined text-[22px] ${active ? 'animate-pulse' : ''}`}>auto_awesome</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-label-md text-primary">{title}</p>
            {hasProgress && <span className="text-label-sm text-on-surface-variant">{safeProgress}%</span>}
          </div>
          {description && <p className="text-label-sm text-on-surface-variant mt-1">{description}</p>}
          <div className="mt-3 h-2 rounded-full bg-surface-container-highest overflow-hidden">
            {hasProgress ? (
              <div
                className="h-full rounded-full bg-secondary-container transition-all duration-500 ease-out"
                style={{ width: `${safeProgress}%` }}
              />
            ) : (
              <div className="h-full w-1/3 rounded-full bg-secondary-container animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
