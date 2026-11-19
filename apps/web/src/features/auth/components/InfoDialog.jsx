import { API_MODE } from '../../../services/persistentApi.js';
import { useEffect, useRef } from 'react';
import { DEMO_CREDENTIALS } from '../services/authService.js';
export default function InfoDialog({ topic, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (topic) ref.current.showModal();
    else ref.current.close();
  }, [topic]);
  return (
    <dialog
      className="info-dialog"
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="dialog-title"
    >
      <h2 id="dialog-title">{topic === 'Support' ? 'Demo support' : topic}</h2>
      {topic === 'Support' && API_MODE ? (
        <p>
          Use your registered local development account. Demo credentials cannot
          access persistent records. Email recovery and social sign-in are not
          available.
        </p>
      ) : topic === 'Support' ? (
        <>
          <p>
            Use the development account to explore the simulated sign-in flow.
          </p>
          <dl>
            <dt>Email</dt>
            <dd>{DEMO_CREDENTIALS.email}</dd>
            <dt>Password</dt>
            <dd>{DEMO_CREDENTIALS.password}</dd>
          </dl>
          <p>
            No real account or persistent session is created. Refreshing signs
            you out.
          </p>
        </>
      ) : (
        <p>
          This local demonstration has no published {topic?.toLowerCase()}.
          Registration is simulated and does not create an account or constitute
          acceptance of a production agreement. Do not enter real personal
          information.
        </p>
      )}
      <button type="button" className="primary-button" onClick={onClose}>
        Close
      </button>
    </dialog>
  );
}
