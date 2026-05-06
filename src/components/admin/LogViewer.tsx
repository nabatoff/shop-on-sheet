import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, History, Trash2 } from 'lucide-react';
import type { LogEntry } from '@/types/admin';
import { useToast } from '@/hooks/use-toast';

interface LogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchLogs: (limit?: number) => Promise<{ logs: LogEntry[]; total: number }>;
  clearLogs: () => Promise<{ success: boolean; error?: string }>;
}

export function LogViewer({ open, onOpenChange, fetchLogs, clearLogs }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [limit, setLimit] = useState(50);
  const { toast } = useToast();

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchLogs(limit);
      setLogs(result.logs);
      setTotal(result.total);
    } finally {
      setIsLoading(false);
    }
  }, [fetchLogs, limit]);

  useEffect(() => {
    if (open) {
      loadLogs();
    }
  }, [open, loadLogs]);

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      await clearLogs();
      setLogs([]);
      setTotal(0);
      toast({
        title: 'Журнал очищен',
        description: 'Все записи удалены',
      });
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить журнал',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Успех') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Успех</Badge>;
    }
    if (status === 'Ошибка') {
      return <Badge variant="destructive">Ошибка</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const getActionColor = (action: string) => {
    if (action.includes('Добавление')) return 'text-green-700';
    if (action.includes('Удаление')) return 'text-red-700';
    if (action.includes('Обновление')) return 'text-blue-700';
    if (action.includes('Ошибка') || action.includes('Критическая')) return 'text-red-800 font-semibold';
    return 'text-gray-800';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden bg-white p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <History className="h-5 w-5 text-indigo-600" />
            Журнал действий
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Показано: {logs.length} из {total}
            </span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isClearing || logs.length === 0}
                  className="bg-white text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  {isClearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span className="ml-2">Очистить</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Очистить журнал?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Все записи журнала будут удалены. Это действие нельзя отменить.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearLogs}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Очистить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Обновить</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Журнал пуст
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {log.date} {log.time}
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      <div className={`font-semibold text-base ${getActionColor(log.action)}`}>
                        {log.action}
                      </div>
                      <div className="text-sm text-gray-600 mt-1.5 break-words leading-relaxed">
                        {log.details}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
