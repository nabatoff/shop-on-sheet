 import { useState, useCallback } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useCatalogAdmin } from '@/hooks/useCatalogAdmin';
 import { useToast } from '@/hooks/use-toast';
 import { Plus, Trash2, Loader2, Ruler, AlertTriangle } from 'lucide-react';
 import { Product } from '@/types/catalog';
 
 interface SizeManagerProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   sizes: string[];
   onSizesChange: (sizes: string[]) => void;
   existingProducts: Product[];
 }
 
 // Сортировка размеров в логичном порядке
 const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL', '5XL'];
 
 function sortSizes(sizes: string[]): string[] {
   return sizes.sort((a, b) => {
     const indexA = SIZE_ORDER.indexOf(a.toUpperCase());
     const indexB = SIZE_ORDER.indexOf(b.toUpperCase());
     
     // Оба в списке стандартных размеров
     if (indexA !== -1 && indexB !== -1) return indexA - indexB;
     // Только a в списке
     if (indexA !== -1) return -1;
     // Только b в списке
     if (indexB !== -1) return 1;
     
     // Пробуем как числа
     const numA = parseFloat(a);
     const numB = parseFloat(b);
     if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
     if (!isNaN(numA)) return 1;
     if (!isNaN(numB)) return -1;
     
     // Алфавитная сортировка
     return a.localeCompare(b, 'ru');
   });
 }
 
 export function SizeManager({
   open,
   onOpenChange,
   sizes,
   onSizesChange,
   existingProducts,
 }: SizeManagerProps) {
   const [newSizeName, setNewSizeName] = useState('');
   const [sizeToDelete, setSizeToDelete] = useState<string | null>(null);
   const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
   const [productsUsingSize, setProductsUsingSize] = useState<Product[]>([]);
  const { addSize, deleteSize, isSubmitting } = useCatalogAdmin();
   const { toast } = useToast();
 
   // Подсчёт товаров по размерам
   const getSizeProductCount = useCallback((sizeName: string): number => {
     const uniqueIds = new Set<string>();
     existingProducts.forEach(p => {
       if (p.sizes.some(s => s.trim().toLowerCase() === sizeName.trim().toLowerCase())) {
         uniqueIds.add(p.id);
       }
     });
     return uniqueIds.size;
   }, [existingProducts]);
 
   const handleAddSize = async () => {
     const trimmed = newSizeName.trim().toUpperCase();
     if (!trimmed) {
       toast({
         title: 'Ошибка',
         description: 'Введите название размера',
         variant: 'destructive',
       });
       return;
     }
 
     // Проверяем на дубликат
     if (sizes.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
       toast({
         title: 'Ошибка',
         description: 'Такой размер уже существует',
         variant: 'destructive',
       });
       return;
     }
 
     const result = await addSize(trimmed);
     if (result.success) {
       onSizesChange(sortSizes([...sizes, trimmed]));
       setNewSizeName('');
       toast({
         title: 'Размер добавлен',
         description: `"${trimmed}" добавлен в список`,
       });
     } else {
       toast({
         title: 'Ошибка',
         description: result.error || 'Не удалось добавить размер',
         variant: 'destructive',
       });
     }
   };
 
   const handleDeleteClick = (sizeName: string) => {
     const count = getSizeProductCount(sizeName);
     
     if (count > 0) {
       // Находим товары с этим размером
       const products = existingProducts.filter(
         p => p.sizes.some(s => s.trim().toLowerCase() === sizeName.trim().toLowerCase())
       );
       // Уникальные товары по ID
       const uniqueProducts = Array.from(
         new Map(products.map(p => [p.id, p])).values()
       );
       setProductsUsingSize(uniqueProducts);
     } else {
       setProductsUsingSize([]);
     }
     
     setSizeToDelete(sizeName);
     setDeleteConfirmOpen(true);
   };
 
   const handleDeleteConfirm = async () => {
     if (!sizeToDelete) return;
 
     const count = getSizeProductCount(sizeToDelete);
     if (count > 0) {
       toast({
         title: 'Невозможно удалить',
         description: `Размер "${sizeToDelete}" используется в ${count} товарах. Сначала измените размер у этих товаров.`,
         variant: 'destructive',
       });
       setDeleteConfirmOpen(false);
       setSizeToDelete(null);
       return;
     }
 
     const result = await deleteSize(sizeToDelete);
     if (result.success) {
       onSizesChange(sizes.filter(s => s !== sizeToDelete));
       toast({
         title: 'Размер удалён',
         description: `"${sizeToDelete}" удалён из списка`,
       });
     } else {
       toast({
         title: 'Ошибка',
         description: result.error || 'Не удалось удалить размер',
         variant: 'destructive',
       });
     }
 
     setDeleteConfirmOpen(false);
     setSizeToDelete(null);
   };
 
   return (
     <>
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="max-w-lg bg-white">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-gray-900">
               <Ruler className="h-5 w-5 text-blue-600" />
               Управление размерами
             </DialogTitle>
             <DialogDescription className="text-gray-500">
               Размеры хранятся в листе "Размеры" вашей Google таблицы
             </DialogDescription>
           </DialogHeader>
 
           <div className="space-y-4">
             {/* Добавление нового размера */}
             <div className="flex gap-2">
               <Input
                 value={newSizeName}
                 onChange={(e) => setNewSizeName(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     handleAddSize();
                   }
                 }}
                 placeholder="Новый размер (например: XXL, 42, 150см)..."
                 className="flex-1 bg-white border-gray-200 text-gray-900"
                 disabled={isSubmitting}
               />
               <Button
                 onClick={handleAddSize}
                 disabled={isSubmitting || !newSizeName.trim()}
                 className="bg-blue-600 hover:bg-blue-700"
               >
                 {isSubmitting ? (
                   <Loader2 className="h-4 w-4 animate-spin" />
                 ) : (
                   <Plus className="h-4 w-4" />
                 )}
               </Button>
             </div>
 
             {/* Список размеров */}
             <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
               {sizes.length === 0 ? (
                 <div className="p-4 text-center text-gray-400">
                   Нет размеров. Добавьте первый!
                 </div>
               ) : (
                 sizes.map((size) => {
                   const count = getSizeProductCount(size);
                   return (
                     <div
                       key={size}
                       className="flex items-center justify-between p-3 hover:bg-gray-50"
                     >
                       <div className="flex-1 min-w-0">
                         <span className="text-gray-900 font-medium">{size}</span>
                         {count > 0 && (
                           <span className="ml-2 text-xs text-gray-400">
                             ({count} {count === 1 ? 'товар' : count < 5 ? 'товара' : 'товаров'})
                           </span>
                         )}
                       </div>
                       <Button
                         variant="ghost"
                         size="icon"
                         onClick={() => handleDeleteClick(size)}
                         disabled={isSubmitting}
                         className={`h-8 w-8 ${count > 0 ? 'text-gray-300' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                         title={count > 0 ? 'Размер используется в товарах' : 'Удалить размер'}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                   );
                 })
               )}
             </div>
 
             <p className="text-xs text-gray-400">
               Всего размеров: {sizes.length}
             </p>
           </div>
         </DialogContent>
       </Dialog>
 
       {/* Диалог подтверждения удаления */}
       <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
         <DialogContent className="max-w-md bg-white">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-gray-900">
               {productsUsingSize.length > 0 ? (
                 <>
                   <AlertTriangle className="h-5 w-5 text-amber-500" />
                   Невозможно удалить
                 </>
               ) : (
                 <>
                   <Trash2 className="h-5 w-5 text-red-500" />
                   Удалить размер?
                 </>
               )}
             </DialogTitle>
           </DialogHeader>
 
           {productsUsingSize.length > 0 ? (
             <div className="space-y-3">
               <p className="text-gray-600">
                 Размер <strong>"{sizeToDelete}"</strong> используется в следующих товарах:
               </p>
               <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
                 {productsUsingSize.map((product) => (
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
                 Сначала измените размер у этих товаров, затем удалите размер.
               </p>
             </div>
           ) : (
             <p className="text-gray-600">
               Вы уверены, что хотите удалить размер <strong>"{sizeToDelete}"</strong>?
               Это действие нельзя отменить.
             </p>
           )}
 
           <DialogFooter>
             <Button
               variant="ghost"
               onClick={() => {
                 setDeleteConfirmOpen(false);
                 setSizeToDelete(null);
               }}
               className="text-gray-600"
             >
               {productsUsingSize.length > 0 ? 'Понятно' : 'Отмена'}
             </Button>
             {productsUsingSize.length === 0 && (
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