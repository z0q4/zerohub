import type { ReactNode } from 'react';

type IconName = 'location' | 'plus' | 'minus' | 'target' | 'play' | 'pause' | 'layers' | 'marker' | 'intelligence';

const paths: Record<IconName, ReactNode> = {
  location: <><circle cx="12" cy="12" r="7" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /><circle cx="12" cy="12" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  play: <path d="m8 5 11 7-11 7z" />,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
  marker: <><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
  intelligence: <><circle cx="12" cy="12" r="8" /><path d="M12 7v10M7 12h10" /><circle cx="12" cy="12" r="2" /></>,
};

export function WorkspaceIcon({ name }: { name: IconName }) {
  return <svg className="workspaceIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
