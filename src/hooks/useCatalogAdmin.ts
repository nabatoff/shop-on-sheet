import { useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Product } from '@/types/catalog';
import type { ProductFormData, CapsuleData, LogEntry, ImportRow } from '@/types/admin';
import type { MerchLineRow } from '@/lib/catalogTypes';
import { productsFromMerchRowsAdmin } from '@/lib/catalogAggregate';

interface SingleProductRow {
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

type RowPayload = SingleProductRow & { setQuantity?: boolean };

function snakeInsert(r: SingleProductRow): Record<string, unknown> {
  return {
    product_id: r.id,
    category: r.category,
    name: r.name,
    size: r.size,
    quantity: r.quantity,
    price: r.price,
    image1: r.image1,
    image2: r.image2,
    image3: r.image3,
    image4: r.image4,
    capsule: r.capsule,
    description: r.description,
    preorder: r.preorder,
    disabled: r.disabled === true,
  };
}

async function adminLog(action: string, details: string, status: string) {
  try {
    const sb = getSupabase();
    const now = new Date();
    await sb.from('admin_logs').insert({
      date_display: now.toLocaleDateString('ru-RU'),
      time_display: now.toLocaleTimeString('ru-RU'),
      action,
      details,
      status,
    });
  } catch {
    /* не блокируем основную операцию */
  }
}

export function useCatalogAdmin() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProductRows = (product: ProductFormData): SingleProductRow[] => {
    const disabled = product.disabled === true;
    if (product.noSizeQuantity != null) {
      return [
        {
          id: product.id,
          category: product.category,
          name: product.name,
          size: '',
          quantity: Math.max(0, product.noSizeQuantity),
          price: product.price,
          image1: product.image1,
          image2: product.image2,
          image3: product.image3,
          image4: product.image4,
          capsule: product.capsule,
          description: product.description,
          preorder: product.preorder,
          disabled,
        },
      ];
    }
    const enabledSizes = product.sizes.filter((s) => s.enabled);
    return enabledSizes.map((sizeData) => ({
      id: product.id,
      category: product.category,
      name: product.name,
      size: sizeData.size,
      quantity: sizeData.quantity,
      price: product.price,
      image1: product.image1,
      image2: product.image2,
      image3: product.image3,
      image4: product.image4,
      capsule: product.capsule,
      description: product.description,
      preorder: sizeData.preorder === true || product.preorder === true,
      disabled,
    }));
  };

  const addProduct = async (product: ProductFormData): Promise<boolean> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    setError(null);

