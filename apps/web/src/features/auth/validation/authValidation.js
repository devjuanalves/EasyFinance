export const PASSWORD_MIN_LENGTH = 12;
export const DEFAULT_PREFERENCES = Object.freeze({
  language: 'en-AU',
  workspaceName: 'Personal Finance',
  workspaceType: 'personal',
  currency: 'AUD',
  dateFormat: 'DD/MM/YYYY',
  timeZone: 'Australia/Sydney',
});
export const LANGUAGES = {
  'en-AU': 'English (Australia)',
  'en-US': 'English (United States)',
  'pt-BR': 'Português (Brasil)',
};
export const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'BRL', 'NZD', 'CAD'];
export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
export function emailError(value = '') {
  if (!value.trim()) return 'Enter your email address.';
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
    return 'Enter a valid email address.';
}
export function validateLogin(values) {
  const errors = {};
  if (emailError(values.email)) errors.email = emailError(values.email);
  if (!values.password) errors.password = 'Enter your password.';
  return errors;
}
export function validateSignUp(values) {
  const errors = validateLogin(values);
  if (!values.fullName?.trim()) errors.fullName = 'Enter your full name.';
  else if (values.fullName.trim().length > 100)
    errors.fullName = 'Use 100 characters or fewer.';
  // A length-only policy supports passphrases without arbitrary composition rules.
  if (values.password && values.password.length < PASSWORD_MIN_LENGTH)
    errors.password = 'Use at least 12 characters.';
  if (!values.confirmPassword)
    errors.confirmPassword = 'Confirm your password.';
  else if (values.password !== values.confirmPassword)
    errors.confirmPassword = 'Passwords do not match.';
  if (!values.consent)
    errors.consent = 'Confirm that you understand this is a demo.';
  return errors;
}
export function validateOnboarding(values, step) {
  const errors = {};
  if (step === 0) {
    if (!values.fullName?.trim()) errors.fullName = 'Enter your full name.';
    else if (values.fullName.trim().length > 100)
      errors.fullName = 'Use 100 characters or fewer.';
    if (!Object.hasOwn(LANGUAGES, values.language))
      errors.language = 'Select a language.';
  }
  if (step === 1) {
    if (!values.workspaceName?.trim())
      errors.workspaceName = 'Enter a workspace name.';
    else if (values.workspaceName.trim().length > 80)
      errors.workspaceName = 'Use 80 characters or fewer.';
    if (!['personal', 'shared'].includes(values.workspaceType))
      errors.workspaceType = 'Select a workspace type.';
  }
  if (step === 2) {
    if (!CURRENCIES.includes(values.currency))
      errors.currency = 'Select a currency.';
    if (!DATE_FORMATS.includes(values.dateFormat))
      errors.dateFormat = 'Select a date format.';
    try {
      if (!values.timeZone) throw new Error();
      new Intl.DateTimeFormat('en', { timeZone: values.timeZone });
    } catch {
      errors.timeZone = 'Select a valid time zone.';
    }
  }
  return errors;
}
