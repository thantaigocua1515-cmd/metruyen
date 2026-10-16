import { useEffect, useState } from 'react';
import { getEquippedTitle, type TitleRow } from '../lib/gamification';

/** Hiển thị danh hiệu đang đeo của user — chữ nhấp nháy phát sáng dưới avatar. */
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
  const anim = title.animation === 'shine' ? 'title-shine' : title.animation === 'blink' ? 'title-blink' : '';
  return (
    <span
      className={`user-title ${anim} ${className}`}
      style={{ color: title.color, textShadow: `0 0 8px ${title.glow}, 0 0 20px ${title.glow}` }}
      title={title.name}
    >
      {title.name}
    </span>
  );
}
