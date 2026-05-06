import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useCatalogAdmin } from '@/hooks/useCatalogAdmin';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, FolderOpen, AlertTriangle } from 'lucide-react';
import { Product } from '@/types/catalog';

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onCategoriesChange: (categories: string[]) => void;
  existingProducts: Product[];
}

export function CategoryManager({
  open,
  onOpenChange,
  categories,
  onCategoriesChange,
  existingProducts,
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productsUsingCategory, setProductsUsingCategory] = useState<Product[]>([]);
  const { addCategory, deleteCategory, isSubmitting } = useCatalogAdmin();
  const { toast } = useToast();

  // Подсчёт товаров по категориям
  const getCategoryProductCount = useCallback((categoryName: string): number => {
    const uniqueIds = new Set<string>();
    existingProducts.forEach(p => {
      if (p.category?.trim().toLowerCase() === categoryName.trim().toLowerCase()) {
        uniqueIds.add(p.id);
      }
    });
    return uniqueIds.size;
  }, [existingProducts]);

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast({
        title: 'Ошибка',
        description: 'Введите название категории',
        variant: 'destructive',
      });
      return;
    }

    // Проверяем на дубликат
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: 'Ошибка',
        description: 'Такая категория уже существует',
        variant: 'destructive',
      });
      return;
    }

    const result = await addCategory(trimmed);
    if (result.success) {
      onCategoriesChange([...categories, trimmed].sort((a, b) => a.localeCompare(b, 'ru')));
      setNewCategoryName('');
      toast({
        title: 'Категория добавлена',
        description: `"${trimmed}" добавлена в список`,
      });
    } else {
      toast({
        title: 'Ошибка',
        description: result.error || 'Не удалось добавить категорию',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (categoryName: string) => {
    const count = getCategoryProductCount(categoryName);
    
    if (count > 0) {
      // Находим товары с этой категорией
      const products = existingProducts.filter(
        p => p.category?.trim().toLowerCase() === categoryName.trim().toLowerCase()
      );
      // Уникальные товары по ID
      const uniqueProducts = Array.from(
        new Map(products.map(p => [p.id, p])).values()
      );
      setProductsUsingCategory(uniqueProducts);
    } else {
      setProductsUsingCategory([]);
    }
    
    setCategoryToDelete(categoryName);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    const count = getCategoryProductCount(categoryToDelete);
    if (count > 0) {
      toast({
        title: 'Невозможно удалить',
        description: `Категория "${categoryToDelete}" используется в ${count} товарах. Сначала измените категорию у этих товаров.`,
        variant: 'destructive',
      });
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
      return;
    }

    const result = await deleteCategory(categoryToDelete);
    if (result.success) {
      onCategoriesChange(categories.filter(c => c !== categoryToDelete));
      toast({
        title: 'Категория удалена',
        description: `"${categoryToDelete}" удалена из списка`,
      });
    } else {
      toast({
        title: 'Ошибка',
        description: result.error || 'Не удалось удалить категорию',
        variant: 'destructive',
      });
    }

    setDeleteConfirmOpen(false);
    setCategoryToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FolderOpen className="h-5 w-5 text-blue-600" />
              Управление категориями
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Категории хранятся в листе "Категории" вашей Google таблицы
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Добавление новой категории */}
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                placeholder="Новая категория..."
                className="flex-1 bg-white border-gray-200 text-gray-900"
                disabled={isSubmitting}
              />
              <Button
                onClick={handleAddCategory}
                disabled={isSubmitting || !newCategoryName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Список категорий */}
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  Нет категорий. Добавьте первую!
                </div>
              ) : (
                categories.map((category) => {
                  const count = getCategoryProductCount(category);
                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between p-3 hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-900 font-medium">{category}</span>
                        {count > 0 && (
                          <span className="ml-2 text-xs text-gray-400">
                            ({count} {count === 1 ? 'товар' : count < 5 ? 'товара' : 'товаров'})
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(category)}
                        disabled={isSubmitting}
                        className={`h-8 w-8 ${count > 0 ? 'text-gray-300' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={count > 0 ? 'Категория используется в товарах' : 'Удалить категорию'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-xs text-gray-400">
              Всего категорий: {categories.length}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              {productsUsingCategory.length > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Невозможно удалить
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5 text-red-500" />
                  Удалить категорию?
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {productsUsingCategory.length > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-600">
                Категория <strong>"{categoryToDelete}"</strong> используется в следующих товарах:
              </p>
              <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
                {productsUsingCategory.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-2 border-b border-gray-100 last:border-b-0">
                    {product.images[0] && (
                      <img 
                        src={product.images[0]} 
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">ID: {product.id}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-amber-600">
                Сначала измените категорию у этих товаров, затем удалите категорию.
              </p>
            </div>
          ) : (
            <p className="text-gray-600">
              Вы уверены, что хотите удалить категорию <strong>"{categoryToDelete}"</strong>?
              Это действие нельзя отменить.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setCategoryToDelete(null);
              }}
              className="text-gray-600"
            >
              {productsUsingCategory.length > 0 ? 'Понятно' : 'Отмена'}
            </Button>
            {productsUsingCategory.length === 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Удалить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
