-- 26. Gamification: nhiệm vụ / thành tựu / danh hiệu -------------------------------
-- 26a. titles: danh hiệu
create table if not exists public.titles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  color text not null default '#fbbf24',
  glow text not null default '#f59e0b',
  animation text not null default 'blink', -- blink | shine | none
  created_from text not null default 'achievement', -- rank | achievement
  is_active boolean not null default true
);
alter table public.titles enable row level security;
drop policy if exists titles_public_read on public.titles;
create policy titles_public_read on public.titles for select using (true);
drop policy if exists titles_admin_all on public.titles;
create policy titles_admin_all on public.titles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.titles to anon;
grant all on public.titles to authenticated;

-- 26b. user_titles: danh hiệu đã nhận
create table if not exists public.user_titles (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  earned_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (user_id, title_id)
);
alter table public.user_titles enable row level security;
drop policy if exists user_titles_owner on public.user_titles;
create policy user_titles_owner on public.user_titles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists user_titles_public_equipped on public.user_titles;
create policy user_titles_public_equipped on public.user_titles
  for select using (equipped = true);
grant select on public.user_titles to anon;
grant all on public.user_titles to authenticated;

-- 26c. quests: định nghĩa nhiệm vụ
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  period text not null, -- daily | weekly | monthly
  target_type text not null,
  target_value int not null,
  reward_stones int not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0
);
alter table public.quests enable row level security;
drop policy if exists quests_public_read on public.quests;
create policy quests_public_read on public.quests for select using (true);
drop policy if exists quests_admin_all on public.quests;
create policy quests_admin_all on public.quests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.quests to anon;
grant all on public.quests to authenticated;

-- 26d. quest_progress: tiến độ nhiệm vụ của user
create table if not exists public.quest_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  period_key text not null,
  progress int not null default 0,
  completed boolean not null default false,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id, period_key)
);
alter table public.quest_progress enable row level security;
drop policy if exists quest_progress_owner on public.quest_progress;
create policy quest_progress_owner on public.quest_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant all on public.quest_progress to authenticated;

-- 26e. achievements: định nghĩa thành tựu
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  category text not null default 'reading',
  target_type text not null,
  target_value int not null,
  reward_stones int not null default 0,
  reward_title_code text,
  icon text not null default '🏅',
  is_active boolean not null default true
);
alter table public.achievements enable row level security;
drop policy if exists achievements_public_read on public.achievements;
create policy achievements_public_read on public.achievements for select using (true);
drop policy if exists achievements_admin_all on public.achievements;
create policy achievements_admin_all on public.achievements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.achievements to anon;
grant all on public.achievements to authenticated;

-- 26f. user_achievements: thành tựu của user
create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  progress int not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  claimed boolean not null default false,
  primary key (user_id, achievement_id)
);
alter table public.user_achievements enable row level security;
drop policy if exists user_achievements_owner on public.user_achievements;
create policy user_achievements_owner on public.user_achievements
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant all on public.user_achievements to authenticated;

-- 26g. profiles: thêm cột streak
alter table public.profiles add column if not exists last_active_date date;
alter table public.profiles add column if not exists login_streak int not null default 0;

