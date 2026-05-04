import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Renouvellements from './pages/Renouvellements';
import ParcLicences from './pages/ParcLicences';
import AnalysesUsage from './pages/AnalysesUsage';
import Equipe from './pages/Equipe';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="renouvellements" element={<Renouvellements />} />
          <Route path="parc-licences" element={<ParcLicences />} />
          <Route path="analyses-usage" element={<AnalysesUsage />} />
          <Route path="equipe" element={<Equipe />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
