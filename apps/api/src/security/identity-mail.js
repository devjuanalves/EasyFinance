import { ApiError } from '../validation/contracts.js';
const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export function identityDelivery(config, transport) {
  if (
    transport &&
    (config.nodeEnv !== 'test' ||
      transport.kind !== 'test' ||
      typeof transport.send !== 'function')
  )
    throw new Error(
      'Only an explicitly injected isolated test transport is supported.',
    );
  const origin = new URL(config.webOrigin);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.origin !== config.webOrigin
  )
    throw new Error('Invalid application origin');
  return {
    available: Boolean(transport),
    async send({ type, email, token }) {
      if (!transport)
        throw new ApiError(
          503,
          'DELIVERY_UNAVAILABLE',
          'Email delivery is unavailable. No message has been sent.',
        );
      if (
        !['reset', 'verify', 'change'].includes(type) ||
        !/^[a-f0-9]{64}$/.test(token) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
        throw new Error('Invalid identity message');
      const url = `${origin.origin}/${type === 'reset' ? 'reset-password' : 'verify-email'}#token=${token}`;
      const title =
        type === 'reset'
          ? 'Reset your EasyFinance password'
          : type === 'change'
            ? 'Confirm your new EasyFinance email'
            : 'Verify your EasyFinance email';
      // Never return the payload to an HTTP caller. Test inspection is injected in-process only.
      await transport.send({
        to: email,
        subject: title,
        text: `${title}\n${url}\nIf you did not request this, ignore this message.`,
        html: `<p>${escape(title)}</p><p><a href="${escape(url)}">Continue securely</a></p><p>If you did not request this, ignore this message.</p>`,
      });
    },
  };
}
