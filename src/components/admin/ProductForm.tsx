import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductFormData, SizeQuantity } from '@/types/admin';
import { useCatalogAdmin } from '@/hooks/useCatalogAdmin';
import { useImageUpload, isValidImageType, isValidImageSize } from '@/hooks/useImageUpload';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Check, X, Upload, Trash2, Save, Wand2, GripVertical, ArrowLeft, ArrowRight } from 'lucide-react';
import { Product } from '@/types/catalog';

// Статический список категорий по умолчанию
const DEFAULT_CATEGORIES = [
  'Разное',
  'Аксессуары',
  'Кепки',
  'Панамы',
  'Поло',
  'Свитшоты',
  'Футболки',
  'Шапки',
  'Жилетка',
];

// Статический список размеров по умолчанию
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'one size', 'унисекс'];

const createInitialSizes = (allSizes: string[]): SizeQuantity[] => 
  allSizes.map(size => ({ size, quantity: 0, enabled: false, preorder: false }));

const createInitialFormData = (allSizes: string[]): ProductFormData => ({
  id: '',
  category: '',
  name: '',
  sizes: createInitialSizes(allSizes),
  price: 0,
  image1: '',
  image2: '',
  image3: '',
  image4: '',
  capsule: '',
  description: '',
  preorder: false,
  disabled: false,
});

interface ImageValidationState {
  url: string;
  status: 'idle' | 'loading' | 'valid' | 'invalid' | 'uploading';
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  productToEdit?: Product | null;
  onSuccess?: (product: Product, mode: 'add' | 'edit') => void;
  existingProducts?: Product[];
  sheetCategories?: string[];
  sheetSizes?: string[];
  sheetCapsules?: string[];
}