    try {
      const enabledSizes = product.sizes.filter((s) => s.enabled);
      const hasQuantity = enabledSizes.some((s) => s.quantity > 0);
      const hasPreorderSize = enabledSizes.some((s) => s.preorder === true);
      const isPreorder = product.preorder === true || hasPreorderSize;
      const isNoSize = product.noSizeQuantity != null;

      if (!isNoSize && enabledSizes.length === 0) {
        setError('Выберите хотя бы один размер или включите «Остаток без размера»');
        setIsSubmitting(false);
        return false;
      }

      if (!isNoSize && !isPreorder && !hasQuantity) {
        setError('Укажите количество > 0 хотя бы для одного размера');
        setIsSubmitting(false);
        return false;
      }

      const rows = isPreorder || isNoSize
        ? createProductRows(product)
        : createProductRows(product).filter((p) => p.quantity > 0 || p.preorder === true);

      if (rows.length === 0) {
        setError(isNoSize ? 'Укажите остаток (0 или больше)' : 'Укажите количество > 0 хотя бы для одного размера');
        setIsSubmitting(false);
        return false;
      }

      const { error: insErr } = await sb.from('merch_lines').insert(rows.map(snakeInsert));
      if (insErr) {
        setError(insErr.message);
        await adminLog('Добавление товара', insErr.message, 'Ошибка');
        return false;
      }

      const info = rows[0];
      await adminLog(
        'Добавление товара',
        `ID: ${info.id}, Название: ${info.name}, Размеры: ${rows.map((r) => r.size || '(без)').join(', ')}`,
        'Успех',
      );
      return true;
    } catch (e) {
      setError('Ошибка при добавлении товара');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProduct = async (product: ProductFormData): Promise<boolean> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    setError(null);

    try {
      const enabledSizes = product.sizes.filter((s) => s.enabled);
      const isNoSize = product.noSizeQuantity != null;
      if (!isNoSize && enabledSizes.length === 0) {
        setError('Выберите хотя бы один размер или включите «Остаток без размера»');
        setIsSubmitting(false);
        return false;
      }

      const baseRows = createProductRows(product);
      const productsPayload: RowPayload[] = isNoSize
        ? baseRows.map((row) => {
            const useSet = product.noSizeQuantitySet != null;
            return {
              ...row,
              quantity: useSet ? (product.noSizeQuantitySet ?? 0) : row.quantity,
              setQuantity: useSet,
            };
          })
        : baseRows.map((row, i) => {
            const sizeData = enabledSizes[i];
            const useSet = sizeData.quantitySet != null;
            return {
              ...row,
              quantity: useSet ? (sizeData.quantitySet ?? 0) : row.quantity,
              setQuantity: useSet,
            };
          });

      const rpcRows = productsPayload.map((prod) => ({
        ...snakeInsert(prod),
        quantity: Number(prod.quantity) || 0,
        set_quantity: prod.setQuantity === true,
      }));

      const { data: rpcData, error: rpcErr } = await sb.rpc('update_merch_product_atomic', {
        p_product_id: product.id,
        p_rows: rpcRows,
      });

      if (rpcErr) {
        setError(rpcErr.message);
        await adminLog('Обновление товара', rpcErr.message, 'Ошибка');
        return false;
      }

      const stats = (rpcData || {}) as { updated?: number; added?: number; deleted?: number };
      const updated = Number(stats.updated || 0);
      const added = Number(stats.added || 0);
      const deleted = Number(stats.deleted || 0);

      await adminLog(
        'Обновление товара',
        `ID: ${product.id}, Название: ${product.name}, Обновлено: ${updated}, Добавлено: ${added}, Удалено: ${deleted}`,
        'Успех',
      );
      return true;
    } catch {
      setError('Ошибка при обновлении товара');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: delErr } = await sb.from('merch_lines').delete().eq('product_id', productId);
      if (delErr) {
        setError(delErr.message);
        return false;
      }
      await adminLog('Удаление товара', `ID: ${productId}`, 'Успех');
      return true;
    } catch {
      setError('Ошибка при удалении товара');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDisabled = async (productId: string, disabled: boolean): Promise<boolean> => {
    const sb = getSupabase();
    setError(null);
    try {
      const { error: upErr } = await sb.from('merch_lines').update({ disabled }).eq('product_id', productId);
      if (upErr) {
        setError(upErr.message);
        return false;
      }
      await adminLog(disabled ? 'Отключение товара' : 'Включение товара', `ID: ${productId}`, 'Успех');
      return true;
    } catch {
      setError('Ошибка при переключении состояния товара');
      return false;
    }
  };

  const bulkImport = async (rows: ImportRow[]): Promise<boolean> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = rows
        .filter((r) => String(r.id || '').trim())
        .map((row) => ({
          product_id: String(row.id).trim(),
          category: row.category,
          name: row.name,
          size: String(row.size ?? '').trim(),
          quantity: row.quantity,
          price: row.price,
          image1: row.image1,
          image2: row.image2,
          image3: row.image3,
          image4: row.image4,
          capsule: row.capsule,
          description: row.description,
          preorder: row.preorder,
          disabled: false,
        }));

      const { error: upErr } = await sb.from('merch_lines').upsert(payload, {
        onConflict: 'product_id,size',
      });
      if (upErr) {
        setError(upErr.message);
        await adminLog('Массовый импорт', upErr.message, 'Ошибка');
        return false;
      }
      await adminLog('Массовый импорт', `Строк в файле: ${rows.length}`, 'Успех');
      return true;
    } catch {
      setError('Ошибка при импорте');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    const sb = getSupabase();
    try {
      const { data, error: qErr } = await sb.from('merch_lines').select('*').order('product_id').order('size');
      if (qErr || !data) return [];
      return productsFromMerchRowsAdmin(data as MerchLineRow[]);
    } catch {
      return [];
    }
  }, []);

  const fetchCategories = useCallback(async (): Promise<string[]> => {
    const sb = getSupabase();
    try {
      const { data, error: qErr } = await sb.from('catalog_categories').select('name').order('sort_order').order('name');
      if (qErr || !data) return [];
      return data.map((r: { name: string }) => r.name);
    } catch {
      return [];
    }
  }, []);

  const addCategory = async (categoryName: string): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    const name = categoryName.trim();
    if (!name) return { success: false, error: 'Пустое название' };
    setIsSubmitting(true);
    setError(null);
    try {
      const maxSort =
        (await sb.from('catalog_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1))
          .data?.[0]?.sort_order ?? -1;
      const { error: insErr } = await sb.from('catalog_categories').insert({
        name,
        sort_order: Number(maxSort) + 1,
      });
      if (insErr) {
        return { success: false, error: insErr.message.includes('duplicate') ? 'Категория уже существует' : insErr.message };
      }
      await adminLog('Добавление категории', name, 'Успех');
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при добавлении категории' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCategory = async (categoryName: string): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    try {
      const { error: delErr } = await sb.from('catalog_categories').delete().eq('name', categoryName);
      if (delErr) return { success: false, error: delErr.message };
      await adminLog('Удаление категории', categoryName, 'Успех');
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при удалении категории' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchSizes = useCallback(async (): Promise<string[]> => {
    const sb = getSupabase();
    try {
      const { data, error: qErr } = await sb.from('catalog_sizes').select('name').order('sort_order').order('name');
      if (qErr || !data) return [];
      return data.map((r: { name: string }) => r.name);
    } catch {
      return [];
    }
  }, []);

  const addSize = async (sizeName: string): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    const name = sizeName.trim();
    if (!name) return { success: false, error: 'Пустое название' };
    setIsSubmitting(true);
    try {
      const maxSort =
        (await sb.from('catalog_sizes').select('sort_order').order('sort_order', { ascending: false }).limit(1)).data?.[0]
          ?.sort_order ?? -1;
      const { error: insErr } = await sb.from('catalog_sizes').insert({ name, sort_order: Number(maxSort) + 1 });
      if (insErr) {
        return { success: false, error: insErr.message.includes('duplicate') ? 'Размер уже существует' : insErr.message };
      }
      await adminLog('Добавление размера', name, 'Успех');
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при добавлении размера' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSize = async (sizeName: string): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    try {
      const { error: delErr } = await sb.from('catalog_sizes').delete().eq('name', sizeName);
      if (delErr) return { success: false, error: delErr.message };
      await adminLog('Удаление размера', sizeName, 'Успех');
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при удалении размера' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchCapsules = useCallback(async (): Promise<CapsuleData[]> => {
    const sb = getSupabase();
    try {
      const { data, error: qErr } = await sb
        .from('catalog_capsules')
        .select('name,color,prefix,outline')
        .order('sort_order')
        .order('name');
      if (qErr || !data) return [];
      return data.map((c: Record<string, unknown>) => ({
        name: String(c.name),
        color: String(c.color || '#0047BB'),
        prefix: String(c.prefix || 'Капсула'),
        outline: !!(c.outline === true || c.outline === 'true'),
      }));
    } catch {
      return [];
    }
  }, []);

  const addCapsule = async (
    capsuleName: string,
    color: string = '#0047BB',
    prefix: string = 'Капсула',
    outline: boolean = false,
  ): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    const name = capsuleName.trim();
    if (!name) return { success: false, error: 'Пустое название' };
    setIsSubmitting(true);
    try {
      const maxSort =
        (await sb.from('catalog_capsules').select('sort_order').order('sort_order', { ascending: false }).limit(1)).data?.[0]
          ?.sort_order ?? -1;
      const { error: insErr } = await sb.from('catalog_capsules').insert({
        name,
        color: color.trim() || '#0047BB',
        prefix: prefix.trim() || 'Капсула',
        outline,
        sort_order: Number(maxSort) + 1,
      });
      if (insErr) {
        return { success: false, error: insErr.message.includes('duplicate') ? 'Капсула уже существует' : insErr.message };
      }
      await adminLog('Добавление капсулы', `${name}, ${color}`, 'Успех');
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при добавлении капсулы' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCapsule = async (
    capsuleName: string,
    color: string,
    prefix: string,
    outline: boolean = false,
  ): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    try {
      const { error: upErr } = await sb
        .from('catalog_capsules')
        .update({
          color: color.trim() || '#0047BB',
          prefix: prefix.trim() || 'Капсула',
          outline,
        })
        .eq('name', capsuleName);
      if (upErr) return { success: false, error: upErr.message };
      await adminLog('Обновление капсулы', capsuleName, 'Успех');
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при обновлении капсулы' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCapsule = async (capsuleName: string): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    setIsSubmitting(true);
    try {
      const { error: delErr } = await sb.from('catalog_capsules').delete().eq('name', capsuleName);
      if (delErr) return { success: false, error: delErr.message };
      await adminLog('Удаление капсулы', capsuleName, 'Успех');
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при удалении капсулы' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchLogs = useCallback(async (limit: number = 100): Promise<{ logs: LogEntry[]; total: number }> => {
    const sb = getSupabase();
    try {
      const { data, error: qErr, count } = await sb
        .from('admin_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (qErr || !data) return { logs: [], total: 0 };
      const logs: LogEntry[] = data.map((r: Record<string, unknown>) => ({
        date: String(r.date_display || ''),
        time: String(r.time_display || ''),
        action: String(r.action || ''),
        details: String(r.details || ''),
        status: String(r.status || ''),
      }));
      return { logs, total: count ?? logs.length };
    } catch {
      return { logs: [], total: 0 };
    }
  }, []);

  const clearLogs = async (): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    try {
      const { error: delErr } = await sb.from('admin_logs').delete().gte('created_at', '1970-01-01T00:00:00Z');
      if (delErr) return { success: false, error: delErr.message };
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при очистке журнала' };
    }
  };

  return {
    addProduct,
    updateProduct,
    deleteProduct,
    toggleDisabled,
    bulkImport,
    fetchProducts,
    fetchCategories,
    addCategory,
    deleteCategory,
    fetchSizes,
    addSize,
    deleteSize,
    fetchCapsules,
    addCapsule,
    updateCapsule,
    deleteCapsule,
    fetchLogs,
    clearLogs,
    isSubmitting,
    error,
  };
}
