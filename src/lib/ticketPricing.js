const NON_REVENUE_TYPES = new Set(['cortesía', 'cortesia']);

function normalizedTicketType(value) {
  return String(value ?? '').trim().toLocaleLowerCase('es-CO');
}

function validMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function formatTicketPrice(price) {
  const value = validMoney(price);
  if (value === null || value === 0) return 'Gratis';
  return `$${value.toLocaleString('es-CO')}`;
}

export function getPublicTicketTiers(event) {
  if (Array.isArray(event?.ticket_types) && event.ticket_types.length > 0) {
    const configured = event.ticket_types
      .filter(ticket => (
        ticket?.active !== false
        && ticket?.name
        && !NON_REVENUE_TYPES.has(normalizedTicketType(ticket.name))
        && Number(ticket?.capacity) > 0
      ))
      .map(ticket => ({
        ...ticket,
        name: String(ticket.name),
        price: validMoney(ticket.price) ?? 0,
        capacity: Math.max(1, Number(ticket.capacity) || 1),
      }));
    if (configured.length > 0) return configured;
  }

  return [{
    name: 'General',
    price: validMoney(event?.price) ?? 0,
    capacity: Math.max(1, Number(event?.tickets_total) || 1),
    sales_end_at: event?.date || null,
  }];
}

export function getEventPriceLabel(event) {
  const tiers = getPublicTicketTiers(event);
  const distinctPrices = [...new Set(tiers.map(ticket => ticket.price))];
  if (distinctPrices.length <= 1) return formatTicketPrice(distinctPrices[0] ?? event?.price);
  const minimum = Math.min(...distinctPrices);
  return minimum === 0 ? 'Gratis y pago' : `Desde ${formatTicketPrice(minimum)}`;
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

export function sumAttendeeRevenue(attendees, event) {
  const countedTransactions = new Set();

  return (Array.isArray(attendees) ? attendees : [])
    .filter(ticket => ['valid', 'used', 'pending_registration'].includes(ticket?.ticket_status))
    .reduce((total, ticket) => {
      if (NON_REVENUE_TYPES.has(normalizedTicketType(ticket?.ticket_type))) return total;

      const transactionAmount = validMoney(ticket?.amount_total);
      const transactionReference = String(ticket?.wompi_reference ?? '').trim();
      if (transactionAmount !== null && transactionReference) {
        if (countedTransactions.has(transactionReference)) return total;
        countedTransactions.add(transactionReference);
        return total + transactionAmount;
      }

      return total + getTicketTierPrice(event, ticket?.ticket_type);
    }, 0);
}
