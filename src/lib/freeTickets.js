import supabase from '@/lib/customSupabaseClient';
import { getFunctionErrorMessage } from '@/lib/functionErrors';

export async function claimFreeTicket({ eventId, ticketType }) {
  const { data, error } = await supabase.functions.invoke('claim-free-ticket', {
    body: {
      eventId,
      ticketType,
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, 'No fue posible emitir la entrada'));
  }
  if (!data?.success || !data?.ticket_number) {
    throw new Error(data?.error || 'No fue posible emitir la entrada');
  }

  return data;
}
