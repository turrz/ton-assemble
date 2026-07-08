import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider } from './context/LangContext';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import Home from './pages/Home';
import Domains from './pages/Domains';
import CreateSite from './pages/CreateSite';
import EditSite from './pages/EditSite';
import Preview from './pages/Preview';
import Publish from './pages/Publish';
import MySites from './pages/MySites';
import Support from './pages/Support';

const LOADING_MS = 1800;

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), LOADING_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <LangProvider>
      {loading && <LoadingScreen />}
      <BrowserRouter>
        <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/create" element={<CreateSite />} />
          <Route path="/edit/:siteId" element={<EditSite />} />
          <Route path="/preview/:siteId" element={<Preview />} />
          <Route path="/publish/:siteId" element={<Publish />} />
          <Route path="/sites" element={<MySites />} />
          <Route path="/support" element={<Support />} />
        </Routes>
        </Layout>
      </BrowserRouter>
    </LangProvider>
  );
}
