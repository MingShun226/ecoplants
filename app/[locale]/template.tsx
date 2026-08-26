/**
 * Route transition.
 *
 * A `template` rather than a layout: Next remounts templates on every
 * navigation, so the enter animation replays without any router plumbing, while
 * the surrounding layout — header, footer, scroll handling — stays mounted and
 * does not flash.
 *
 * The animation itself is a CSS keyframe (`.page-enter`), so no client
 * JavaScript ships for it and a failed bundle cannot leave the page invisible.
 */
export default function LocaleTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}
