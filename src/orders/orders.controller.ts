import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post(':orderId/pay')
  pay(
    @Param('orderId', new ParseUUIDPipe())
    orderId: string,
  ) {
    return this.ordersService.pay(orderId);
  }

  @Post(':orderId/cancel')
  cancel(
    @Param('orderId', new ParseUUIDPipe())
    orderId: string,
  ) {
    return this.ordersService.cancel(orderId);
  }

  @Post(':orderId/expire')
  expire(
    @Param('orderId', new ParseUUIDPipe())
    orderId: string,
  ) {
    return this.ordersService.expire(orderId);
  }
}
