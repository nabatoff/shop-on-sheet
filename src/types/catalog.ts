export interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  capsule: string;
  description?: string;
  sizes: string[];
  stock?: number;
  stockBySize?: Record<string, number>;
  preorder?: boolean;
  disabled?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  selectedSize: string;
}

export interface Capsule {
  id: string;
  name: string;
  subtitle?: string;
  bannerImage?: string;
  categories: string[];
  color?: string;   // цвет для отображения
  prefix?: string;  // префикс (напр. "Капсула", "Коллекция")
  outline?: boolean; // обводка для светлых цветов
}

export interface BannerSlide {
  image: string;
  text?: string;
}

export interface CatalogData {
  products: Product[];
  capsules: Capsule[];
  bannerImages: string[];
  bannerSlides: BannerSlide[];
  banners: {
    heroTitle: string;
    heroSubtitle: string;
    heroImage?: string;
  };
}