-- 26h. Seed danh hiệu
insert into public.titles (code, name, color, glow, animation, created_from) values
  ('rank_0','🌱 Phàm Trần Khách','#7dff9b','#22ff66','neon','rank'),
  ('rank_1','🔥 Luyện Khí Tu Sĩ','#ffb37d','#ff6a2a','neon','rank'),
  ('rank_2','🪨 Trúc Cơ Chân Nhân','#8ef4ff','#22d8ff','neon','rank'),
  ('rank_3','⚡ Kim Đan Lão Tổ','#ffe97d','#ffd62e','neon','rank'),
  ('rank_4','👶 Nguyên Anh Thánh Tử','#cfa8ff','#a06bff','neon','rank'),
  ('rank_5','🌩️ Hóa Thần Đại Năng','#e2a8ff','#c44fff','neon','rank'),
  ('rank_6','🌀 Luyện Hư Tôn Giả','#ffa8ec','#ff4fd8','neon','rank'),
  ('rank_7','🌌 Hợp Thể Thánh Quân','#ff9ed2','#ff5fb0','neon','rank'),
  ('rank_8','☁️ Đại Thừa Tiên Ông','#ffa8b8','#ff5c8a','neon','rank'),
  ('rank_9','💥 Độ Kiếp Thiên Tôn','#ff8d9e','#ff2e4d','neon','rank'),
  ('rank_10','🏔️ Địa Tiên','#ffd28d','#ff9e2e','neon','rank'),
  ('rank_11','☀️ Thiên Tiên','#fff89e','#ffe82e','neon','rank'),
  ('rank_12','✨ Kim Tiên','#e4ff8d','#b8ff2e','neon','rank'),
  ('rank_13','🌟 Đại La Kim Tiên','#a8fbff','#4de8ff','neon','rank'),
  ('rank_14','👑 Thánh Nhân Vô Thượng','#fffbd6','#ffdf5e','neon','rank'),
  ('title_thu_thanh','📚 Thư Thánh','#d0a8ff','#9a5cff','neon','achievement'),
  ('title_phu_giap','💰 Phú Giáp Thiên Hạ','#ffe97d','#ffb82e','neon','achievement'),
  ('title_thuy_chung','🏵️ Thủy Chung Bất Dụ','#ffb8d9','#ff5fa2','neon','achievement')
on conflict (code) do nothing;

-- 26i. Seed nhiệm vụ
insert into public.quests (code, name, description, period, target_type, target_value, reward_stones, sort_order) values
  ('q_daily_read300','Điểm Danh Tu Luyện','Đọc truyện 5 phút trong ngày', 'daily','read_seconds',300,5,1),
  ('q_daily_read1800','Chăm Chỉ Tu Luyện','Đọc truyện 30 phút trong ngày','daily','read_seconds',1800,12,2),
  ('q_daily_read7200','Bế Quan Tu Luyện','Đọc truyện 2 giờ trong ngày','daily','read_seconds',7200,30,3),
  ('q_daily_ch20','Mọt Sách Mỗi Ngày','Đọc 20 chương trong ngày','daily','read_chapters',20,20,4),
  ('q_weekly_read36000','Tuần Chăm Chỉ','Đọc truyện 10 giờ trong tuần','weekly','read_seconds',36000,120,1),
  ('q_weekly_ch100','Cày Chương','Đọc 100 chương trong tuần','weekly','read_chapters',100,150,2),
  ('q_weekly_daily5','Kỷ Luật Sắt','Nhận thưởng 5 nhiệm vụ ngày trong tuần','weekly','daily_quests_done',5,100,3),
  ('q_weekly_stones500','Tích Tiểu Thành Đại','Kiếm 500 linh thạch trong tuần','weekly','stones_earned',500,120,4),
  ('q_monthly_read144000','Bế Quan Tháng','Đọc truyện 40 giờ trong tháng','monthly','read_seconds',144000,500,1),
  ('q_monthly_ch400','Cuồng Đọc','Đọc 400 chương trong tháng','monthly','read_chapters',400,600,2),
  ('q_monthly_ach3','Danh Vọng','Mở khóa 3 thành tựu trong tháng','monthly','achievements_unlocked',3,400,3)
on conflict (code) do nothing;

