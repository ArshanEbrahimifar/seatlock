import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateEventSeatDto {
  @IsUUID()
  seatId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;
}
