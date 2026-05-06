import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase';
import { buildCatalogFromMerch, type CapsuleStyleRow } from '@/lib/catalogAggregate';
import type { MerchLineRow } from '@/lib/catalogTypes';
import { CatalogData, BannerSlide } from '@/types/catalog';

async function fetchCatalogData(): Promise<CatalogData> {
  const sb = getSupabase();

  const [merchRes, capsRes, bannerRes, settingsRes] = await Promise.all([
    sb.from('merch_lines').select('*').order('product_id').order('size'),
    sb.from('catalog_capsules').select('name,color,prefix,outline,sort_order').order('sort_order').order('name'),
    sb.from('banner_slides').select('image_url,slide_text,sort_order').order('sort_order'),
    sb.from('site_settings').select('key,value'),
  ]);

  if (merchRes.error) throw new Error(merchRes.error.message);
  if (capsRes.error) throw new Error(capsRes.error.message);
  if (bannerRes.error) throw new Error(bannerRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);

  const rows = (merchRes.data || []) as MerchLineRow[];
  const capsuleStyles: CapsuleStyleRow[] = (capsRes.data || []).map((r: Record<string, unknown>) => ({
    name: String(r.name || ''),
    color: String(r.color || '#0047BB'),
    prefix: String(r.prefix || 'Капсула'),
    outline: !!(r.outline === true || r.outline === 'true'),
  }));

  const bannerSlides: BannerSlide[] = (bannerRes.data || []).map((r: Record<string, unknown>) => ({
    image: String(r.image_url || ''),
    text: String(r.slide_text || '').replace(/\/\//g, '\n'),
  }));

  const settingsMap = new Map<string, string>();
  for (const row of settingsRes.data || []) {
    const r = row as { key: string; value: string };
    settingsMap.set(r.key, r.value);
  }

  const heroTitle = settingsMap.get('hero_title') || 'Фирменная атрибутика';
  const heroSubtitle = settingsMap.get('hero_subtitle') || 'каталог для сотрудников компании';

  return buildCatalogFromMerch(rows, capsuleStyles, bannerSlides, heroTitle, heroSubtitle, true);
}

export function useCatalog() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['catalog-supabase'],
    queryFn: fetchCatalogData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Не удалось загрузить каталог.') : null,
    refetch,
    dataUpdatedAt,
  };
}
