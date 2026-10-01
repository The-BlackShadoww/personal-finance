/** A small labelled figure with an optional note, for the wealth views. */
export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="card flex min-h-[128px] flex-col justify-between p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <div>
        <p className="num text-[24px] leading-none tracking-[-0.03em]">{value}</p>
        {note ? <p className="mt-2 text-[12px] text-muted">{note}</p> : null}
      </div>
    </article>
  );
}
