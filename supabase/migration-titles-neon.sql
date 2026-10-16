-- 28. Danh hiệu neon: mỗi cảnh giới một phong cách riêng + gắn danh hiệu vào thành tựu tu vi
-- 1. Thành tựu tu vi → nhận danh hiệu rank tương ứng khi bấm nhận thưởng
update public.achievements set reward_title_code = 'rank_1' where code = 'ach_rank_1';
update public.achievements set reward_title_code = 'rank_2' where code = 'ach_rank_2';
update public.achievements set reward_title_code = 'rank_3' where code = 'ach_rank_3';
update public.achievements set reward_title_code = 'rank_5' where code = 'ach_rank_5';
update public.achievements set reward_title_code = 'rank_7' where code = 'ach_rank_7';
update public.achievements set reward_title_code = 'rank_9' where code = 'ach_rank_9';
update public.achievements set reward_title_code = 'rank_14' where code = 'ach_rank_14';

-- 2. Đổi toàn bộ danh hiệu sang phong cách neon (mỗi cảnh giới một màu riêng)
update public.titles set color = '#7dff9b', glow = '#22ff66', animation = 'neon' where code = 'rank_0';
update public.titles set color = '#ffb37d', glow = '#ff6a2a', animation = 'neon' where code = 'rank_1';
update public.titles set color = '#8ef4ff', glow = '#22d8ff', animation = 'neon' where code = 'rank_2';
update public.titles set color = '#ffe97d', glow = '#ffd62e', animation = 'neon' where code = 'rank_3';
update public.titles set color = '#cfa8ff', glow = '#a06bff', animation = 'neon' where code = 'rank_4';
update public.titles set color = '#e2a8ff', glow = '#c44fff', animation = 'neon' where code = 'rank_5';
update public.titles set color = '#ffa8ec', glow = '#ff4fd8', animation = 'neon' where code = 'rank_6';
update public.titles set color = '#ff9ed2', glow = '#ff5fb0', animation = 'neon' where code = 'rank_7';
update public.titles set color = '#ffa8b8', glow = '#ff5c8a', animation = 'neon' where code = 'rank_8';
update public.titles set color = '#ff8d9e', glow = '#ff2e4d', animation = 'neon' where code = 'rank_9';
update public.titles set color = '#ffd28d', glow = '#ff9e2e', animation = 'neon' where code = 'rank_10';
update public.titles set color = '#fff89e', glow = '#ffe82e', animation = 'neon' where code = 'rank_11';
update public.titles set color = '#e4ff8d', glow = '#b8ff2e', animation = 'neon' where code = 'rank_12';
update public.titles set color = '#a8fbff', glow = '#4de8ff', animation = 'neon' where code = 'rank_13';
update public.titles set color = '#fffbd6', glow = '#ffdf5e', animation = 'neon' where code = 'rank_14';
update public.titles set color = '#d0a8ff', glow = '#9a5cff', animation = 'neon' where code = 'title_thu_thanh';
update public.titles set color = '#ffe97d', glow = '#ffb82e', animation = 'neon' where code = 'title_phu_giap';
update public.titles set color = '#ffb8d9', glow = '#ff5fa2', animation = 'neon' where code = 'title_thuy_chung';

-- 3. Trao bù danh hiệu cho những ai đã nhận thưởng thành tựu từ trước
insert into public.user_titles (user_id, title_id)
select distinct ua.user_id, t.id
from public.user_achievements ua
join public.achievements a on a.id = ua.achievement_id
join public.titles t on t.code = a.reward_title_code
where ua.claimed = true and a.reward_title_code is not null
on conflict do nothing;

-- 4. Ai có danh hiệu mà chưa đeo cái nào → tự đeo cái mới nhận nhất
update public.user_titles ut set equipped = true
from (
  select distinct on (user_id) user_id, title_id
  from public.user_titles
  order by user_id, earned_at desc
) latest
where ut.user_id = latest.user_id
  and ut.title_id = latest.title_id
  and not exists (
    select 1 from public.user_titles e
    where e.user_id = ut.user_id and e.equipped = true
  );
