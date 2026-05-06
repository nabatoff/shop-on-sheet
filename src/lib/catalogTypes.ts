/** Строка таблицы merch_lines в Supabase */
export interface MerchLineRow {
  id: string;
  product_id: string;
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
  disabled: boolean;
}
