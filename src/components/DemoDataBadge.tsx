/**
 * Shown anywhere demo/sample data is displayed to the farmer.
 * DATA HONESTY: never let mock numbers appear without this label.
 */
export function DemoDataBadge({ label = "Demo Data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-wheat-200 px-2.5 py-0.5 text-xs font-semibold text-wheat-600">
      <span className="h-1.5 w-1.5 rounded-full bg-wheat-500" />
      {label}
    </span>
  );
}
