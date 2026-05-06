import { useState, useRef, useMemo } from 'react';
import { Product } from '@/types/catalog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ImportRow } from '@/types/admin';

export type { ImportRow };

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: Product[];
  onImport: (rows: ImportRow[]) => Promise<boolean>;
}

function makeKey(id: string, size: string): string {
  const trimId = String(id).trim();
  const trimSize = String(size || '').trim();
  return trimSize ? `${trimId}_${trimSize}` : trimId;
}

function parseCSV(text: string): string[][] {
  // Remove BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ';') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current.trim());
        current = '';
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  // Last row
  row.push(current.trim());
  if (row.some(cell => cell !== '')) rows.push(row);

  return rows;
}

const EXPECTED_HEADERS = ['ID', 'Категория', 'Название', 'Размер', 'Остаток', 'Цена', 'Фото 1', 'Фото 2', 'Фото 3', 'Фото 4', 'Капсула', 'Описание', 'Предзаказ'];

function mapRowToImport(cells: string[]): ImportRow | null {
  const id = cells[0]?.trim();
  const name = cells[2]?.trim();
  const price = parseFloat(cells[5]) || 0;

  if (!id || !name) return null;

  return {
    id,
    category: cells[1]?.trim() || '',
    name,
    size: cells[3]?.trim() || '',
    quantity: parseInt(cells[4]) || 0,
    price,
    image1: cells[6]?.trim() || '',
    image2: cells[7]?.trim() || '',
    image3: cells[8]?.trim() || '',
    image4: cells[9]?.trim() || '',
    capsule: cells[10]?.trim() || '',
    description: cells[11]?.trim() || '',
    preorder: (cells[12]?.trim() || '').toLowerCase() === 'да' || cells[12]?.trim() === 'true',
  };
}

export function ImportDialog({ open, onOpenChange, existingProducts, onImport }: ImportDialogProps) {
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build existing keys set
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    existingProducts.forEach(p => {
      if (p.sizes.length === 0) {
        keys.add(String(p.id).trim());
      } else {
        p.sizes.forEach(size => {
          keys.add(makeKey(p.id, size));
        });
      }
    });
    return keys;
  }, [existingProducts]);

  // Stats
  const stats = useMemo(() => {
    let toUpdate = 0;
    let toAdd = 0;
    parsedRows.forEach(row => {
      const key = makeKey(row.id, row.size);
      if (existingKeys.has(key)) {
        toUpdate++;
      } else {
        toAdd++;
      }
    });
    return { total: parsedRows.length, toUpdate, toAdd };
  }, [parsedRows, existingKeys]);

  const handleFileSelect = (file: File) => {
    setParseError(null);
    setParsedRows([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);

        if (rows.length < 2) {
          setParseError('Файл пуст или содержит только заголовки');
          return;
        }

        // Validate headers loosely
        const headers = rows[0].map(h => h.trim());
        if (!headers.some(h => h.toUpperCase() === 'ID') || !headers.some(h => h === 'Название')) {
          setParseError('Неверный формат файла. Ожидаемые колонки: ' + EXPECTED_HEADERS.join('; '));
          return;
        }

        const dataRows = rows.slice(1);
        const parsed: ImportRow[] = [];
        const errors: string[] = [];

        dataRows.forEach((cells, idx) => {
          const row = mapRowToImport(cells);
          if (row) {
            parsed.push(row);
          } else {
            errors.push(`Строка ${idx + 2}: пропущена (нет ID или Названия)`);
          }
        });

        if (parsed.length === 0) {
          setParseError('Не удалось распарсить ни одной строки');
          return;
        }

        if (errors.length > 0 && errors.length <= 5) {
          setParseError(`Предупреждения: ${errors.join(', ')}`);
        }

        setParsedRows(parsed);
      } catch {
        setParseError('Ошибка при чтении файла');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setProgress(10);

    try {
      setProgress(30);
      const success = await onImport(parsedRows);
      setProgress(100);

      if (success) {
        setTimeout(() => {
          setParsedRows([]);
          setFileName('');
          setImporting(false);
          setProgress(0);
          onOpenChange(false);
        }, 500);
      } else {
        setImporting(false);
        setProgress(0);
        setParseError('Ошибка при импорте. Попробуйте ещё раз.');
      }
    } catch {
      setImporting(false);
      setProgress(0);
      setParseError('Ошибка при импорте');
    }
  };

  const reset = () => {
    setParsedRows([]);
    setParseError(null);
    setFileName('');
    setProgress(0);
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { reset(); onOpenChange(v); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Импорт товаров</DialogTitle>
          <DialogDescription>
            Загрузите CSV-файл в формате экспорта. Разделитель — точка с запятой (;).
          </DialogDescription>
        </DialogHeader>

        {parsedRows.length === 0 && !importing ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Перетащите CSV-файл сюда</p>
            <p className="text-gray-400 text-sm mt-1">или нажмите для выбора</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
            />
          </div>
        ) : null}

        {parseError && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span>{fileName}</span>
              <Button variant="ghost" size="sm" onClick={reset} className="ml-auto text-gray-500 h-7">
                Другой файл
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <div className="text-2xl font-semibold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-500">Строк в файле</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-2xl font-semibold text-blue-600">{stats.toUpdate}</div>
                <div className="text-xs text-blue-600">Обновление</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-semibold text-green-600">{stats.toAdd}</div>
                <div className="text-xs text-green-600">Новых</div>
              </div>
            </div>

            {/* Preview table */}
            <div className="max-h-[250px] overflow-auto border border-gray-200 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-500 text-xs">ID</TableHead>
                    <TableHead className="text-gray-500 text-xs">Название</TableHead>
                    <TableHead className="text-gray-500 text-xs">Размер</TableHead>
                    <TableHead className="text-gray-500 text-xs">Остаток</TableHead>
                    <TableHead className="text-gray-500 text-xs">Цена</TableHead>
                    <TableHead className="text-gray-500 text-xs">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 20).map((row, i) => {
                    const key = makeKey(row.id, row.size);
                    const isUpdate = existingKeys.has(key);
                    return (
                      <TableRow key={i} className="text-sm">
                        <TableCell className="py-1.5 text-gray-900">{row.id}</TableCell>
                        <TableCell className="py-1.5 text-gray-900 max-w-[200px] truncate">{row.name}</TableCell>
                        <TableCell className="py-1.5 text-gray-600">{row.size || '—'}</TableCell>
                        <TableCell className="py-1.5 text-gray-600">{row.quantity}</TableCell>
                        <TableCell className="py-1.5 text-gray-600">{row.price}</TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant={isUpdate ? 'secondary' : 'default'} className={isUpdate ? 'bg-blue-100 text-blue-700 text-xs' : 'bg-green-100 text-green-700 text-xs'}>
                            {isUpdate ? 'Обновление' : 'Новый'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {parsedRows.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 text-sm py-2">
                        ... и ещё {parsedRows.length - 20} строк
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-gray-500 text-center">Импорт...</p>
              </div>
            )}
          </div>
        )}

        {parsedRows.length > 0 && !importing && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Отмена
            </Button>
            <Button onClick={handleImport} className="bg-blue-600 hover:bg-blue-700 text-white">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Импортировать ({stats.total} строк)
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
