import React, { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadToR2 } from '@/lib/r2Upload';

export function R2UploadField({
  label,
  folder,
  accept,
  value,
  onChange,
  required = false,
  extractMetadata = null,
}) {
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
      const metadata = extractMetadata ? await extractMetadata(file) : null;
      const publicUrl = await uploadToR2(file, folder);
      onChange(publicUrl, metadata);
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
    </div>
  );
}
