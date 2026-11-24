import { Link } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
export default function InvestmentLink({ to, ...props }) {
  const { persistent, filters } = useWorkspace();
  const [path, hash] = to.split('#');
  const target = persistent
    ? `${path}?workspace=${filters.workspaceId}${hash ? '#' + hash : ''}`
    : to;
  return <Link {...props} to={target} />;
}
