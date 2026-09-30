export type OrderPaidEvent = {
  eventId: string;
  orderId: string;
  eventSeatId: string;
  amount: string;
  paidAt: string;
  correlationId?: string;
};
