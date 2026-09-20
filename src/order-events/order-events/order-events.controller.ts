import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import {
  OrderEventsService,
  type OrderPaidEvent,
} from '../order-events.service';

@Controller()
export class OrderEventsController {
  constructor(private readonly orderEventsService: OrderEventsService) {}

  @EventPattern('order.paid')
  async handleOrderPaid(@Payload() payload: OrderPaidEvent) {
    await this.orderEventsService.handleOrderPaid(payload);
  }
}
