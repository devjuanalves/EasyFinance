import { requirePermission } from '../settings/permissions.js';
import { applyInvestmentCommand as apply } from '../../../../../packages/shared/src/investmentCommands.js';
export { blankInvestment } from '../../../../../packages/shared/src/investmentCommands.js';
export function applyInvestmentCommand(
  original,
  context,
  action,
  payload = {},
) {
  requirePermission(original, context);
  return apply(original, context, action, payload);
}
