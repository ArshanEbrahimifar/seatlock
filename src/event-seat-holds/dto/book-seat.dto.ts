import { IsUUID } from 'class-validator';

export class BookSeatDto {
  @IsUUID()
  holdToken!: string;
}
