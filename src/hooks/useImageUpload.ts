import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';

interface UploadResult {
  url: string;
  deleteUrl: string;
  thumbUrl: string;
}

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const uploadImage = async (file: File, fieldId: string): Promise<UploadResult | null> => {
    setIsUploading(true);
    setUploadProgress((prev) => ({ ...prev, [fieldId]: 10 }));

    try {
      const sb = getSupabase();
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session?.user) {
        console.error('[useImageUpload] Нет сессии администратора');
        return null;
      }

      const safe =
        file.name.replace(/[^\w.\-()+]/g, '_').slice(0, 100) ||
        `${file.type?.split('/')[1] || 'img'}.${(file.type && file.type.split('/')[1]) || 'bin'}`;
      const path = `admin-uploads/${Date.now()}_${crypto.randomUUID().slice(0, 10)}_${safe}`;

      setUploadProgress((prev) => ({ ...prev, [fieldId]: 40 }));

      const { error } = await sb.storage.from('merch-images').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

      setUploadProgress((prev) => ({ ...prev, [fieldId]: 85 }));

      if (error) {
        console.error('Supabase Storage upload:', error.message);
        return null;
      }

      const pub = sb.storage.from('merch-images').getPublicUrl(path);
      const url = pub.data.publicUrl;

      setUploadProgress((prev) => ({ ...prev, [fieldId]: 100 }));

      return {
        url,
        deleteUrl: '',
        thumbUrl: url,
      };
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      }, 800);
    }
  };

  return { uploadImage, isUploading, uploadProgress };
}

export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(file.type);
}

export function isValidImageSize(file: File): boolean {
  const maxSize = 32 * 1024 * 1024; // не выше лимита bucket storage (см. миграцию merch-images)
  return file.size <= maxSize;
}
