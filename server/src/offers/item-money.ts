import { BadRequestException } from '@nestjs/common';

const MAX_CENTS = 99999999999999n;

/** Количество до тысячных; округление строки до копеек по half-up. */
export function lineTotalCents(unitPrice: number, quantity: number): bigint {
  const cents = BigInt(unitPrice.toFixed(2).replace('.', ''));
  const thousandths = BigInt(quantity.toFixed(3).replace('.', ''));
  const total = (cents * thousandths + 500n) / 1000n;
  assertTotalFits(total);
  return total;
}

export function assertTotalFits(cents: bigint): void {
  if (cents < 0n || cents > MAX_CENTS)
    throw new BadRequestException('Сумма позиций превышает допустимый предел');
}

export function centsToMoney(cents: bigint): number {
  return Number(cents) / 100;
}
