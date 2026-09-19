import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class OrderEventsController {
  @EventPattern('order.paid')
  handleOrderPaid(
    @Payload()
    payload: {
      eventId: string;
      orderId: string;
      eventSeatId: string;
      amount: string;
      paidAt: string;
    },
  ) {
    console.log('ORDER_PAID received:', payload);
  }
}
