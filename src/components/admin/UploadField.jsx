import React, { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import supabase from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

export function UploadField({ label, bucket, accept, value, onChange, required = false, pathPrefix = '', hint = '', previewAspect = '' }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFileName(file.name);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${pathPrefix}${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast({ title: 'Archivo subido', description: file.name });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al subir archivo', description: err.message });
      setFileName('');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    onChange('');
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <Label>{label}{required && ' *'}</Label>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      <div className="flex gap-2 mt-1">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setFileName(''); }}
          placeholder="Pega una URL o usa el botón para subir…"
          className="bg-background border-border text-foreground text-xs"
        />
        {value && (
          <Button type="button" variant="ghost" size="icon" onClick={clear} className="shrink-0 text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="shrink-0 border-border"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          title="Subir archivo"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </Button>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      </div>
      {fileName && !uploading && (
        <p className="text-[11px] text-muted-foreground mt-1 truncate">✓ {fileName}</p>
      )}
      {value && previewAspect && (
        <div
          className="mt-2 w-full overflow-hidden rounded-lg border border-border bg-black/20"
          style={{ aspectRatio: previewAspect }}
        >
          <img src={value} alt={`Vista previa: ${label}`} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
