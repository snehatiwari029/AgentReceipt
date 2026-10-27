import type { DisputeEvent, DisputeEventType } from '../shared/schemas'

export const DISPUTE_STATUS: Record<DisputeEventType, string> = {
  opened: 'Dispute received',
  recommendation: 'Recommendation made',
  conceded: 'Conceded',
  represented: 'Represented',
  pack_generated: 'Evidence pack ready',
  outcome_won: 'Won',
  outcome_lost: 'Lost',
}

// A dispute's status is its latest event (events are in chain order).
export function disputeStatus(events: DisputeEvent[]): string {
  return events.length === 0 ? DISPUTE_STATUS.opened : DISPUTE_STATUS[events[events.length - 1].event_type]
}
