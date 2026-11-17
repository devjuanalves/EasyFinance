import { Link } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
export default function NotificationCenter({ open, onClose }) {
  const { settings, command, setNotice, filters } = useWorkspace();
  const read = (id) => {
    try {
      command('settings:read', id ? { id } : {});
    } catch (e) {
      setNotice({ title: 'Notifications', body: e.message });
    }
  };
  return (
    <AppDialog open={open} title="Notifications" onClose={onClose}>
      <p>Stored in-app demo events for this user and workspace.</p>
      <button
        className="secondary-button"
        disabled={
          !settings.notifications.length || filters.scenario !== 'normal'
        }
        onClick={() => read()}
      >
        Mark All as Read
      </button>
      {!settings.notifications.length ? (
        <p>No notifications.</p>
      ) : (
        settings.notifications
          .slice()
          .reverse()
          .map((n) => (
            <article className="settings-invitation" key={n.id}>
              <div>
                <strong>{n.title}</strong>
                <small>
                  {n.read ? 'Read' : 'Unread'} · {n.timestamp}
                </small>
                <Link
                  to={n.target}
                  onClick={() => {
                    read(n.id);
                    onClose();
                  }}
                >
                  View Related Record
                </Link>
              </div>
              {!n.read && (
                <button className="text-button" onClick={() => read(n.id)}>
                  Mark as Read
                </button>
              )}
            </article>
          ))
      )}
    </AppDialog>
  );
}
