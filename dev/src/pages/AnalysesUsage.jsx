import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Card from '../components/ui/Card';
import { ecartUsageData, parcLicences } from '../data/mockData';

const usageCompare = parcLicences.map((p) => ({
  name: p.nom,
  licences: p.licences,
  utilises: p.utilises,
}));

export default function AnalysesUsage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1D23' }}>Analyses d'usage</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Card>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23', marginBottom: '16px' }}>
            Écart mensuel usage VS licences
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ecartUsageData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #EAECF0' }} />
              <Bar dataKey="value" fill="#7C6FCD" radius={[3, 3, 0, 0]} name="Écart" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23', marginBottom: '16px' }}>
            Licences vs utilisés par logiciel
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={usageCompare} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #EAECF0' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="licences" fill="#7C6FCD" radius={[0, 3, 3, 0]} name="Licences" />
              <Bar dataKey="utilises" fill="#3FC8B8" radius={[0, 3, 3, 0]} name="Utilisés" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
