import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  OrderEventsService,
  type OrderPaidEvent,
} from '../order-events.service';
import { CorrelationService } from '../../correlation/correlation.service';

@Controller()
export class OrderEventsController {
  constructor(
    private readonly orderEventsService: OrderEventsService,
    private readonly correlationService: CorrelationService,
  ) {}

  @EventPattern('order.paid')
  async handleOrderPaid(@Payload() payload: OrderPaidEvent) {
    await this.correlationService.run(payload.correlationId, () =>
      this.orderEventsService.handleOrderPaid(payload),
    );
  }
}
