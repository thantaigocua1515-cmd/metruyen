import type { EquippedItem } from '../lib/equipped';

interface Props {
  src?: string | null;
  frame?: EquippedItem | null;
  treasure?: EquippedItem | null;
  size?: number;
  username?: string;
}

/** Avatar + khung viền overlay (scale/offset theo item) + pháp bảo góc. */
export default function AvatarWithFrame({ src, frame, treasure, size = 96, username }: Props) {
  const initial = (username ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={username ?? 'avatar'}
          className="h-full w-full rounded-full object-cover ring-2 ring-amber-500/60 dark:ring-amber-400/50"
          draggable={false}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 font-display text-white ring-2 ring-amber-500/60"
          style={{ fontSize: size * 0.42 }}
        >
          {initial}
        </div>
      )}
      {frame && (
        <img
          src={frame.image_url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
          style={{
            width: size * frame.scale,
            height: size * frame.scale,
            transform: `translate(calc(-50% + ${frame.offset_x}px), calc(-50% + ${frame.offset_y}px))`,
          }}
        />
      )}
      {treasure && (
        <img
          src={treasure.image_url}
          alt=""
          draggable={false}
          title="Pháp bảo"
          className="absolute rounded-full border-2 border-amber-300 bg-white object-cover shadow"
          style={{
            width: size * 0.44,
            height: size * 0.44,
            right: -size * 0.08,
            bottom: -size * 0.08,
          }}
        />
      )}
    </div>
  );
}
