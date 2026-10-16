import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getEquippedTitle, type TitleRow } from '../lib/gamification';

/** Map animation trong DB -> class CSS. */
export function titleAnimClass(animation: string): string {
  if (animation === 'neon') return 'title-neon';
  if (animation === 'shine') return 'title-shine';
  if (animation === 'blink') return 'title-blink';
  return '';
}

/** Style inline cho danh hiệu (neon dùng biến --neon cho glow). */
export function titleStyle(t: { color: string; glow: string; animation: string }): CSSProperties {
  if (t.animation === 'neon') {
    return { color: t.color, '--neon': t.glow } as CSSProperties;
  }
  return { color: t.color, textShadow: `0 0 8px ${t.glow}, 0 0 20px ${t.glow}` };
}

/** Hiển thị danh hiệu đang đeo của user — chữ neon nhấp nháy dưới avatar. */
export default function UserTitle({
  userId,
  className = '',
}: {
  userId: string;
  className?: string;
}) {
  const [title, setTitle] = useState<TitleRow | null>(null);

  useEffect(() => {
    let alive = true;
    getEquippedTitle(userId).then((t) => {
      if (alive) setTitle(t);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!title) return null;
  return (
    <span
      className={`user-title ${titleAnimClass(title.animation)} ${className}`}
      style={titleStyle(title)}
      title={title.name}
    >
      {title.name}
    </span>
  );
}
