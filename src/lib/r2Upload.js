import supabase from '@/lib/customSupabaseClient';

export async function uploadToR2(file, folder) {
  const { data, error } = await supabase.functions.invoke('get-upload-url', {
    body: {
      filename: file.name,
      contentType: file.type,
      folder,
      fileSizeBytes: file.size,
    },
  });
  if (error) throw new Error(error.message || 'Error solicitando URL de subida');
  if (data?.error) throw new Error(data.error);

  const putResp = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putResp.ok) throw new Error('Error subiendo el archivo al almacenamiento');

  return data.publicUrl;
}
