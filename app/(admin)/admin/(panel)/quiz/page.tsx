import type { Metadata } from "next";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { listQuizResponses } from "@/lib/admin/people";
import { formatWhen } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Quiz answers" };

export default async function QuizPage() {
  const responses = await listQuizResponses();

  // Which answer each question got, across every response. This is the whole
  // point of storing them: "most people say low light" is a merchandising
  // decision, where any single response is just a person.
  const tallies = new Map<string, Map<string, number>>();
  for (const r of responses) {
    for (const [question, answer] of Object.entries(r.answers)) {
      const value = Array.isArray(answer) ? answer.join(", ") : String(answer);
      const byAnswer = tallies.get(question) ?? new Map<string, number>();
      byAnswer.set(value, (byAnswer.get(value) ?? 0) + 1);
      tallies.set(question, byAnswer);
    }
  }

  const byLocale = responses.reduce<Record<string, number>>((acc, r) => {
    acc[r.locale] = (acc[r.locale] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AdminPage
      title="Quiz answers"
      lead="What people tell the plant finder about their home. Zero-party data — they volunteered it, so it can be used without guessing."
    >
      {responses.length === 0 ? (
        <AdminCard>
          <p className="py-10 text-center text-sm text-text-tertiary">
            Nobody has finished the quiz yet. Responses are written as soon as someone
            does — no account needed, they are keyed by session.
          </p>
        </AdminCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Responses" value={String(responses.length)} />
            <Stat
              label="Languages"
              value={Object.entries(byLocale)
                .map(([l, n]) => `${l} ${n}`)
                .join(" · ")}
            />
            <Stat label="Most recent" value={formatWhen(responses[0].createdAt)} />
          </div>

          <AdminCard
            title="What people say"
            lead="Every answer, counted. The shape of demand, not individual people."
          >
            <div className="flex flex-col gap-5">
              {[...tallies.entries()].map(([question, answers]) => {
                const total = [...answers.values()].reduce((a, b) => a + b, 0);
                return (
                  <div key={question} className="flex flex-col gap-2">
                    <p className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
                      {question}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {[...answers.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([answer, n]) => (
                          <li key={answer} className="flex items-center gap-3">
                            <span className="w-40 shrink-0 truncate text-[13px]">{answer}</span>
                            <span
                              className="h-1.5 rounded-full bg-ink-950"
                              style={{ width: `${Math.max(2, (n / total) * 100)}%` }}
                              aria-hidden="true"
                            />
                            <span className="numeric shrink-0 text-[11px] text-text-tertiary">
                              {n}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </AdminCard>

          <AdminCard title="Recent responses" flush>
            <ul className="divide-y divide-border-subtle">
              {responses.slice(0, 40).map((r) => (
                <li key={r.id} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3">
                  <span className="numeric w-20 shrink-0 text-[11px] text-text-tertiary">
                    {formatWhen(r.createdAt)}
                  </span>
                  <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary">
                    {r.locale}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-text-secondary">
                    {Object.entries(r.answers)
                      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                      .join(" · ")}
                  </span>
                  <span className="numeric shrink-0 text-[11px] text-text-tertiary">
                    {r.recommendedIds.length} suggested
                  </span>
                </li>
              ))}
            </ul>
          </AdminCard>
        </>
      )}
    </AdminPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface px-5 py-4">
      <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">{label}</span>
      <span className="text-lg tracking-tight">{value}</span>
    </div>
  );
}
