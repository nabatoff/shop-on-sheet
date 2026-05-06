import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { CapsuleData } from '@/types/admin';
import { useCatalogAdmin } from '@/hooks/useCatalogAdmin';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Box, AlertTriangle } from 'lucide-react';
import { Product } from '@/types/catalog';

interface CapsuleManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capsules: CapsuleData[];
  onCapsulesChange: (capsules: CapsuleData[]) => void;
  existingProducts: Product[];
}

export function CapsuleManager({
  open,
  onOpenChange,
  capsules,
  onCapsulesChange,
  existingProducts,
}: CapsuleManagerProps) {
  const [newCapsuleName, setNewCapsuleName] = useState('');
  const [capsuleToDelete, setCapsuleToDelete] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productsUsingCapsule, setProductsUsingCapsule] = useState<Product[]>([]);
  const { addCapsule, deleteCapsule, isSubmitting } = useCatalogAdmin();
  const { toast } = useToast();

  // Подсчёт товаров по капсулам
  const getCapsuleProductCount = useCallback((capsuleName: string): number => {
    const uniqueIds = new Set<string>();
    existingProducts.forEach(p => {
      if (p.capsule?.trim().toLowerCase() === capsuleName.trim().toLowerCase()) {
        uniqueIds.add(p.id);
      }
    });
    return uniqueIds.size;
  }, [existingProducts]);

  const handleAddCapsule = async () => {
    const trimmed = newCapsuleName.trim();
    if (!trimmed) {
      toast({
        title: 'Ошибка',
        description: 'Введите название капсулы',
        variant: 'destructive',
      });
      return;
    }

    // Проверяем на дубликат
    if (capsules.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: 'Ошибка',
        description: 'Такая капсула уже существует',
        variant: 'destructive',
      });
      return;
    }

    const result = await addCapsule(trimmed);
    if (result.success) {
      const newCapsule: CapsuleData = { name: trimmed, color: '#0047BB', prefix: 'Капсула', outline: false };
      onCapsulesChange([...capsules, newCapsule].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
      setNewCapsuleName('');
      toast({
        title: 'Капсула добавлена',
        description: `"${trimmed}" добавлена в список`,
      });
    } else {
      toast({
        title: 'Ошибка',
        description: result.error || 'Не удалось добавить капсулу',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (capsuleName: string) => {
    const count = getCapsuleProductCount(capsuleName);
    
    if (count > 0) {
      // Находим товары с этой капсулой
      const products = existingProducts.filter(
        p => p.capsule?.trim().toLowerCase() === capsuleName.trim().toLowerCase()
      );
      // Уникальные товары по ID
      const uniqueProducts = Array.from(
        new Map(products.map(p => [p.id, p])).values()
      );
      setProductsUsingCapsule(uniqueProducts);
    } else {
      setProductsUsingCapsule([]);
    }
    
    setCapsuleToDelete(capsuleName);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!capsuleToDelete) return;

    const count = getCapsuleProductCount(capsuleToDelete);
    if (count > 0) {
      toast({
        title: 'Невозможно удалить',
        description: `Капсула "${capsuleToDelete}" используется в ${count} товарах. Сначала измените капсулу у этих товаров.`,
        variant: 'destructive',
      });
      setDeleteConfirmOpen(false);
      setCapsuleToDelete(null);
      return;
    }

    const result = await deleteCapsule(capsuleToDelete);
    if (result.success) {
      onCapsulesChange(capsules.filter(c => c.name !== capsuleToDelete));
      toast({
        title: 'Капсула удалена',
        description: `"${capsuleToDelete}" удалена из списка`,
      });
    } else {
      toast({
        title: 'Ошибка',
        description: result.error || 'Не удалось удалить капсулу',
        variant: 'destructive',
      });
    }

    setDeleteConfirmOpen(false);
    setCapsuleToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Box className="h-5 w-5 text-purple-600" />
              Управление капсулами
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Капсулы хранятся в Supabase (таблица catalog_capsules)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Добавление новой капсулы */}
            <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex gap-2">
                <Input
                  value={newCapsuleName}
                  onChange={(e) => setNewCapsuleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCapsule();
                    }
                  }}
                  placeholder="Название капсулы..."
                  className="flex-1 bg-white border-gray-200 text-gray-900"
                  disabled={isSubmitting}
                />
                <Button
                  onClick={handleAddCapsule}
                  disabled={isSubmitting || !newCapsuleName.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Список капсул */}
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
              {capsules.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  Нет капсул. Добавьте первую!
                </div>
              ) : (
                capsules.map((capsule) => {
                  const count = getCapsuleProductCount(capsule.name);
                  return (
                    <div key={capsule.name} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-gray-900 font-medium">{capsule.name}</span>
                          {count > 0 && (
                            <span className="text-xs text-gray-400">
                              • {count} {count === 1 ? 'товар' : count < 5 ? 'товара' : 'товаров'}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(capsule.name)}
                          disabled={isSubmitting}
                          className={`h-8 w-8 ${count > 0 ? 'text-gray-300' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                          title={count > 0 ? 'Капсула используется в товарах' : 'Удалить капсулу'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-xs text-gray-400">
              Всего капсул: {capsules.length}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              {productsUsingCapsule.length > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Невозможно удалить
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5 text-red-500" />
                  Удалить капсулу?
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {productsUsingCapsule.length > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-600">
                Капсула <strong>"{capsuleToDelete}"</strong> используется в следующих товарах:
              </p>
              <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
                {productsUsingCapsule.map((product) => (
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
                Сначала измените капсулу у этих товаров, затем удалите капсулу.
              </p>
            </div>
          ) : (
            <p className="text-gray-600">
              Вы уверены, что хотите удалить капсулу <strong>"{capsuleToDelete}"</strong>?
              Это действие нельзя отменить.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setCapsuleToDelete(null);
              }}
              className="text-gray-600"
            >
              {productsUsingCapsule.length > 0 ? 'Понятно' : 'Отмена'}
            </Button>
            {productsUsingCapsule.length === 0 && (
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
