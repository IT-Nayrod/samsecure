import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles = {
  '/': 'Dashboard',
  '/renouvellements': 'Renouvellements',
  '/parc-licences': 'Parc de licences',
  '/analyses-usage': "Analyses d'usage",
  '/equipe': 'Equipe et attributions',
};

export default function Layout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header title={title} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
