import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Navbar from '../components/common/Navbar';
import { Toaster } from '../components/ui/toast';
import { useSocket } from '../hooks/useSocket';

export default function AppLayout() {
  useSocket(); // initialise real-time connection for this session
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="p-6 space-y-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
