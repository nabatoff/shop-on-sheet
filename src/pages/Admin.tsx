import { useState, useEffect, useCallback } from 'react';
import { AdminAuth } from '@/components/admin/AdminAuth';
import { ProductForm } from '@/components/admin/ProductForm';
import { ProductsTable } from '@/components/admin/ProductsTable';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { SizeManager } from '@/components/admin/SizeManager';
import { CapsuleManager } from '@/components/admin/CapsuleManager';
import { LogViewer } from '@/components/admin/LogViewer';
import { OrderManager } from '@/components/admin/OrderManager';
import { useCatalog } from '@/hooks/useCatalog';
import { useCatalogAdmin } from '@/hooks/useCatalogAdmin';
import type { CapsuleData, ImportRow } from '@/types/admin';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, LogOut, FolderOpen, Ruler, Box, History, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Product } from '@/types/catalog';
import { useToast } from '@/hooks/use-toast';

async function loadIsAdmin(): Promise<boolean> {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return false;
  const { data: profile } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .maybeSingle();
  return !!profile?.is_admin;
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { data, loading, error, refetch, dataUpdatedAt } = useCatalog();
  const { deleteProduct, toggleDisabled, bulkImport, fetchProducts, fetchCategories, fetchSizes, fetchCapsules, fetchLogs, clearLogs } = useCatalogAdmin();
  const { toast } = useToast();
  
  // Локальный список товаров для оптимистичного обновления
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  
  // Категории из Google Sheets
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  
  // Размеры из Google Sheets
  const [sizes, setSizes] = useState<string[]>([]);
  const [sizeManagerOpen, setSizeManagerOpen] = useState(false);
  
  // Капсулы из Google Sheets
  const [capsules, setCapsules] = useState<CapsuleData[]>([]);
  const [capsuleManagerOpen, setCapsuleManagerOpen] = useState(false);
  
  // Журнал действий
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  // Заказы
  const [ordersOpen, setOrdersOpen] = useState(false);
  
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchProducts().then((products) => {
      if (!cancelled && products.length > 0) setLocalProducts(products);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, fetchProducts]);

  useEffect(() => {
    if (data?.products && data.products.length > 0 && localProducts.length === 0) {
      setLocalProducts(data.products);
    }
  }, [data?.products, localProducts.length]);

  useEffect(() => {
    const loadCategories = async () => {
      const cats = await fetchCategories();
      setCategories(cats.sort((a, b) => a.localeCompare(b, 'ru')));
    };
    loadCategories();
  }, [fetchCategories]);
  
  useEffect(() => {
    const loadSizes = async () => {
      const s = await fetchSizes();
      setSizes(s);
    };
    loadSizes();
  }, [fetchSizes]);
  
  useEffect(() => {
    const loadCapsules = async () => {
      const caps = await fetchCapsules();
      setCapsules(caps.sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    };
    loadCapsules();
  }, [fetchCapsules]);
  
  // Состояние модального окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    (async () => {
      try {
        const ok = await loadIsAdmin();
        if (!cancelled && ok) setIsAuthenticated(true);
      } catch {
        /* нет env или сеть */
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();

    try {
      const sb = getSupabase();
      const { data } = sb.auth.onAuthStateChange(async (_evt, session) => {
        if (!session?.user) {
          setIsAuthenticated(false);
          return;
        }
        try {
          const ok = await loadIsAdmin();
          setIsAuthenticated(ok);
        } catch {
          setIsAuthenticated(false);
        }
      });
      subscription = data.subscription;
    } catch {
      /* VITE_SUPABASE_* не заданы */
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await getSupabase().auth.signOut();
    setIsAuthenticated(false);
  };

  const handleRefresh = async () => {
    const products = await fetchProducts();
    if (products.length > 0) setLocalProducts(products);
    else refetch();
  };

  // Открыть модалку для добавления
  const handleAddProduct = () => {
    setModalMode('add');
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  // Открыть модалку для редактирования
  const handleEditProduct = (product: Product) => {
    setModalMode('edit');
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  // Копирование товара
  const handleCopyProduct = (product: Product) => {
    setModalMode('add');
    setEditingProduct({
      ...product,
      id: '',
    });
    setIsModalOpen(true);
  };

  // Оптимистичное обновление после успешного добавления/редактирования
  const handleProductSuccess = useCallback((product: Product, mode: 'add' | 'edit') => {
    if (mode === 'add') {
      // Добавляем новый товар в начало списка
      setLocalProducts(prev => [product, ...prev]);
    } else {
      // Обновляем существующий товар
      setLocalProducts(prev => 
        prev.map(p => p.id === product.id ? product : p)
      );
    }
  }, []);

  // Удаление товара
  const handleDeleteProduct = async (product: Product) => {
    setLocalProducts(prev => prev.filter(p => p.id !== product.id));
    
    const success = await deleteProduct(product.id);
    if (success) {
      toast({ title: 'Товар удалён', description: `Товар "${product.name}" успешно удалён` });
    } else {
      setLocalProducts(prev => [...prev, product]);
      toast({ title: 'Ошибка', description: 'Не удалось удалить товар', variant: 'destructive' });
    }
  };

  // Включение/отключение товара
  const handleToggleDisabled = async (product: Product) => {
    const newDisabled = !product.disabled;
    // Оптимистичное обновление
    setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, disabled: newDisabled } : p));
    
    const success = await toggleDisabled(product.id, newDisabled);
    if (success) {
      toast({ title: newDisabled ? 'Товар отключён' : 'Товар включён', description: `Товар "${product.name}" ${newDisabled ? 'скрыт из каталога' : 'снова виден в каталоге'}` });
    } else {
      setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, disabled: !newDisabled } : p));
      toast({ title: 'Ошибка', description: 'Не удалось изменить состояние товара', variant: 'destructive' });
    }
  };

  // Импорт товаров
  const handleImport = async (rows: ImportRow[]): Promise<boolean> => {
    const success = await bulkImport(rows);
    if (success) {
      toast({
        title: 'Импорт завершён',
        description: `Импортировано ${rows.length} строк`,
      });
      // Актуальные строки merch_lines после импорта
      const products = await fetchProducts();
      if (products.length > 0) setLocalProducts(products);
      else setTimeout(() => refetch(), 1000);
    } else {
      toast({
        title: 'Ошибка импорта',
        description: 'Не удалось выполнить импорт',
        variant: 'destructive',
      });
    }
    return success;
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminAuth onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <Link to="/">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 min-w-[36px]"
                >
                  <ArrowLeft className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">На сайт</span>
                </Button>
              </Link>
              <div className="h-5 sm:h-6 w-px bg-gray-200 hidden sm:block" />
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Админ-панель</h1>
            </div>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 ml-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCategoryManagerOpen(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 min-w-[36px]"
                title="Категории"
              >
                <FolderOpen className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Категории</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSizeManagerOpen(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 min-w-[36px]"
                title="Размеры"
              >
                <Ruler className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Размеры</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCapsuleManagerOpen(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 min-w-[36px]"
                title="Капсулы"
              >
                <Box className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Капсулы</span>
              </Button>
              <div className="h-5 w-px bg-gray-200 hidden sm:block" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setOrdersOpen(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 min-w-[36px]"
                title="Заказы"
              >
                <ShoppingCart className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Заказы</span>
              </Button>
              <div className="h-5 w-px bg-gray-200 hidden sm:block" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLogViewerOpen(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 min-w-[36px]"
                title="Журнал"
              >
                <History className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Журнал</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-9 min-w-[36px]"
                title="Выйти"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Выйти</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Таблица товаров */}
        {error ? (
          <Card className="bg-white border-gray-200">
            <CardContent className="p-8 text-center space-y-3">
              <p className="text-red-500">{error}</p>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Проверьте <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> и миграции в Supabase.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ProductsTable
            products={localProducts}
            loading={loading}
            onRefresh={handleRefresh}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onCopyProduct={handleCopyProduct}
            onDeleteProduct={handleDeleteProduct}
            onToggleDisabled={handleToggleDisabled}
            onImport={handleImport}
            lastUpdatedAt={dataUpdatedAt}
          />
        )}
      </main>

      {/* Модальное окно формы */}
      <ProductForm
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        mode={modalMode}
        productToEdit={editingProduct}
        onSuccess={handleProductSuccess}
        existingProducts={localProducts}
        sheetCategories={categories}
        sheetSizes={sizes}
        sheetCapsules={capsules.map(c => c.name)}
      />

      {/* Менеджер категорий */}
      <CategoryManager
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        categories={categories}
        onCategoriesChange={setCategories}
        existingProducts={localProducts}
      />

      {/* Менеджер размеров */}
      <SizeManager
        open={sizeManagerOpen}
        onOpenChange={setSizeManagerOpen}
        sizes={sizes}
        onSizesChange={setSizes}
        existingProducts={localProducts}
      />

      {/* Менеджер капсул */}
      <CapsuleManager
        open={capsuleManagerOpen}
        onOpenChange={setCapsuleManagerOpen}
        capsules={capsules}
        onCapsulesChange={setCapsules}
        existingProducts={localProducts}
      />

      {/* Журнал действий */}
      <LogViewer
        open={logViewerOpen}
        onOpenChange={setLogViewerOpen}
        fetchLogs={fetchLogs}
        clearLogs={clearLogs}
      />

      {/* Заказы */}
      <OrderManager
        open={ordersOpen}
        onOpenChange={setOrdersOpen}
        products={localProducts}
      />
    </div>
  );
}
