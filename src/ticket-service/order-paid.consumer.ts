import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { type OrderPaidEvent } from '../contracts/order-paid.event';
import { TicketingService } from './ticketing.service';

@Controller()
export class OrderPaidConsumer {
  constructor(private readonly ticketingService: TicketingService) {}

  @EventPattern('order.paid')
  async handleOrderPaid(@Payload() event: OrderPaidEvent): Promise<void> {
    await this.ticketingService.handleOrderPaid(event);
  }
}
