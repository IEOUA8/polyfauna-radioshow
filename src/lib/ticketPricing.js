const NON_REVENUE_TYPES = new Set(['cortesía', 'cortesia']);

function normalizedTicketType(value) {
  return String(value ?? '').trim().toLocaleLowerCase('es-CO');
}

function validMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function getTicketTierPrice(event, ticketType) {
  const normalizedType = normalizedTicketType(ticketType);
  if (NON_REVENUE_TYPES.has(normalizedType)) return 0;

  const tier = Array.isArray(event?.ticket_types)
    ? event.ticket_types.find(item => normalizedTicketType(item?.name) === normalizedType)
    : null;
  const tierPrice = validMoney(tier?.price);
  if (tierPrice !== null) return tierPrice;

  return validMoney(event?.price) ?? 0;
}

export function getTicketSaleAmount(ticket) {
  if (NON_REVENUE_TYPES.has(normalizedTicketType(ticket?.ticket_type))) return 0;

  const transactionAmount = validMoney(ticket?.sale?.amount_total);
  const quantity = Number(ticket?.sale?.quantity);
  if (transactionAmount !== null && Number.isInteger(quantity) && quantity > 0) {
    return Math.round(transactionAmount / quantity);
  }

  return getTicketTierPrice(ticket?.events, ticket?.ticket_type);
}

export function sumTicketRevenue(tickets) {
  return (Array.isArray(tickets) ? tickets : [])
    .reduce((total, ticket) => total + getTicketSaleAmount(ticket), 0);
}
