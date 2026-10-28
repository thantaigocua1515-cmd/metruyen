import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { fetchNovels } from './novelApi';
import type { ApiSourceRow, NovelSummary } from './novelApi';
import { syncedRowToSummary } from './library';
import type { SyncedNovelRow } from './library';

export const DEMO_NOVELS: NovelSummary[] = [
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'pham-nhan-tu-tien',
    title: 'Phàm Nhân Tu Tiên',
    author: 'Vong Ngữ',
    description: 'Một thiếu niên bình phàm nơi sơn thôn, ngẫu nhiên bước vào tiên đạo, từng bước đạp vỡ trần duyên vấn đỉnh trường sinh.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 2450,
    translatedChaptersCount: 2450,
    status: 'completed',
    links: {},
  },
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'kiem-lai',
    title: 'Kiếm Lai',
    author: 'Phong Hỏa Hí Chư Hầu',
    description: 'Thế gian vạn vật đều có kiếm khí. Thiếu niên mang giày rơm từ Ly Châu động thiên, một kiếm chém mở cửu trọng thiên.',
    coverUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 1180,
    translatedChaptersCount: 1180,
    status: 'ongoing',
    links: {},
  },
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'quy-bi-chi-chu',
    title: 'Quỷ Bí Chi Chủ (Lord of Mysteries)',
    author: 'Ái Tiềm Thủy Đích Ô Tặc',
    description: 'Hơi nước cùng máy móc thủy triều, ma dược cùng chiêm bốc bí ẩn. Khởi đầu từ ánh sáng đỏ, chấp chưởng thần bí vực thẳm.',
    coverUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 1432,
    translatedChaptersCount: 1432,
    status: 'completed',
    links: {},
  },
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'tu-chan-lieu-thien-quan',
    title: 'Tu Chân Liêu Thiên Quần',
    author: 'Thánh Sách Thiếu Niên',
    description: 'Tống Thư Hàng vô tình bị thêm vào một nhóm chat tu chân, tưởng là cosplay nhưng hóa ra toàn bộ thành viên đều là Chân Quân đại năng!',
    coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 3170,
    translatedChaptersCount: 3170,
    status: 'completed',
    links: {},
  },
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'thon-phe-tinh-khong',
    title: 'Thôn Phệ Tinh Không',
    author: 'Ngã Cật Tây Hồng Thị',
    description: 'Địa cầu trải qua đại niết bàn, quái thú hoành hành. Thiếu niên La Phong bước ra vũ trụ vô tận, thôn phệ tinh hà.',
    coverUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 1480,
    translatedChaptersCount: 1480,
    status: 'completed',
    links: {},
  },
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'dai-phung-da-canh-nhan',
    title: 'Đại Phụng Đả Canh Nhân',
    author: 'Mại Báo Tiểu Lang Quân',
    description: 'Hứa Thất An tỉnh lại trong đại lao kinh thành, phá án kỳ án, làm rung chuyển triều đình, cứu rỗi vương triều Đại Phụng.',
    coverUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 980,
    translatedChaptersCount: 980,
    status: 'completed',
    links: {},
  },
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'tien-nghich',
    title: 'Tiên Nghịch',
    author: 'Nhĩ Căn',
    description: 'Thuận vi phàm, nghịch tắc tiên. Vương Lâm chỉ vì một lời thề báo thù, tu ma luyện sát, nghịch chuyển càn khôn sinh tử.',
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 2088,
    translatedChaptersCount: 2088,
    status: 'completed',
    links: {},
  },
  {
    sourceId: 'demo',
    sourceName: 'Thư Các',
    id: 'muc-than-ky',
    title: 'Mục Thần Ký',
    author: 'Trạch Trư',
    description: 'Đại Khư tàn lão thôn, hài đồng nhặt được lớn lên cùng chín vị tàn phế. Phá Thần Thể chi mê, mục dưỡng chư thần thiên địa.',
    coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80',
    chaptersCount: 1820,
    translatedChaptersCount: 1820,
    status: 'completed',
    links: {},
  },
];

/**
 * Hook dùng chung: tải truyện từ mọi nguồn API đang bật + thumbnail overrides.
 * Ưu tiên database đã đồng bộ (synced_novels); nguồn nào chưa sync thì
 * đọc live từ API như cũ. Dùng ở Home, Search, Genres để không lặp logic fetch.
 */
export function useNovels() {
  const [novels, setNovels] = useState<NovelSummary[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [syncedSourceIds, setSyncedSourceIds] = useState<string[]>([]);
  const [liveSourceIds, setLiveSourceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      // Nếu chưa cấu hình Supabase, tự động nạp Demo Novels để xem thử giao diện trọn vẹn
      if (!isSupabaseConfigured) {
        if (alive) {
          setNovels(DEMO_NOVELS);
          setLoading(false);
        }
        return;
      }

      try {
        const supabase = getSupabase();
        const { data: sources, error: sErr } = await supabase
          .from('api_sources')
          .select('id,name,openapi_url,base_url,is_active')
          .eq('is_active', true);
        if (sErr) throw sErr;
        const list = (sources ?? []) as ApiSourceRow[];

        // Truyện đã đồng bộ trong DB (bảng có thể chưa tồn tại nếu user chưa chạy migration → bỏ qua)
        const bySource = new Map<string, SyncedNovelRow[]>();
        try {
          const { data: synced } = await supabase.from('synced_novels').select('*');
          for (const r of (synced ?? []) as SyncedNovelRow[]) {
            const arr = bySource.get(r.source_id) ?? [];
            arr.push(r);
            bySource.set(r.source_id, arr);
          }
        } catch {
          /* chưa có bảng synced_novels → đọc live toàn bộ */
        }

        const all: NovelSummary[] = [];
        const syncedIds: string[] = [];
        const liveIds: string[] = [];
        for (const s of list) {
          const rows = bySource.get(s.id) ?? [];
          if (rows.length > 0) {
            // Ưu tiên DB
            all.push(...rows.map((r) => syncedRowToSummary(r, s.name)));
            syncedIds.push(s.id);
          } else {
            // Fallback: đọc live từ API
            try {
              const ns = await fetchNovels(s);
              all.push(...ns);
              liveIds.push(s.id);
            } catch {
              /* bỏ qua lỗi từng nguồn */
            }
          }
        }

        // Thumbnail overrides
        let ovMap: Record<string, string> = {};
        try {
          const { data: ovs } = await supabase
            .from('thumbnail_overrides')
            .select('source_id,novel_id,thumbnail_url');
          if (ovs) {
            ovMap = Object.fromEntries(
              (ovs as { source_id: string; novel_id: string; thumbnail_url: string }[]).map(
                (o) => [`${o.source_id}:${o.novel_id}`, o.thumbnail_url],
              ),
            );
          }
        } catch {
          /* bảng chưa tạo → bỏ qua */
        }

        if (alive) {
          setNovels(all.length > 0 ? all : DEMO_NOVELS);
          setOverrides(ovMap);
          setSyncedSourceIds(syncedIds);
          setLiveSourceIds(liveIds);
        }
      } catch {
        if (alive) {
          // Fallback về Demo Novels nếu DB có trục trặc để không làm gián đoạn trải nghiệm giao diện
          setNovels(DEMO_NOVELS);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { novels, overrides, syncedSourceIds, liveSourceIds, loading, error };
}
