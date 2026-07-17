export function getEventImage(event, variant = 'banner') {
  if (!event) return '';

  if (variant === 'ticket') {
    return event.ticket_image_url || event.image_url || event.mobile_image_url || '';
  }

  if (variant === 'mobile' || variant === 'compact') {
    return event.mobile_image_url || event.image_url || event.ticket_image_url || '';
  }

  return event.image_url || event.mobile_image_url || event.ticket_image_url || '';
}

export function getEventMobileSource(event) {
  return event?.mobile_image_url || '';
}
