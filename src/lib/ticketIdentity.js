import supabase from '@/lib/customSupabaseClient';

const normalizeDocumentNumber = (value) => String(value || '').replace(/\D/g, '');

export function validateTicketIdentity({ fullName, documentNumber }) {
  const normalizedName = String(fullName || '').trim().replace(/\s+/g, ' ');
  const normalizedDocument = normalizeDocumentNumber(documentNumber);

  if (normalizedName.length < 3 || !normalizedName.includes(' ')) {
    throw new Error('Ingresa tu nombre completo y apellido.');
  }
  if (normalizedDocument.length < 5 || normalizedDocument.length > 12) {
    throw new Error('Ingresa un número de cédula válido.');
  }

  return {
    fullName: normalizedName,
    documentNumber: normalizedDocument,
  };
}

export async function loadTicketIdentity(userId) {
  if (!userId) return { fullName: '', documentNumber: '' };

  const { data, error } = await supabase
    .from('user_identity')
    .select('full_name, document_number')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message || 'No fue posible cargar tu identificación.');
  return {
    fullName: data?.full_name || '',
    documentNumber: data?.document_number || '',
  };
}

export async function saveTicketIdentity({ userId, fullName, documentNumber }) {
  if (!userId) throw new Error('Inicia sesión para registrar tu identificación.');
  const normalized = validateTicketIdentity({ fullName, documentNumber });

  const { error } = await supabase
    .from('user_identity')
    .upsert({
      user_id: userId,
      full_name: normalized.fullName,
      document_type: 'CC',
      document_number: normalized.documentNumber,
    });

  if (error) throw new Error(error.message || 'No fue posible guardar tu identificación.');
  return normalized;
}
