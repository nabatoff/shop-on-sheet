import { useState, useCallback, useEffect } from 'react';
import { Product, CartItem } from '@/types/catalog';
import { useToast } from '@/hooks/use-toast';

const CART_STORAGE_KEY = 'cart_items';

function getAvailableStock(product: Product, selectedSize: string): number | undefined {
  if (product.preorderBySize?.[selectedSize] === true || product.preorder === true) {
    return undefined;
  }
  if (product.stockBySize && selectedSize in product.stockBySize) {
    return product.stockBySize[selectedSize];
  }
  return undefined;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Restore cart from localStorage on init
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch (err) {
      console.error('Failed to restore cart:', err);
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save cart:', err);
    }
  }, [items]);

  const addItem = useCallback((product: Product, selectedSize: string) => {
    const available = getAvailableStock(product, selectedSize);

    setItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.id === product.id && item.selectedSize === selectedSize
      );
      const currentQty = existingIndex >= 0 ? prev[existingIndex].quantity : 0;
      const newQty = currentQty + 1;

      if (available !== undefined && newQty > available) {
        toast({
          title: 'Недостаточно товара',
          description: `В наличии: ${available} шт. Вы уже добавили ${currentQty} шт. в корзину.`,
          variant: 'destructive',
        });
        return prev;
      }

      if (existingIndex >= 0) {
        return prev.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, selectedSize }];
    });
  }, [toast]);

  const removeItem = useCallback((productId: string, selectedSize: string) => {
    setItems(prev => prev.filter(
      item => !(item.id === productId && item.selectedSize === selectedSize)
    ));
  }, []);

  const updateQuantity = useCallback((productId: string, selectedSize: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, selectedSize);
      return;
    }
    setItems(prev => {
      const item = prev.find(i => i.id === productId && i.selectedSize === selectedSize);
      if (item?.preorderBySize?.[selectedSize] === true || item?.preorder === true) {
        return prev.map(i =>
          i.id === productId && i.selectedSize === selectedSize ? { ...i, quantity } : i
        );
      }
      const maxQty = item?.stockBySize?.[selectedSize];
      const capped = maxQty !== undefined ? Math.min(quantity, maxQty) : quantity;
      if (maxQty !== undefined && quantity > maxQty) {
        toast({
          title: 'Достигнут лимит',
          description: `В наличии: ${maxQty} шт.`,
          variant: 'destructive',
        });
      }
      return prev.map(i =>
        i.id === productId && i.selectedSize === selectedSize ? { ...i, quantity: capped } : i
      );
    });
  }, [removeItem, toast]);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear cart storage:', err);
    }
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    items,
    totalItems,
    totalPrice,
    isOpen,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
  };
}
