/**
 * Formats a raw ID into a display-friendly ticket ID.
 * Takes the last 3+ chars and uppercases them.
 */
export function formatTicketId(id: string): string {
  const suffix = id.slice(-4).toUpperCase();
  return `TKT-${suffix}`;
}

/**
 * Returns a Tailwind text color class for a given priority level.
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'CRITICAL':
      return 'text-red-600';
    case 'HIGH':
      return 'text-orange-500';
    case 'MEDIUM':
      return 'text-yellow-500';
    case 'LOW':
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Returns a human-readable label for a ticket status.
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'RESOLVED':
      return 'Resolved';
    case 'CLOSED':
      return 'Closed';
    default:
      return status;
  }
}

export function getChannelLabel(channel: string | null): string {
  switch (channel) {
    case 'EMAIL':
      return 'Email';
    case 'CHAT':
      return 'Chat';
    case 'PHONE':
      return 'Phone';
    case 'WEB':
      return 'Web';
    default:
      return 'N/A';
  }
}

export function getProductAreas(): string[] {
  return [
    'Authentication',
    'Billing',
    'Dashboard',
    'API',
    'Mobile',
    'General',
  ];
}
