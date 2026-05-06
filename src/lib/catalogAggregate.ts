import { Product, Capsule, CatalogData, BannerSlide } from '@/types/catalog';
import type { MerchLineRow } from '@/lib/catalogTypes';

const CAPSULE_ORDER = ['Серая капсула', 'Серая', 'Grey', 'Синяя капсула', 'Синяя', 'Blue', 'Черная капсула', 'Черная', 'Black', 'Разное', 'Other', 'Белая', 'Белая капсула'];
const CATEGORY_ORDER = ['Одежда', 'Аксессуары'];

interface RawProduct {
  id: string;
  category: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  image1: string;
  image2: string;
  image3: string;
  image4: string;
  capsule: string;
  description: string;
  preorder: boolean;
  disabled?: boolean;
}

export function merchRowsToRawProducts(rows: MerchLineRow[]): RawProduct[] {
  return rows.map((row) => ({
    id: String(row.product_id || '').trim(),
    category: String(row.category || '').trim(),
    name: String(row.name || '').trim(),
    size: String(row.size || '').trim(),
    quantity: Number(row.quantity) || 0,
    price: Number(row.price) || 0,
    image1: String(row.image1 || '').trim(),
    image2: String(row.image2 || '').trim(),
    image3: String(row.image3 || '').trim(),
    image4: String(row.image4 || '').trim(),
    capsule: String(row.capsule || '').trim(),
    description: String(row.description || '').trim(),
    preorder: !!row.preorder,
    disabled: row.disabled ? true : undefined,
  }));
}

function groupProductsByID(rawProducts: RawProduct[], hideDisabled: boolean): Product[] {
  const grouped = new Map<string, Product & { _stockBySize: Map<string, number>; _preorderBySize: Map<string, boolean> }>();

  for (const raw of rawProducts) {
    if (!raw.id) continue;

    if (grouped.has(raw.id)) {
      const existing = grouped.get(raw.id)!;
      if (raw.size && !existing.sizes.includes(raw.size)) {
        existing.sizes.push(raw.size);
      }
      if (raw.size && raw.quantity) {
        existing._stockBySize.set(raw.size, (existing._stockBySize.get(raw.size) || 0) + raw.quantity);
      }
      if (raw.size) {
        existing._preorderBySize.set(raw.size, raw.preorder === true);
      }
      if (raw.quantity) {
        existing.stock = (existing.stock || 0) + raw.quantity;
      }
      if (raw.preorder) existing.preorder = true;
      if (raw.disabled) existing.disabled = true;
    } else {
      const images = [raw.image1, raw.image2, raw.image3, raw.image4].filter(Boolean);
      const stockMap = new Map<string, number>();
      const preorderMap = new Map<string, boolean>();
      if (raw.size && raw.quantity) stockMap.set(raw.size, raw.quantity);
      if (raw.size) preorderMap.set(raw.size, raw.preorder === true);

      grouped.set(raw.id, {
        id: raw.id,
        name: raw.name,
        price: raw.price,
        images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop'],
        category: raw.category,
        capsule: raw.capsule,
        description: raw.description,
        sizes: raw.size ? [raw.size] : [],
        stock: raw.quantity || 0,
        _stockBySize: stockMap,
        _preorderBySize: preorderMap,
        preorder: raw.preorder,
        disabled: raw.disabled || undefined,
      });
    }
  }

  let list = Array.from(grouped.values()).map(({ _stockBySize, _preorderBySize, ...product }) => ({
    ...product,
    stockBySize: Object.fromEntries(_stockBySize),
    preorderBySize: Object.fromEntries(_preorderBySize),
  }));

  if (hideDisabled) list = list.filter((p) => !p.disabled);
  return list;
}

function extractAndSortCapsules(products: Product[]): Capsule[] {
  const capsuleMap = new Map<string, Set<string>>();

  for (const product of products) {
    if (!capsuleMap.has(product.capsule)) capsuleMap.set(product.capsule, new Set());
    capsuleMap.get(product.capsule)!.add(product.category);
  }

  const capsules: Capsule[] = Array.from(capsuleMap.entries()).map(([name, categories]) => ({
    id: name,
    name,
    categories: Array.from(categories),
  }));

  capsules.sort((a, b) => {
    const indexA = CAPSULE_ORDER.indexOf(a.name);
    const indexB = CAPSULE_ORDER.indexOf(b.name);
    const orderA = indexA === -1 ? CAPSULE_ORDER.length : indexA;
    const orderB = indexB === -1 ? CAPSULE_ORDER.length : indexB;
    return orderA - orderB;
  });

  return capsules;
}

function sortProductsByCategory(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const capsuleIndexA = CAPSULE_ORDER.indexOf(a.capsule);
    const capsuleIndexB = CAPSULE_ORDER.indexOf(b.capsule);
    const orderA = capsuleIndexA === -1 ? CAPSULE_ORDER.length : capsuleIndexA;
    const orderB = capsuleIndexB === -1 ? CAPSULE_ORDER.length : capsuleIndexB;
    if (orderA !== orderB) return orderA - orderB;

    const catIndexA = CATEGORY_ORDER.indexOf(a.category);
    const catIndexB = CATEGORY_ORDER.indexOf(b.category);
    const catOrderA = catIndexA === -1 ? CATEGORY_ORDER.length : catIndexA;
    const catOrderB = catIndexB === -1 ? CATEGORY_ORDER.length : catIndexB;
    if (catOrderA !== catOrderB) return catOrderA - catOrderB;

    if (catIndexA === -1 && catIndexB === -1) return a.category.localeCompare(b.category, 'ru');
    return 0;
  });
}

export interface CapsuleStyleRow {
  name: string;
  color: string;
  prefix: string;
  outline: boolean;
}

export function mergeCapsuleStyles(capsules: Capsule[], styles: CapsuleStyleRow[]): Capsule[] {
  const map = new Map(styles.map((s) => [s.name.toLowerCase(), s]));
  return capsules.map((cap) => {
    const s = map.get(cap.name.toLowerCase());
    return s
      ? { ...cap, color: s.color || cap.color, prefix: s.prefix || cap.prefix, outline: s.outline ?? cap.outline }
      : { ...cap, color: '#0047BB', prefix: 'Капсула', outline: false };
  });
}

export function buildCatalogFromMerch(
  rows: MerchLineRow[],
  capsuleStyles: CapsuleStyleRow[],
  bannerSlides: BannerSlide[],
  heroTitle: string,
  heroSubtitle: string,
  hideDisabled: boolean,
): CatalogData {
  const raw = merchRowsToRawProducts(rows);
  const groupedProducts = groupProductsByID(raw, hideDisabled);
  const capsulesPlain = extractAndSortCapsules(groupedProducts);
  const capsules = mergeCapsuleStyles(capsulesPlain, capsuleStyles);
  const products = sortProductsByCategory(groupedProducts);
  const bannerImages = bannerSlides.map((s) => s.image).filter(Boolean);

  return {
    products,
    capsules,
    bannerImages,
    bannerSlides,
    banners: { heroTitle, heroSubtitle },
  };
}

/** Для админки: все строки, включая disabled-товары */
export function productsFromMerchRowsAdmin(rows: MerchLineRow[]): Product[] {
  const raw = merchRowsToRawProducts(rows);
  const grouped = groupProductsByID(raw, false);
  return sortProductsByCategory(grouped);
}
