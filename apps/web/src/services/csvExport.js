export function csvText(rows) {
  const safe = (value) => {
    let s = String(value ?? '');
    // Strict signed decimal literals remain numeric for exported amounts.
    // Everything else with a formula/control prefix is explicitly text.
    const numeric = /^-?\d+(?:\.\d+)?$/.test(s);
    if (!numeric && /^(?:[\t\r\n]|\s*[=+\-@])/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + rows.map((row) => row.map(safe).join(',')).join('\r\n');
}
