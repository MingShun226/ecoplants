/**
 * The card turn.
 *
 * A `template.tsx` remounts on every navigation within the group, which is what
 * makes this work: moving between `/login` and `/signup` replays the animation
 * on the form while the layout — and the artwork beside it — stays put. Only
 * one panel changes. They remain separate routes, so the back button and a
 * pasted link both behave.
 *
 * Deliberately a CSS class and not a motion component. A JS entrance animation
 * starting at opacity 0 leaves the form **invisible until the bundle hydrates**,
 * and a login screen that depends on JavaScript to become visible is a login
 * screen that fails closed. `.card-turn` runs from the stylesheet, and the
 * reduced-motion rule beside it removes the rotation for anyone who asked.
 *
 * A true two-sided flip would need both faces mounted at once — one component
 * holding both forms, and no separate URLs. This turns the face in on its Y
 * axis against the perspective set by the layout, which reads the same way.
 */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <div className="card-turn">{children}</div>;
}
