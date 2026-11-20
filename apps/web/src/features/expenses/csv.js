import { csvText } from '../../services/csvExport.js';
export { csvText } from '../../services/csvExport.js';
export {
  MAX_FILE_SIZE,
  validateStatementFile,
  parseCSV,
  suggestMapping,
  parseAmount,
  parseStatementDate,
  mapStatement,
} from '../../../../../packages/shared/src/statementCsv.js';
export function downloadCSV(rows, name = 'easyfinance-transactions.csv') {
  const url = URL.createObjectURL(
    new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
