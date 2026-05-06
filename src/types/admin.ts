export interface SizeQuantity {
  size: string;
  quantity: number;
  enabled: boolean;
  quantitySet?: number;
}

export interface ProductFormData {
  id: string;
  category: string;
  name: string;
  sizes: SizeQuantity[];
  price: number;
  image1: string;
  image2: string;
  image3: string;
  image4: string;
  capsule: string;
  description: string;
  preorder: boolean;
  noSizeQuantity?: number;
  noSizeQuantitySet?: number;
  disabled?: boolean;
}

export interface CapsuleData {
  name: string;
  color: string;
  prefix: string;
  outline?: boolean;
}

export interface CategoryDeleteError {
  productsCount: number;
  productIds: string[];
}

export interface LogEntry {
  date: string;
  time: string;
  action: string;
  details: string;
  status: string;
}

export interface ImportRow {
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
}
