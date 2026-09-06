alter table public.deals
  add column if not exists promotion_type text;

alter table public.deals
  drop constraint if exists deals_promotion_type_check;

alter table public.deals
  add constraint deals_promotion_type_check
  check (
    promotion_type is null or promotion_type in (
      'percentage_off', 'amount_off', 'buy_one_get_one', 'special_price',
      'happy_hour', 'bundle_combo', 'free_item', 'limited_time_deal',
      'member_loyalty', 'other'
    )
  );

create index if not exists deals_promotion_type_idx on public.deals(promotion_type);
