import React from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools'; // Optional DevTools
import { router } from './router'; // Import router instance
import Layout from '@/components/layout/Layout'; // Import the main Layout component
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: {
    opacity: 0,
    // y: 20, // Optional slide effect
  },
  in: {
    opacity: 1,
    // y: 0,
  },
  out: {
    opacity: 0,
    // y: -20, // Optional slide effect
  },
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.3,
};

function App() {
  const location = useLocation(); // Get location for AnimatePresence key

  return (
    <Layout> {/* Wrap everything in the main Layout */}
      <AnimatePresence mode="wait"> {/* mode='wait' ensures one page animates out before the next animates in */}
        <motion.div
          key={location.pathname} // Unique key based on route path
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          className="flex-1" // Ensure motion div takes up space
        >
          <Outlet /> {/* Render the matched route component here */}
        </motion.div>
      </AnimatePresence>
      
      {/* Optional Router DevTools - Use Vite env variable */}
      { import.meta.env.DEV && <TanStackRouterDevtools router={router} /> }
    </Layout>
  );
}

export default App;
