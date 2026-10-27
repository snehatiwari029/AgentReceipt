export default function Placeholder({ title, comesWith }: { title: string; comesWith: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-dash-ink">{title}</h1>
      <div className="mt-6 max-w-md rounded-xl border border-dash-edge bg-dash-card p-5">
        <p className="font-semibold text-dash-ink">Not built yet.</p>
        <p className="mt-2 text-sm text-dash-body">{comesWith}</p>
      </div>
    </div>
  )
}
