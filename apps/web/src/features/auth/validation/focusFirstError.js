export function focusFirstError(form) {
  requestAnimationFrame(() =>
    form.querySelector('[aria-invalid="true"]')?.focus(),
  );
}