export function ProductForm({ open, onOpenChange, mode, productToEdit, onSuccess, existingProducts = [], sheetCategories = [], sheetSizes = [], sheetCapsules = [] }: ProductFormProps) {
  // Собираем уникальные категории, капсулы и размеры
  const { categoryOptions, capsuleOptions, sizeOptions } = useMemo(() => {
    // Категории из Google Sheets
    const categories = new Set<string>(sheetCategories.map(c => c.trim()).filter(Boolean));
    
    // Добавляем дефолтные если в таблице пусто
    if (categories.size === 0) {
      DEFAULT_CATEGORIES.forEach(c => categories.add(c));
    }
    
    // Капсулы из Google Sheets
    const capsules = new Set<string>(sheetCapsules.map(c => c.trim()).filter(Boolean));
    
    // Размеры из Google Sheets
    const sizes = new Set<string>(sheetSizes.map(s => s.trim()).filter(Boolean));
    
    // Добавляем дефолтные если в таблице пусто
    if (sizes.size === 0) {
      DEFAULT_SIZES.forEach(s => sizes.add(s));
    }

    // Добавляем категории/капсулы/размеры из существующих товаров (на случай если не синхронизированы)
    existingProducts.forEach(p => {
      if (p.category) {
        const normalized = p.category.trim();
        if (normalized) categories.add(normalized);
      }
      if (p.capsule) {
        const normalized = p.capsule.trim();
        if (normalized) capsules.add(normalized);
      }
      if (Array.isArray(p.sizes)) {
        p.sizes.forEach((size) => {
          const normalized = String(size || '').trim();
          if (normalized) sizes.add(normalized);
        });
      }
    });

    // При редактировании товар может содержать размеры, которых уже нет в справочнике catalog_sizes.
    // Их обязательно сохраняем в сетке, иначе при "Сохранить" можно случайно удалить строки/остатки.
    if (productToEdit?.sizes?.length) {
      productToEdit.sizes.forEach((size) => {
        const normalized = String(size || '').trim();
        if (normalized) sizes.add(normalized);
      });
    }

    // Сортировка размеров
    const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
    const sortedSizes = Array.from(sizes).sort((a, b) => {
      const indexA = SIZE_ORDER.indexOf(a.toUpperCase());
      const indexB = SIZE_ORDER.indexOf(b.toUpperCase());
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return 1;
      if (!isNaN(numB)) return -1;
      return a.localeCompare(b, 'ru');
    });

    return {
      categoryOptions: Array.from(categories).sort((a, b) => a.localeCompare(b, 'ru')),
      capsuleOptions: Array.from(capsules).sort((a, b) => a.localeCompare(b, 'ru')),
      sizeOptions: sortedSizes,
    };
  }, [existingProducts, sheetCategories, sheetSizes, sheetCapsules, productToEdit]);

  // Используем размеры из листа (или дефолтные)
  const allSizes = sizeOptions;

  const [formData, setFormData] = useState<ProductFormData>(createInitialFormData(allSizes));
  const { addProduct, updateProduct, isSubmitting, error } = useCatalogAdmin();
  const { uploadImage, isUploading, uploadProgress } = useImageUpload();
  const { toast } = useToast();
  
  // Состояние валидации изображений
  const [imageStates, setImageStates] = useState<Record<string, ImageValidationState>>({
    image1: { url: '', status: 'idle' },
    image2: { url: '', status: 'idle' },
    image3: { url: '', status: 'idle' },
    image4: { url: '', status: 'idle' },
  });

  // Drag states for file upload
  const [dragOver, setDragOver] = useState<string | null>(null);
  
  // Drag states for image reordering
  const [reorderDragIndex, setReorderDragIndex] = useState<number | null>(null);
  const [reorderOverIndex, setReorderOverIndex] = useState<number | null>(null);

  // File input refs
  const fileInputRefs = {
    image1: useRef<HTMLInputElement>(null),
    image2: useRef<HTMLInputElement>(null),
    image3: useRef<HTMLInputElement>(null),
    image4: useRef<HTMLInputElement>(null),
  };

  // Генерация нового ID
  const generateNewId = useCallback(() => {
    const existingIds = existingProducts.map(p => p.id);
    
    // Находим максимальный числовой ID
    let maxNumericId = 0;
    existingIds.forEach(id => {
      const num = parseInt(id);
      if (!isNaN(num) && num > maxNumericId) {
        maxNumericId = num;
      }
    });
    
    return String(maxNumericId + 1);
  }, [existingProducts]);

  const validateImage = (field: keyof ProductFormData, url: string) => {
    if (!url) {
      setImageStates(prev => ({
        ...prev,
        [field]: { url: '', status: 'idle' }
      }));
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setImageStates(prev => ({
        ...prev,
        [field]: { url, status: 'invalid' }
      }));
      return;
    }

    setImageStates(prev => ({
      ...prev,
      [field]: { url, status: 'loading' }
    }));

    const img = new Image();
    img.onload = () => {
      setImageStates(prev => ({
        ...prev,
        [field]: { url, status: 'valid' }
      }));
    };
    img.onerror = () => {
      setImageStates(prev => ({
        ...prev,
        [field]: { url, status: 'invalid' }
      }));
    };
    img.src = url;
  };

  // Заполнение формы при открытии
  useEffect(() => {
    if (open) {
      const currentAllSizes = sizeOptions; // Используем размеры из таблицы
      
      if (mode === 'edit' && productToEdit) {
        const productSizes = productToEdit.sizes || [];
        const isNoSizeProduct = productSizes.length === 0;
        setFormData({
          id: productToEdit.id,
          category: productToEdit.category || '',
          name: productToEdit.name,
          sizes: currentAllSizes.map(size => ({
            size,
            quantity: 0,
            enabled: productSizes.includes(size),
            preorder: productToEdit.preorderBySize?.[size] === true,
            quantitySet: undefined,
          })),
          price: productToEdit.price,
          image1: productToEdit.images[0] || '',
          image2: productToEdit.images[1] || '',
          image3: productToEdit.images[2] || '',
          image4: productToEdit.images[3] || '',
          capsule: productToEdit.capsule || '',
          description: productToEdit.description || '',
          preorder: productToEdit.preorder ?? false,
          disabled: productToEdit.disabled ?? false,
          noSizeQuantity: isNoSizeProduct ? 0 : undefined,
          noSizeQuantitySet: undefined,
        });
        
        // Валидируем изображения
        ['image1', 'image2', 'image3', 'image4'].forEach((key, index) => {
          const url = productToEdit.images[index] || '';
          if (url) validateImage(key as keyof ProductFormData, url);
          else setImageStates(prev => ({ ...prev, [key]: { url: '', status: 'idle' } }));
        });
      } else if (mode === 'add') {
        // Добавление нового товара
        if (productToEdit) {
          const productSizes = productToEdit.sizes || [];
          const stockBySize = productToEdit.stockBySize || {};
          const isNoSizeProduct = productSizes.length === 0;
          setFormData({
            id: generateNewId(),
            category: productToEdit.category || '',
            name: productToEdit.name,
            sizes: currentAllSizes.map(size => ({
              size,
              quantity: stockBySize[size] || 0,
              enabled: productSizes.includes(size),
              preorder: productToEdit.preorderBySize?.[size] === true,
            })),
            price: productToEdit.price,
            image1: productToEdit.images[0] || '',
            image2: productToEdit.images[1] || '',
            image3: productToEdit.images[2] || '',
            image4: productToEdit.images[3] || '',
            capsule: productToEdit.capsule || '',
            description: productToEdit.description || '',
            preorder: productToEdit.preorder ?? false,
            disabled: productToEdit.disabled ?? false,
            noSizeQuantity: isNoSizeProduct ? (productToEdit.stock ?? 0) : undefined,
          });
          
          ['image1', 'image2', 'image3', 'image4'].forEach((key, index) => {
            const url = productToEdit.images[index] || '';
            if (url) validateImage(key as keyof ProductFormData, url);
            else setImageStates(prev => ({ ...prev, [key]: { url: '', status: 'idle' } }));
          });
        } else {
          // Полностью новый товар - показываем все размеры, но все выключены
          setFormData({
            ...createInitialFormData(currentAllSizes),
            id: generateNewId(),
          });
          setImageStates({
            image1: { url: '', status: 'idle' },
            image2: { url: '', status: 'idle' },
            image3: { url: '', status: 'idle' },
            image4: { url: '', status: 'idle' },
          });
        }
      }
    }
  }, [open, mode, productToEdit, generateNewId, sizeOptions]);

  const handleChange = (field: keyof ProductFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    if (['image1', 'image2', 'image3', 'image4'].includes(field)) {
      validateImage(field, value as string);
    }
  };

  const handleSizeToggle = (sizeIndex: number, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => 
        i === sizeIndex ? { ...s, enabled, quantity: enabled ? (s.quantity || 1) : 0, preorder: enabled ? (s.preorder ?? false) : false } : s
      )
    }));
  };

  const handleSizeQuantityChange = (sizeIndex: number, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => 
        i === sizeIndex ? { ...s, quantity: Math.max(0, quantity) } : s
      )
    }));
  };

  const handleSizeQuantitySetChange = (sizeIndex: number, value: number | undefined) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => 
        i === sizeIndex ? { ...s, quantitySet: value === undefined ? undefined : Math.max(0, value) } : s
      )
    }));
  };

  const handleSizePreorderToggle = (sizeIndex: number, preorder: boolean) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.map((s, i) =>
        i === sizeIndex ? { ...s, preorder } : s
      )
    }));
  };

  const handleFileUpload = useCallback(async (file: File, field: 'image1' | 'image2' | 'image3' | 'image4') => {
    if (!isValidImageType(file)) {
      toast({
        title: 'Неверный формат',
        description: 'Поддерживаются: JPG, PNG, GIF, WEBP',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidImageSize(file)) {
      toast({
        title: 'Файл слишком большой',
        description: 'Максимальный размер: 32 MB',
        variant: 'destructive',
      });
      return;
    }

    setImageStates(prev => ({
      ...prev,
      [field]: { url: '', status: 'uploading' }
    }));

    const result = await uploadImage(file, field);

    if (result) {
      setFormData(prev => ({ ...prev, [field]: result.url }));
      setImageStates(prev => ({
        ...prev,
        [field]: { url: result.url, status: 'valid' }
      }));
      toast({
        title: 'Изображение загружено',
        description: 'URL добавлен в форму',
      });
    } else {
      setImageStates(prev => ({
        ...prev,
        [field]: { url: '', status: 'idle' }
      }));
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить изображение',
        variant: 'destructive',
      });
    }
  }, [uploadImage, toast]);

  const handleDragOver = useCallback((e: React.DragEvent, field: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(field);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, field: 'image1' | 'image2' | 'image3' | 'image4') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0], field);
    }
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, field: 'image1' | 'image2' | 'image3' | 'image4') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0], field);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  const clearImage = useCallback((field: 'image1' | 'image2' | 'image3' | 'image4') => {
    setFormData(prev => ({ ...prev, [field]: '' }));
    setImageStates(prev => ({
      ...prev,
      [field]: { url: '', status: 'idle' }
    }));
  }, []);

  // Image reorder: swap two image slots
  const swapImages = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const fields: ('image1' | 'image2' | 'image3' | 'image4')[] = ['image1', 'image2', 'image3', 'image4'];
    const fromField = fields[fromIndex];
    const toField = fields[toIndex];
    
    setFormData(prev => ({
      ...prev,
      [fromField]: prev[toField],
      [toField]: prev[fromField],
    }));
    
    setImageStates(prev => ({
      ...prev,
      [fromField]: prev[toField],
      [toField]: prev[fromField],
    }));
  }, []);

  const handleReorderDragStart = useCallback((index: number) => {
    setReorderDragIndex(index);
  }, []);

  const handleReorderDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (reorderDragIndex !== null && reorderDragIndex !== index) {
      setReorderOverIndex(index);
    }
  }, [reorderDragIndex]);

  const handleReorderDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (reorderDragIndex !== null && reorderDragIndex !== index) {
      swapImages(reorderDragIndex, index);
    }
    setReorderDragIndex(null);
    setReorderOverIndex(null);
  }, [reorderDragIndex, swapImages]);

  const handleReorderDragEnd = useCallback(() => {
    setReorderDragIndex(null);
    setReorderOverIndex(null);
  }, []);

  const handleGenerateId = () => {
    setFormData(prev => ({ ...prev, id: generateNewId() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.id || !formData.name || !formData.category || !formData.capsule) {
      toast({
        title: 'Ошибка',
        description: 'Заполните обязательные поля: ID, Название, Категория, Капсула',
        variant: 'destructive',
      });
      return;
    }

    const enabledSizes = formData.sizes.filter(s => s.enabled);
    const isNoSize = formData.noSizeQuantity != null;
    if (!isNoSize && enabledSizes.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Выберите хотя бы один размер или включите «Остаток без размера»',
        variant: 'destructive',
      });
      return;
    }
    if (!isNoSize && mode === 'add' && !formData.preorder) {
      const sizesWithQty = enabledSizes.filter(s => s.quantity > 0);
      const preorderSizes = enabledSizes.filter((s) => s.preorder === true);
      if (sizesWithQty.length === 0 && preorderSizes.length === 0) {
        toast({
          title: 'Ошибка',
          description: 'Укажите количество > 0 или включите «Под заказ» хотя бы для одного размера',
          variant: 'destructive',
        });
        return;
      }
    }

    let success = false;
    
    if (mode === 'edit') {
      success = await updateProduct(formData);
    } else {
      success = await addProduct(formData);
    }

    if (success) {
      const isNoSize = formData.noSizeQuantity != null;
      const rowCount = isNoSize ? 1 : enabledSizes.length;
      toast({
        title: 'Успешно',
        description: mode === 'edit'
          ? `Товар обновлён (${rowCount} ${rowCount === 1 ? 'строка' : rowCount < 5 ? 'строки' : 'строк'})`
          : `Добавлено ${rowCount} ${rowCount === 1 ? 'строка' : rowCount < 5 ? 'строки' : 'строк'} в таблицу`,
      });

      const newProduct: Product = isNoSize
        ? {
            id: formData.id,
            name: formData.name,
            price: formData.price,
            images: [formData.image1, formData.image2, formData.image3, formData.image4].filter(Boolean),
            category: formData.category,
            capsule: formData.capsule,
            description: formData.description,
            sizes: [],
            stock: formData.noSizeQuantity ?? 0,
            stockBySize: {},
            preorderBySize: {},
            preorder: formData.preorder,
            disabled: formData.disabled,
          }
        : (() => {
            const stockBySize: Record<string, number> = {};
            const preorderBySize: Record<string, boolean> = {};
            enabledSizes.forEach(s => {
              stockBySize[s.size] = s.quantity;
              preorderBySize[s.size] = s.preorder === true;
            });
            return {
              id: formData.id,
              name: formData.name,
              price: formData.price,
              images: [formData.image1, formData.image2, formData.image3, formData.image4].filter(Boolean),
              category: formData.category,
              capsule: formData.capsule,
              description: formData.description,
              sizes: enabledSizes.map(s => s.size),
              stockBySize,
              preorderBySize,
              preorder: formData.preorder || enabledSizes.some((s) => s.preorder === true),
              disabled: formData.disabled,
            };
          })();

      onOpenChange(false);
      onSuccess?.(newProduct, mode);
    } else {
      toast({
        title: 'Ошибка',
        description: error || 'Не удалось сохранить товар',
        variant: 'destructive',
      });
    }
  };

  const renderImageInput = (field: 'image1' | 'image2' | 'image3' | 'image4', label: string) => {
    const state = imageStates[field];
    const value = formData[field];
    const progress = uploadProgress[field];
    const isDragging = dragOver === field;
    
    return (
      <div className="space-y-2">
        <Label className="text-gray-600 text-xs">{label}</Label>
        
        <div
          className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
            isDragging 
              ? 'border-blue-400 bg-blue-50' 
              : state.status === 'valid' 
                ? 'border-green-300 bg-green-50' 
                : state.status === 'invalid'
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
          }`}
          onDragOver={(e) => handleDragOver(e, field)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, field)}
        >
          <input
            ref={fileInputRefs[field]}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => handleFileInputChange(e, field)}
            className="hidden"
          />

          {state.status === 'uploading' ? (
            <div className="h-28 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <p className="text-xs text-gray-500">Загрузка... {progress || 0}%</p>
              <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress || 0}%` }}
                />
              </div>
            </div>
          ) : state.status === 'valid' && value ? (
            <div className="relative h-28 group">
              <img 
                src={value} 
                alt="Preview" 
                className="w-full h-full object-cover"
                onError={() => setImageStates(prev => ({ ...prev, [field]: { url: value, status: 'invalid' } }))}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearImage(field)}
                  className="text-white hover:text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="absolute top-2 right-2">
                <Check className="w-5 h-5 text-green-500 drop-shadow-lg" />
              </div>
            </div>
          ) : (
            <div 
              className="h-28 flex flex-col items-center justify-center gap-2 cursor-pointer"
              onClick={() => fileInputRefs[field].current?.click()}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDragging ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Upload className={`w-5 h-5 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              </div>
              <p className="text-xs text-gray-400 text-center px-2">
                {isDragging ? 'Отпустите файл' : 'Перетащите или нажмите'}
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <Input
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder="или вставьте URL"
            className={`text-xs h-8 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 pr-8 ${
              state.status === 'invalid' ? 'border-red-300' : 
              state.status === 'valid' ? 'border-green-300' : ''
            }`}
            aria-label={label}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {state.status === 'loading' && (
              <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
            )}
            {state.status === 'valid' && (
              <Check className="w-3 h-3 text-green-500" />
            )}
            {state.status === 'invalid' && (
              <X className="w-3 h-3 text-red-500" />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] w-full h-full bg-white border-gray-200 p-0 flex flex-col"
        hideCloseButton
      >
        <DialogHeader className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-gray-900">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              {mode === 'edit' ? (
                <Save className="w-5 h-5 text-blue-600" />
              ) : (
                <Plus className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <span className="text-xl">
              {mode === 'edit' ? 'Редактировать товар' : 'Добавить товар'}
            </span>
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 h-11 w-11 min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 touch-manipulation"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          <form id="product-form" onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto pb-4">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Основное</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="id" className="text-gray-700">ID товара *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="id"
                        value={formData.id}
                        onChange={(e) => handleChange('id', e.target.value)}
                        placeholder="например: 1"
                        disabled={mode === 'edit'}
                        className={`bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 ${
                          mode === 'edit' ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''
                        }`}
                        aria-label="ID товара"
                      />
                      {mode === 'add' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleGenerateId}
                          className="border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 shrink-0"
                          title="Сгенерировать ID"
                          aria-label="Сгенерировать ID"
                        >
                          <Wand2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {mode === 'edit' && (
                      <p className="text-xs text-gray-400">ID нельзя изменить</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-700">Название *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Футболка базовая"
                      className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                      aria-label="Название товара"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-gray-700">Цена (₸)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.price}
                      onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                      className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                      aria-label="Цена в тенге"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-gray-700">Категория *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => handleChange('category', value)}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900" aria-label="Категория">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capsule" className="text-gray-700">Капсула *</Label>
                    <Select
                      value={formData.capsule}
                      onValueChange={(value) => handleChange('capsule', value)}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900" aria-label="Капсула">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {capsuleOptions.map((cap) => (
                          <SelectItem key={cap} value={cap} className="text-gray-700 focus:bg-gray-100">
                            {cap}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer h-10">
                      <input
                        type="checkbox"
                        checked={formData.preorder}
                        onChange={(e) => handleChange('preorder', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Под заказ (для товара без размера)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer h-10 ml-4">
                      <input
                        type="checkbox"
                        checked={formData.disabled === true}
                        onChange={(e) => handleChange('disabled', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Отключить товар</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Размеры и количество</h3>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.noSizeQuantity != null}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          noSizeQuantity: checked ? (prev.noSizeQuantity ?? 0) : undefined,
                          noSizeQuantitySet: checked ? undefined : undefined,
                        }));
                      }}
                      className="border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Товар без размера (один остаток)</span>
                  </label>
                  {formData.noSizeQuantity != null && (
                    <div className="flex flex-wrap items-center gap-4">
                      {mode === 'edit' && (
                        <span className="text-sm text-muted-foreground">
                          Сейчас: {productToEdit?.stock ?? 0} шт.
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <Label htmlFor="noSizeQuantity" className="text-sm text-gray-700 whitespace-nowrap">
                          {mode === 'edit' ? 'Добавить (шт.)' : 'Кол-во'}
                        </Label>
                        <Input
                          id="noSizeQuantity"
                          type="number"
                          min={0}
                          value={formData.noSizeQuantity}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              noSizeQuantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="w-24 h-8 text-sm font-medium text-gray-900 bg-gray-50 border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        />
                        <span className="text-xs text-gray-500">шт.</span>
                      </div>
                      {mode === 'edit' && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor="noSizeQuantitySet" className="text-sm text-gray-700 whitespace-nowrap">Остаток (установить)</Label>
                          <Input
                            id="noSizeQuantitySet"
                            type="number"
                            min={0}
                            value={formData.noSizeQuantitySet ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setFormData(prev => ({
                                ...prev,
                                noSizeQuantitySet: v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0),
                              }));
                            }}
                            placeholder="—"
                            className="w-24 h-8 text-sm font-medium text-gray-900 bg-gray-50 border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                          />
                          <span className="text-xs text-gray-500">шт.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={`${formData.noSizeQuantity != null ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Table className="bg-white border border-gray-300 rounded-md">
                    <TableHeader>
                      <TableRow className="bg-gray-100 hover:bg-gray-100 border-gray-300">
                        <TableHead className="w-10 text-gray-800 font-semibold"> </TableHead>
                        <TableHead className="text-gray-800 font-semibold">Размер</TableHead>
                        {mode === 'edit' && <TableHead className="text-gray-800 font-semibold">Сейчас</TableHead>}
                        <TableHead className="text-gray-800 font-semibold">{mode === 'edit' ? 'Добавить (шт.)' : 'Кол-во'}</TableHead>
                        {mode === 'edit' && <TableHead className="text-gray-800 font-semibold">Остаток (установить)</TableHead>}
                        <TableHead className="text-gray-800 font-semibold">Под заказ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.sizes.map((sizeData, index) => (
                        <TableRow
                          key={sizeData.size}
                          className={sizeData.enabled ? 'bg-blue-50/70 border-blue-200' : 'bg-white'}
                        >
                          <TableCell className="py-2">
                            <Checkbox
                              id={`size-${sizeData.size}`}
                              checked={sizeData.enabled}
                              onCheckedChange={(checked) => handleSizeToggle(index, checked as boolean)}
                              className="border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Label
                              htmlFor={`size-${sizeData.size}`}
                              className={`font-semibold cursor-pointer ${sizeData.enabled ? 'text-gray-900' : 'text-gray-700'}`}
                            >
                              {sizeData.size}
                            </Label>
                          </TableCell>
                          {mode === 'edit' && (
                            <TableCell className="py-2 text-gray-800 text-sm font-semibold">
                              {productToEdit?.stockBySize?.[sizeData.size] ?? 0} шт.
                            </TableCell>
                          )}
                          <TableCell className="py-2">
                            {sizeData.enabled && (
                              <Input
                                type="number"
                                min={0}
                                value={mode === 'edit' ? sizeData.quantity : sizeData.quantity}
                                onChange={(e) => handleSizeQuantityChange(index, parseInt(e.target.value, 10) || 0)}
                                placeholder={mode === 'edit' ? '0' : 'Кол-во'}
                                className="h-8 w-24 text-base font-semibold text-gray-900 bg-white border-2 border-gray-400 placeholder:text-gray-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/30"
                                aria-label={mode === 'edit' ? `Добавить для ${sizeData.size}` : `Кол-во ${sizeData.size}`}
                              />
                            )}
                          </TableCell>
                          {mode === 'edit' && (
                            <TableCell className="py-2">
                              {sizeData.enabled && (
                                <Input
                                  type="number"
                                  min={0}
                                  value={sizeData.quantitySet ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    handleSizeQuantitySetChange(index, v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0));
                                  }}
                                  placeholder="—"
                                  className="h-8 w-24 text-base font-semibold text-gray-900 bg-white border-2 border-gray-400 placeholder:text-gray-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/30"
                                  aria-label={`Установить остаток для ${sizeData.size}`}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell className="py-2">
                            {sizeData.enabled && (
                              <Checkbox
                                checked={sizeData.preorder === true}
                                onCheckedChange={(checked) => handleSizePreorderToggle(index, checked === true)}
                                className="border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-gray-600">
                  Для каждого выбранного размера будет создана отдельная строка в таблице
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Изображения
                  <span className="text-gray-400 font-normal ml-2">перетащите для изменения порядка</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['image1', 'image2', 'image3', 'image4'] as const).map((field, index) => (
                    <div
                      key={field}
                      draggable={!!formData[field]}
                      onDragStart={() => handleReorderDragStart(index)}
                      onDragOver={(e) => handleReorderDragOver(e, index)}
                      onDrop={(e) => {
                        // Only handle reorder if we're reordering (not file upload)
                        if (reorderDragIndex !== null) {
                          handleReorderDrop(e, index);
                        }
                      }}
                      onDragEnd={handleReorderDragEnd}
                      className={`relative transition-all ${
                        reorderOverIndex === index && reorderDragIndex !== null ? 'ring-2 ring-blue-400 rounded-xl' : ''
                      } ${reorderDragIndex === index ? 'opacity-50' : ''}`}
                    >
                      {/* Position badge and move arrows */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-400">#{index + 1}</span>
                        <div className="flex gap-1">
                          {index > 0 && formData[field] && (
                            <button
                              type="button"
                              onClick={() => swapImages(index, index - 1)}
                              className="p-0.5 text-gray-400 hover:text-gray-600"
                              title="Переместить влево"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {index < 3 && formData[field] && (
                            <button
                              type="button"
                              onClick={() => swapImages(index, index + 1)}
                              className="p-0.5 text-gray-400 hover:text-gray-600"
                              title="Переместить вправо"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {formData[field] && (
                            <GripVertical className="w-3 h-3 text-gray-300 cursor-grab" />
                          )}
                        </div>
                      </div>
                      {renderImageInput(field, index === 0 ? 'Главное фото' : `Фото ${index + 1}`)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Описание</h3>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Описание товара..."
                  rows={3}
                  className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 resize-none"
                  aria-label="Описание товара"
                />
              </div>

            </form>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 flex justify-end gap-3">
            <Button 
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Отмена
            </Button>
            <Button 
              type="submit"
              form="product-form"
              disabled={isSubmitting || isUploading} 
              className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-8"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === 'edit' ? 'Сохранение...' : 'Добавление...'}
                </>
              ) : (
                <>
                  {mode === 'edit' ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Сохранить изменения
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить товар
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}
