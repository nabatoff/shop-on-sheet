export const ORDER_CITIES = ['Уральск', 'Алматы', 'Астана', 'Усть-Каменогорск'] as const;
export type OrderCity = (typeof ORDER_CITIES)[number];

export function isOrderCity(value: string): value is OrderCity {
  return (ORDER_CITIES as readonly string[]).includes(value);
}
