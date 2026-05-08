import { useState, useMemo, useEffect } from 'react';
import { Product } from '@/types/catalog';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ImageLightbox } from '@/components/catalog/ImageLightbox';
import { Package, RefreshCw, Search, Copy, Edit, Plus, ArrowUp, ArrowDown, Trash2, ChevronLeft, ChevronRight, Download, Upload, Eye, EyeOff } from 'lucide-react';
import { ImportDialog, ImportRow } from '@/components/admin/ImportDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function formatTimeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин. назад`;
  const h = Math.floor(min / 60);
  return `${h} ч. назад`;
}

interface ProductsTableProps {
  products: Product[];
  loading: boolean;
  onRefresh: () => void;
  onCopyProduct?: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
  onAddProduct?: () => void;
  onDeleteProduct?: (product: Product) => void;
  onToggleDisabled?: (product: Product) => void;
  onImport?: (rows: ImportRow[]) => Promise<boolean>;
  lastUpdatedAt?: number;
}

type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export function ProductsTable({ 
  products, 
  loading, 
  onRefresh, 
  onCopyProduct,
  onEditProduct,
  onAddProduct,
  onDeleteProduct,
  onToggleDisabled,
  onImport,
  lastUpdatedAt,
}: ProductsTableProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [capsuleFilter, setCapsuleFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  // Сохраняем количество на странице в localStorage
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('admin_items_per_page');
    return saved ? parseInt(saved, 10) : 10;
  });

  // При изменении itemsPerPage сохраняем в localStorage
  const handleItemsPerPageChange = (value: string) => {
    const newValue = parseInt(value, 10);
    setItemsPerPage(newValue);
    localStorage.setItem('admin_items_per_page', value);
  };
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Получаем уникальные капсулы, категории и размеры
  const { capsules, categories, sizes } = useMemo(() => {
    const capsuleSet = new Set<string>();
    const categorySet = new Set<string>();
    const sizeSet = new Set<string>();
    
    products.forEach(p => {
      if (p.capsule) capsuleSet.add(p.capsule);
      if (p.category) categorySet.add(p.category);
      if (p.sizes) p.sizes.forEach(s => sizeSet.add(s));
    });
    
    // Сортировка размеров
    const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];
    const sortedSizes = Array.from(sizeSet).sort((a, b) => {
      const indexA = SIZE_ORDER.indexOf(a.toUpperCase());
      const indexB = SIZE_ORDER.indexOf(b.toUpperCase());
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b, 'ru');
    });
    
    return {
      capsules: Array.from(capsuleSet).sort(),
      categories: Array.from(categorySet).sort(),
      sizes: sortedSizes,
    };
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];
    
    // Фильтрация по поиску (debounced)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(product => 
        String(product.id ?? '').toLowerCase().includes(query) ||
        String(product.name ?? '').toLowerCase().includes(query)
      );
    }
    
    // Фильтрация по капсуле
    if (capsuleFilter !== 'all') {
      result = result.filter(p => p.capsule === capsuleFilter);
    }
    
    // Фильтрация по категории
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }
    
    // Фильтрация по размеру
    if (sizeFilter !== 'all') {
      result = result.filter(p => p.sizes?.includes(sizeFilter));
    }
    
    // Фильтрация по статусу
    if (statusFilter === 'enabled') {
      result = result.filter(p => !p.disabled);
    } else if (statusFilter === 'disabled') {
      result = result.filter(p => p.disabled);
    }
    
    // Сортировка по ID (id из таблицы может быть числом)
    result.sort((a, b) => {
      const strA = String(a.id ?? '');
      const strB = String(b.id ?? '');
      const numA = parseInt(strA, 10) || 0;
      const numB = parseInt(strB, 10) || 0;
      if (!isNaN(parseInt(strA, 10)) && !isNaN(parseInt(strB, 10))) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      const comparison = strA.localeCompare(strB, 'ru', { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [products, debouncedSearchQuery, capsuleFilter, categoryFilter, sizeFilter, statusFilter, sortDirection]);

  // Пагинация
  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProducts.slice(start, start + itemsPerPage);
  }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

  // Сброс страницы при изменении фильтров (но НЕ при изменении itemsPerPage)
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, capsuleFilter, categoryFilter, sizeFilter, statusFilter]);

  const toggleSort = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCapsuleFilter('all');
    setCategoryFilter('all');
    setSizeFilter('all');
    setStatusFilter('all');
    setSortDirection('asc');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery.trim() || capsuleFilter !== 'all' || categoryFilter !== 'all' || sizeFilter !== 'all' || statusFilter !== 'all';

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (productToDelete && onDeleteProduct) {
      onDeleteProduct(productToDelete);
    }
    setDeleteDialogOpen(false);
    setProductToDelete(null);
  };

  const exportToExcel = () => {
    // Формируем данные для экспорта - каждый размер в отдельной строке; товары без размера — одна строка
    const dataToExport: Array<Record<string, string | number>> = [];

    const pushRow = (
      id: string | number,
      category: string,
      name: string,
      size: string,
      stock: number,
      price: number,
      images: string[],
      capsule: string,
      description: string | undefined,
      preorder: boolean
    ) => {
      dataToExport.push({
        ID: id,
        Категория: category || '',
        Название: name,
        Размер: size,
        Остаток: stock,
        Цена: price,
        'Фото 1': images[0] || '',
        'Фото 2': images[1] || '',
        'Фото 3': images[2] || '',
        'Фото 4': images[3] || '',
        Капсула: capsule || '',
        Описание: description || '',
        Предзаказ: preorder ? 'Да' : '',
      });
    };

    filteredAndSortedProducts.forEach(product => {
      const stockBySize = product.stockBySize || {};
      if (product.sizes.length > 0) {
        product.sizes.forEach(size => {
          const stock = stockBySize[size] || 0;
          pushRow(
            product.id,
            product.category || '',
            product.name,
            size,
            stock,
            product.price,
            product.images || [],
            product.capsule || '',
            product.description,
            !!product.preorder
          );
        });
      } else {
        pushRow(
          product.id,
          product.category || '',
          product.name,
          '',
          product.stock ?? 0,
          product.price,
          product.images || [],
          product.capsule || '',
          product.description,
          !!product.preorder
        );
      }
    });

    if (dataToExport.length === 0) return;

    // Создаём CSV
    const headers = Object.keys(dataToExport[0]);
    const csvRows = [
      headers.join(';'),
      ...dataToExport.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Экранируем кавычки и оборачиваем в кавычки если есть спецсимволы
          const stringValue = String(value ?? '');
          if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(';')
      )
    ];
    
    const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM для корректного отображения кириллицы
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            {/* Верхняя строка */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                Товары
                <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600">
                  {filteredAndSortedProducts.length} из {products.length}
                </Badge>
              </CardTitle>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={exportToExcel}
                  disabled={loading || filteredAndSortedProducts.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт
                </Button>
                {onImport && (
                  <Button
                    size="sm"
                    onClick={() => setImportDialogOpen(true)}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Импорт
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={onRefresh}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  aria-label="Обновить данные"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
                <Button
                  size="sm"
                  onClick={onAddProduct}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  aria-label="Добавить товар"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить товар
                </Button>
                {lastUpdatedAt != null && !loading && (
                  <span className="text-xs text-gray-500">Обновлено {formatTimeAgo(lastUpdatedAt)}</span>
                )}
              </div>
            </div>
            
            {/* Строка фильтров */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по ID или названию..."
                  className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                  aria-label="Поиск по ID или названию"
                />
              </div>
              
              <Select value={capsuleFilter} onValueChange={setCapsuleFilter}>
                <SelectTrigger className="w-[160px] h-8 bg-white border-gray-200">
                  <SelectValue placeholder="Все капсулы" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 z-50">
                  <SelectItem value="all" className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                    Все капсулы
                  </SelectItem>
                  {capsules.map(cap => (
                    <SelectItem key={cap} value={cap} className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                      {cap}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] h-8 bg-white border-gray-200">
                  <SelectValue placeholder="Все категории" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 z-50">
                  <SelectItem value="all" className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                    Все категории
                  </SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger className="w-[140px] h-8 bg-white border-gray-200">
                  <SelectValue placeholder="Все размеры" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 z-50">
                  <SelectItem value="all" className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                    Все размеры
                  </SelectItem>
                  {sizes.map(size => (
                    <SelectItem key={size} value={size} className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8 bg-white border-gray-200">
                  <SelectValue placeholder="Все статусы" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 z-50">
                  <SelectItem value="all" className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                    Все статусы
                  </SelectItem>
                  <SelectItem value="enabled" className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                    <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Включённые</span>
                  </SelectItem>
                  <SelectItem value="disabled" className="text-gray-900 focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
                    <span className="flex items-center gap-1.5"><EyeOff className="w-3.5 h-3.5" /> Отключённые</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                >
                  Сбросить
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {hasActiveFilters ? 'Товары не найдены' : 'Нет товаров'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={clearFilters}
                  className="text-blue-600 hover:text-blue-700 mt-2"
                >
                  Сбросить фильтры
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-transparent">
                      <TableHead className="text-gray-500">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleSort}
                          className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 -ml-3 h-8"
                          aria-label={sortDirection === 'asc' ? 'Сортировка по ID: по возрастанию. Нажмите для убывания' : 'Сортировка по ID: по убыванию. Нажмите для возрастания'}
                        >
                          ID
                          {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-gray-500">Фото</TableHead>
                      <TableHead className="text-gray-500">Название</TableHead>
                      <TableHead className="text-gray-500">Категория</TableHead>
                      <TableHead className="text-gray-500">Капсула</TableHead>
                      <TableHead className="text-gray-500">Размеры / Остатки</TableHead>
                      <TableHead className="text-gray-500">Цена</TableHead>
                      <TableHead className="text-gray-500 w-[150px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow 
                        key={product.id} 
                        className={`border-gray-100 transition-colors ${product.disabled ? 'opacity-60 bg-gray-50/80 hover:bg-gray-100/80' : 'hover:bg-gray-50'}`}
                      >
                        <TableCell className="font-mono text-xs text-gray-600">{product.id}</TableCell>
                        <TableCell>
                          {product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setZoomedImage(product.images[0])}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 max-w-[200px]">
                          <span className="truncate block">{product.name}</span>
                          {product.disabled && (
                            <Badge variant="secondary" className="mt-1 bg-amber-100 text-amber-800 border-0 text-xs">
                              Отключён
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-600">{product.category}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className="bg-blue-100 text-blue-700 border-0"
                          >
                            {product.capsule}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.sizes.length > 0 ? (
                              product.sizes.map((size) => {
                                const qty = product.stockBySize?.[size] || 0;
                                return (
                                  <Badge 
                                    key={size} 
                                    variant="outline" 
                                    className={`text-xs ${
                                      qty > 0 
                                        ? 'border-green-300 text-green-700 bg-green-50' 
                                        : 'border-gray-200 text-gray-400'
                                    }`}
                                  >
                                    {size}: {qty}
                                  </Badge>
                                );
                              })
                            ) : (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  (product.stock ?? 0) > 0 
                                    ? 'border-green-300 text-green-700 bg-green-50' 
                                    : 'border-gray-200 text-gray-400'
                                }`}
                              >
                                Остаток: {product.stock ?? 0}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">
                          {product.price.toLocaleString('ru-RU')} ₸
                        </TableCell>
                        <TableCell className="w-[150px]">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditProduct?.(product)}
                              className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 min-h-9 min-w-9 p-0 touch-manipulation"
                              title="Редактировать"
                              aria-label={`Редактировать ${product.name}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onCopyProduct?.(product)}
                              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 min-h-9 min-w-9 p-0 touch-manipulation"
                              title="Копировать"
                              aria-label={`Копировать ${product.name}`}
                            >
                            <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onToggleDisabled?.(product)}
                              className={`min-h-9 min-w-9 p-0 touch-manipulation ${product.disabled ? 'text-amber-500 hover:text-green-600 hover:bg-green-50' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
                              title={product.disabled ? 'Включить товар' : 'Отключить товар'}
                              aria-label={product.disabled ? `Включить ${product.name}` : `Отключить ${product.name}`}
                            >
                              {product.disabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(product)}
                              className="text-gray-400 hover:text-red-600 hover:bg-red-50 min-h-9 min-w-9 p-0 touch-manipulation"
                              title="Удалить"
                              aria-label={`Удалить ${product.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Пагинация */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  {filteredAndSortedProducts.length >= itemsPerPage ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>Показывать по</span>
                      <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                        <SelectTrigger className="w-[70px] h-8 bg-white border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          {ITEMS_PER_PAGE_OPTIONS.map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      Страница {currentPage} из {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0 border-gray-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0 border-gray-200"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Zoom фото — тот же лайтбокс, что в каталоге (адаптив + мобильный свайп) */}
      <ImageLightbox
        images={zoomedImage ? [zoomedImage] : []}
        currentIndex={0}
        isOpen={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
        onNavigate={() => {}}
      />

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить товар?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить товар "{productToDelete?.name}"? 
              Это действие нельзя отменить. Все размеры и данные товара будут удалены из таблицы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200">Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог импорта */}
      {onImport && (
        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          existingProducts={products}
          onImport={onImport}
        />
      )}
    </>
  );
}
