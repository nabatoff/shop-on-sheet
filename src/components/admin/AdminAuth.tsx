import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ShieldCheck } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

interface AdminAuthProps {
  onAuthenticated: () => void;
}

export function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const sb = getSupabase();
      const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authErr || !authData.user) {
        setError(authErr?.message || 'Неверный логин или пароль');
        setIsLoading(false);
        return;
      }

      const { data: profile, error: profErr } = await sb
        .from('profiles')
        .select('is_admin')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profErr || !profile?.is_admin) {
        await sb.auth.signOut();
        setError('У этого аккаунта нет прав администратора');
        setIsLoading(false);
        return;
      }

      onAuthenticated();
    } catch {
      setError('Ошибка входа');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a1628]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative bg-[#0f1d32]/90 border-white/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Админ-панель</CardTitle>
          <CardDescription className="text-white/50">
            Email и пароль администратора (Supabase Auth)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="admin@company.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">
                Пароль
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50 focus:ring-blue-500/20"
                  aria-label="Пароль администратора"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                  <span className="inline-block w-1 h-1 bg-red-400 rounded-full" />
                  {error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 h-11 font-medium"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Вход...
                </span>
              ) : (
                'Войти'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
