import { recentAudit } from "@/lib/moderation";
import { LocalTime } from "@/components/local-time";

export default async function AdminLog() {
  const rows = await recentAudit(200);
  return (
    <section className="panel overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-line text-left text-xs text-ink-3">
          <tr>
            <th className="px-5 py-3 font-medium">When</th>
            <th className="px-3 py-3 font-medium">Who</th>
            <th className="px-3 py-3 font-medium">Action</th>
            <th className="px-3 py-3 font-medium">Target</th>
            <th className="px-3 py-3 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-2 whitespace-nowrap text-ink-3">
                <LocalTime value={r.createdAt} />
              </td>
              <td className="px-3 py-2">{r.actorLogin}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.target ?? ""}</td>
              <td className="max-w-80 truncate px-3 py-2 font-mono text-xs text-ink-3">{r.detail ? JSON.stringify(r.detail) : ""}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-ink-3">
                No admin actions yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
