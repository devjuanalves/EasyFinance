import { money } from '../finance/data/calculations.js';
export const displayMoney = (value, currency) =>
  value === null || value === undefined
    ? 'Unavailable'
    : money(value, currency);