-- 26j. Seed thành tựu
insert into public.achievements (code, name, description, category, target_type, target_value, reward_stones, reward_title_code, icon) values
  ('ach_ch1','Bước Đầu Tiên','Đọc chương truyện đầu tiên','reading','read_chapters',1,10,null,'🌱'),
  ('ach_ch100','Mọt Sách Sơ Cấp','Đọc 100 chương truyện','reading','read_chapters',100,50,null,'📖'),
  ('ach_ch500','Mọt Sách Trung Cấp','Đọc 500 chương truyện','reading','read_chapters',500,150,null,'📚'),
  ('ach_ch1000','Mọt Sách Cao Cấp','Đọc 1000 chương truyện','reading','read_chapters',1000,300,null,'📚'),
  ('ach_ch5000','Thư Thánh','Đọc 5000 chương truyện','reading','read_chapters',5000,800,'title_thu_thanh','🏆'),
  ('ach_novels_5','Thư Hải Du Long','Đọc 5 bộ truyện khác nhau','reading','novels_read',5,60,null,'🐉'),
  ('ach_novels_20','Bác Lãm Quần Thư','Đọc 20 bộ truyện khác nhau','reading','novels_read',20,200,null,'🐉'),
  ('ach_night','Cú Đêm Tu Luyện','Đọc 10 chương vào lúc 0–5h sáng','reading','night_reads',10,80,null,'🦉'),
  ('ach_rank_1','Trúc Cơ Thành Công','Đạt cảnh giới Luyện Khí','cultivation','rank_index',1,30,'rank_1','🌱'),
  ('ach_rank_2','Kim Đan Đại Thành','Đạt cảnh giới Trúc Cơ','cultivation','rank_index',2,60,'rank_2','🔥'),
  ('ach_rank_3','Nguyên Anh Xuất Thế','Đạt cảnh giới Kim Đan','cultivation','rank_index',3,120,'rank_3','👶'),
  ('ach_rank_5','Hóa Thần Phi Thăng','Đạt cảnh giới Hóa Thần','cultivation','rank_index',5,250,'rank_5','🌩️'),
  ('ach_rank_7','Hợp Thể Vô Địch','Đạt cảnh giới Hợp Thể','cultivation','rank_index',7,400,'rank_7','🌌'),
  ('ach_rank_9','Độ Kiếp Phi Thăng','Đạt cảnh giới Độ Kiếp','cultivation','rank_index',9,700,'rank_9','💥'),
  ('ach_rank_14','Thánh Nhân Vô Thượng','Đạt cảnh giới Thánh Nhân','cultivation','rank_index',14,2000,'rank_14','👑'),
  ('ach_stones_100','Tiểu Phú','Sở hữu 100 linh thạch cùng lúc','wealth','stones_owned_max',100,20,null,'💰'),
  ('ach_stones_1000','Trung Phú','Sở hữu 1000 linh thạch cùng lúc','wealth','stones_owned_max',1000,100,null,'💰'),
  ('ach_stones_10000','Phú Giáp Thiên Hạ','Sở hữu 10000 linh thạch cùng lúc','wealth','stones_owned_max',10000,500,'title_phu_giap','🏦'),
  ('ach_frame_1','Hữu Duyên','Sở hữu 1 khung avatar','collection','frames_owned',1,30,null,'🖼️'),
  ('ach_treasure_1','Tầm Bảo','Sở hữu 1 pháp bảo','collection','treasures_owned',1,30,null,'⚔️'),
  ('ach_frame_5','Khung Sưu Tầm Gia','Sở hữu 5 khung avatar','collection','frames_owned',5,150,null,'🖼️'),
  ('ach_treasure_5','Bảo Khố','Sở hữu 5 pháp bảo','collection','treasures_owned',5,150,null,'⚔️'),
  ('ach_streak_3','Kiên Trì','Đăng nhập 3 ngày liên tiếp','streak','login_streak',3,60,null,'🔥'),
  ('ach_streak_7','Bền Bỉ','Đăng nhập 7 ngày liên tiếp','streak','login_streak',7,180,null,'🔥'),
  ('ach_streak_30','Thủy Chung Bất Dụ','Đăng nhập 30 ngày liên tiếp','streak','login_streak',30,600,'title_thuy_chung','🏵️'),
  ('ach_bookshelf_1','Tàng Thư','Thêm 1 truyện vào tủ sách','explore','bookshelf_count',1,20,null,'🗄️'),
  ('ach_bookshelf_10','Tàng Kinh Các','Thêm 10 truyện vào tủ sách','explore','bookshelf_count',10,80,null,'🗄️'),
  ('ach_avatar','Diện Mạo Mới','Đặt avatar cá nhân','explore','avatar_set',1,10,null,'📷'),
  ('ach_quest_10','Nhiệm Vụ Đại Sư','Nhận thưởng 10 nhiệm vụ bất kỳ','explore','quests_claimed',10,150,null,'🎯'),
  ('ach_stones_earned_1000','Tích Tiểu Thành Đại','Kiếm tổng cộng 1000 linh thạch','wealth','stones_earned',1000,150,null,'💎')
on conflict (code) do nothing;
