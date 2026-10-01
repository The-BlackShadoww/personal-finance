import { formatMoney } from './format';
import { canonicalLocale } from './locale';

describe('formatMoney', () => {
  it('formats US dollars', () => {
    expect(formatMoney(150050, { currency: 'USD', locale: 'en-US' })).toBe(
      '$1,500.50',
    );
  });

  it('formats taka with its symbol and Latin digits', () => {
    expect(formatMoney(150050, { currency: 'BDT', locale: 'en-US' })).toBe(
      '৳1,500.50',
    );
  });

  it('uses the ISO code in PDFs when the symbol is outside Latin-1', () => {
    expect(
      formatMoney(
        150050,
        { currency: 'BDT', locale: 'en-US' },
        { forPdf: true },
      ),
    ).toBe('BDT 1,500.50');
  });

  it('uses breakable spaces in PDFs and keeps lakh grouping', () => {
    expect(
      formatMoney(
        -3000000000,
        { currency: 'BDT', locale: 'en-IN' },
        { forPdf: true },
      ),
    ).toBe('-BDT 3,00,00,000.00');
  });

  it('keeps Latin-1 and euro symbols for PDFs', () => {
    expect(
      formatMoney(
        150050,
        { currency: 'GBP', locale: 'en-GB' },
        { forPdf: true },
      ),
    ).toBe('£1,500.50');
    expect(
      formatMoney(
        150050,
        { currency: 'EUR', locale: 'en-IE' },
        { forPdf: true },
      ),
    ).toBe('€1,500.50');
  });

  it('uses locale grouping, e.g. the Indian lakh system', () => {
    expect(formatMoney(123456750, { currency: 'INR', locale: 'en-IN' })).toBe(
      '₹12,34,567.50',
    );
  });

  it('rounds zero-decimal currencies for display', () => {
    expect(formatMoney(150000, { currency: 'JPY', locale: 'ja-JP' })).toBe(
      '￥1,500',
    );
  });

  it('formats amounts beyond the old 32-bit cents limit', () => {
    expect(
      formatMoney(500_000_000_000, { currency: 'USD', locale: 'en-US' }),
    ).toBe('$5,000,000,000.00');
  });
});

describe('canonicalLocale', () => {
  it('canonicalises valid tags', () => {
    expect(canonicalLocale('en-us')).toBe('en-US');
    expect(canonicalLocale('bn-BD')).toBe('bn-BD');
  });

  it('rejects invalid tags', () => {
    expect(canonicalLocale('not a locale')).toBeNull();
  });
});
