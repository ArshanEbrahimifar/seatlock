import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OrderEventsService } from '../order-events/order-events.service';

type OrderPaidEvent = {
  correlationId: string;
  eventId: string;
  orderId: string;
  eventSeatId: string;
  amount: string;
  paidAt: string;
};

@Controller()
export class OrderPaidConsumer {
  constructor(private readonly orderEventsService: OrderEventsService) {}

  @EventPattern('order.paid')
  async handleOrderPaid(@Payload() event: OrderPaidEvent): Promise<void> {
    await this.orderEventsService.handleOrderPaid(event);
  }
}
