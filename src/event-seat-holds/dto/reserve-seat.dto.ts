import { IsUUID } from 'class-validator';

export class ReserveSeatDto {
  @IsUUID()
  holdToken!: string;
}
