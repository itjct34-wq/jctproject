/*
# Seed Japan auction houses (by export port) + NA/Caribbean freight rates Nov 2026

Auction houses -> public.suppliers (supplier_type = auction_house).
  city = export port; category = port:<port>;mode:<container_only|roro_container>.
  Only NS KYUSHU houses are container_only; all other ports are roro_container (both).
Freight rates -> public.system_config key freight_rates (structured JSON lookup).
Also merges destination countries into freight_destinations and expands ports_of_loading.
Idempotent: updates existing auction houses by case-insensitive name; inserts missing.
*/

DO $$
DECLARE
  seed_user uuid;
  h record;
  existing_dest jsonb;
  merged_dest text[];
  new_dest text[] := ARRAY[
    'Barbados', 'Antigua & Barbuda', 'Sint Maarten', 'Aruba', 'Curaçao', 'Puerto Rico', 'St. Kitts', 'Grenada', 'St. Lucia', 'Dominica', 'St. Vincent', 'Dominican Republic', 'United States', 'Jamaica', 'Cayman Islands', 'Suriname', 'Guyana', 'Trinidad and Tobago', 'Bahamas'
  ];
  shipping jsonb;
BEGIN
  SELECT id INTO seed_user FROM auth.users ORDER BY created_at ASC NULLS LAST LIMIT 1;
  IF seed_user IS NULL THEN
    RAISE EXCEPTION 'Cannot seed auction houses: no auth.users row available for created_by';
  END IF;

  FOR h IN
    SELECT * FROM (VALUES
      ('HONDA TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('HONDA SENDAI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('HONDA HOKKAIDO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('CAA TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('CAA TOHOKU', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ARAI SENDAI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU SAITAMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU AOMORI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('SAA SAPPORO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ORIX SENDAI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NPA TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NPS TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NPS SENDAI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NPS TOCHIGI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('HERO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('IMA TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU IBARAKI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('MIRIVE SAITAMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU AKITA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ORIX ATSUGI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('LUM TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA KANTOU', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA TOHOKU', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA HOKKAIDO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ARAI OYAMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU FUKUSHIMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU GUNMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU KANAGAWA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('LUM HOKKAIDO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU MIYAGI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU CHIBA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU NIIGATA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU TOCHIGI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU HOKKAIDO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ARAI BAYSIDE', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NAA TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZERO HOKKAIDO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZERO SENDAI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZERO CHIBA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU YAMANASHI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ARAI OYAMA VT', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA YOKOHAMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZIP TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS SAPPORO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS TOHOKU', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS GUMMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS TOKYO', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS JAA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS SAITAMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS YOKOHAMA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS NIIGATA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('AUCNET', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('YANASE AUCNET', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NPS TOMAKOMAI', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU OKINAWA', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU SHIMANE', 'Yokohama', 'port:yokohama;mode:roro_container', 'RORO and container OK. Export port: Yokohama. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('HONDA KANSAI', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('HONDA NAGOYA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('CAA GIFU', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU MIE', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU FUKUI', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NPS GIFU', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('LUM NAGOYA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('CAA CHUBU', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS NAGOYA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS R-NAGOYA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS OKAYAMA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA CHUBU', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NAA NAGOYA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU TOYAMA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZERO CHUBU', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('MIRAIVE AICHI', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU GIFU', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS SHIZUOKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU SHIZUOKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NAA OSAKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('NPS OSAKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS OSAKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZIP OSAKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZERO OSAKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('LAA OKAYAMA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU AICHI', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('SAA HAMAMATSU', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU NAGOYA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU ISHIKAWA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('IAA OSAKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('MIRIVE OSAKA', 'Nagoya', 'port:nagoya;mode:roro_container', 'RORO and container OK. Export port: Nagoya. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA KINKI', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA HIROSHIMA', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA SHIKOKU', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ORIX KOBE', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('BAYAUC', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('KCAA KYOTO', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS KOBE', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS HAA KOBE', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('LUM KOBE', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('ZERO SHONAN', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('IMA KOBE', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU NARA', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('TAA HYOGO', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('USS HOKURIKU', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU YAMAGUCHI', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('LAA SHIKOKU', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU KUMAMOTO', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU OITA', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU HIROSHIMA', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('KCAA YAMAGATA', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('JU YAMAGATA', 'Kobe', 'port:kobe;mode:roro_container', 'RORO and container OK. Export port: Kobe. Always verify exact vehicle location before bidding. Source: Japan auction houses by port.'),
      ('HONDA KYUSHU', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('TAA KYUSHU', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('TAA M-KYUSHU', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('NAA FUKUOKA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('ORIX FUKUOKA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('NPS FUKUOKA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('LUM FUKUOKA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('KCAA M-KYUSHU', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('JU NAGASAKI', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('USS FUKUOKA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('KCAA FUKUOKA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('JU MIYAZAKI', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('IMA KYUSHU', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('JU FUKUOKA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('USS KYUSHU', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).'),
      ('ZERO HAKATA', 'Hakata (NS Kyushu)', 'port:ns_kyushu;mode:container_only', 'CONTAINER ONLY — FOR RORO DON''T BUY. Buy only for container shipment. Export port: Hakata (NS Kyushu). Always verify exact vehicle location before bidding. Source: Japan auction houses by port (NS KYUSHU group).')
    ) AS t(name, city, category, notes)
  LOOP
    UPDATE public.suppliers s
    SET
      city = h.city,
      country = COALESCE(NULLIF(s.country, ''), 'Japan'),
      category = h.category,
      notes = h.notes,
      status = CASE WHEN s.status = 'blocked' THEN s.status ELSE 'active' END,
      updated_at = now()
    WHERE s.supplier_type = 'auction_house'
      AND lower(s.name) = lower(h.name);

    IF NOT FOUND THEN
      INSERT INTO public.suppliers (
        supplier_type, name, city, country, category, notes, status, default_currency, created_by
      ) VALUES (
        'auction_house', h.name, h.city, 'Japan', h.category, h.notes, 'active', 'JPY', seed_user
      );
    END IF;
  END LOOP;

  INSERT INTO public.system_config (key, value, description, updated_at)
  VALUES (
    'freight_rates',
    $freightjson${"title": "North America & Caribbean Freight Rate Revision", "effective_from": "2026-11-01", "currency": "USD", "unit": "US$/M3", "cargo": "USED VEHICLES", "source": "AutoGrand Corporation Tokyo (2026/10/07)", "surcharges": {"baf_usd_per_m3": 20, "baf_period": "2026 Q4 (October-December)", "pcs_usd_per_m3": 6, "ets_usd_per_m3": 3.93, "ets_applies_to": ["Sint Maarten", "Aruba", "Curacao"]}, "notes": ["All rates apply to USED VEHICLES only. Bill of Lading surface must always be marked USED VEHICLE.", "Rates are effective from November sailings onward.", "BAF is valid for 2026 Q4 (October-December). Subject to quarterly review.", "ETS surcharge applies exclusively to Sint Maarten, Aruba, and Curacao."], "rates": [{"region": "Barbados", "port": "Bridgetown", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 220.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Barbados", "port": "Bridgetown", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 290.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Antigua & Barbuda", "port": "St. John's", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Antigua & Barbuda", "port": "St. John's", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Sint Maarten", "port": "Philipsburg", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": 3.93, "notes": "ETS applicable"}, {"region": "Sint Maarten", "port": "Philipsburg", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": 3.93, "notes": "ETS applicable"}, {"region": "Aruba", "port": "Oranjestad", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": 3.93, "notes": "ETS applicable"}, {"region": "Aruba", "port": "Oranjestad", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": 3.93, "notes": "ETS applicable"}, {"region": "Curaçao", "port": "Willemstad", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": 3.93, "notes": "ETS applicable"}, {"region": "Curaçao", "port": "Willemstad", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": 3.93, "notes": "ETS applicable"}, {"region": "Puerto Rico", "port": "San Juan", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Puerto Rico", "port": "San Juan", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "St. Kitts", "port": "Basseterre", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "St. Kitts", "port": "Basseterre", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Grenada", "port": "St. George's", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Grenada", "port": "St. George's", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "St. Lucia", "port": "Castries", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "St. Lucia", "port": "Castries", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Dominica", "port": "Roseau", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Dominica", "port": "Roseau", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "St. Vincent", "port": "Kingstown", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "St. Vincent", "port": "Kingstown", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Dominican Republic", "port": "Santo Domingo", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 190.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Dominican Republic", "port": "Santo Domingo", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "US East Coast", "port": "Jacksonville / Baltimore", "height_category": "Up to 2.14 m", "base_rate_usd_per_m3": 185.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$40/M³ increase"}, {"region": "US East Coast", "port": "Jacksonville / Baltimore", "height_category": "2.15 m - 2.74 m", "base_rate_usd_per_m3": 260.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$40/M³ increase"}, {"region": "US East Coast", "port": "Jacksonville / Baltimore", "height_category": "2.75 m and over", "base_rate_usd_per_m3": 270.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$40/M³ increase"}, {"region": "US Gulf", "port": "Freeport", "height_category": "Up to 2.14 m", "base_rate_usd_per_m3": 185.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$40/M³ increase"}, {"region": "US Gulf", "port": "Freeport", "height_category": "2.15 m - 2.74 m", "base_rate_usd_per_m3": 260.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$40/M³ increase"}, {"region": "US Gulf", "port": "Freeport", "height_category": "2.75 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$40/M³ increase"}, {"region": "Jamaica", "port": "Kingston", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 147.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$15/M³ increase"}, {"region": "Jamaica", "port": "Kingston", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 195.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$15/M³ increase"}, {"region": "Grand Cayman", "port": "Georgetown", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 250.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$30/M³ increase"}, {"region": "Grand Cayman", "port": "Georgetown", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 350.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": "+US$30/M³ increase"}, {"region": "Suriname", "port": "Paramaribo", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 210.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Suriname", "port": "Paramaribo", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Guyana", "port": "Georgetown", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 210.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Guyana", "port": "Georgetown", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Trinidad and Tobago", "port": "Port of Spain", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 180.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Trinidad and Tobago", "port": "Port of Spain", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Bahamas", "port": "Nassau", "height_category": "Up to 2.29 m", "base_rate_usd_per_m3": 185.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}, {"region": "Bahamas", "port": "Nassau", "height_category": "2.30 m and over", "base_rate_usd_per_m3": 280.0, "baf_usd_per_m3": 20.0, "pcs_usd_per_m3": 6.0, "ets_usd_per_m3": null, "notes": null}]}$freightjson$::jsonb,
    'North America & Caribbean used-vehicle freight rates (USD/M3) for admin lookup when quoting/invoicing. Source AutoGrand Nov 2026 sailings.',
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

  SELECT value INTO existing_dest FROM public.system_config WHERE key = 'freight_destinations';
  IF existing_dest IS NULL THEN
    merged_dest := new_dest;
  ELSIF jsonb_typeof(existing_dest) = 'array' THEN
    SELECT array_agg(x ORDER BY ord) INTO merged_dest FROM (
      SELECT value AS x, min(ord) AS ord FROM (
        SELECT elem AS value, ord FROM jsonb_array_elements_text(existing_dest) WITH ORDINALITY AS t(elem, ord)
        UNION ALL
        SELECT unnest(new_dest), 1000 + generate_subscripts(new_dest, 1)
      ) u
      GROUP BY lower(value), value
    ) d;
  ELSIF existing_dest ? 'countries' THEN
    SELECT array_agg(x ORDER BY ord) INTO merged_dest FROM (
      SELECT value AS x, min(ord) AS ord FROM (
        SELECT elem AS value, ord FROM jsonb_array_elements_text(existing_dest->'countries') WITH ORDINALITY AS t(elem, ord)
        UNION ALL
        SELECT unnest(new_dest), 1000 + generate_subscripts(new_dest, 1)
      ) u
      GROUP BY lower(value), value
    ) d;
  ELSE
    merged_dest := new_dest;
  END IF;

  INSERT INTO public.system_config (key, value, description, updated_at)
  VALUES (
    'freight_destinations',
    jsonb_build_object('countries', to_jsonb(merged_dest)),
    'Selectable export destination countries; super-admin configurable',
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    value = jsonb_build_object('countries', to_jsonb(merged_dest)),
    updated_at = now();

  SELECT value INTO shipping FROM public.system_config WHERE key = 'shipping_options';
  IF shipping IS NULL THEN
    shipping := '{}'::jsonb;
  END IF;
  shipping := jsonb_set(
    shipping,
    '{ports_of_loading}',
    (
      SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY ord), '[]'::jsonb)
      FROM (
        SELECT p, min(ord) AS ord FROM (
          SELECT elem AS p, ord
          FROM jsonb_array_elements_text(COALESCE(shipping->'ports_of_loading', '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
          UNION ALL
          SELECT * FROM (VALUES
            ('Nagoya, Japan', 1001),
            ('Yokohama, Japan', 1002),
            ('Kobe, Japan', 1003),
            ('Hakata (NS Kyushu), Japan', 1004)
          ) v(p, ord)
        ) u GROUP BY lower(p), p
      ) d
    ),
    true
  );
  INSERT INTO public.system_config (key, value, description, updated_at)
  VALUES ('shipping_options', shipping, 'Shipping methods, incoterms, and ports of loading', now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;
