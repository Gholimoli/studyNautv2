import React from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools'; // Optional DevTools
import { router } from './router'; // Import router instance
import Layout from '@/components/layout/Layout'; // Import the main Layout component
// import { motion, AnimatePresence } from 'framer-motion'; // Commented out
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

// Commented out pageVariants and pageTransition
// const pageVariants = { ... };
// const pageTransition = { ... };

function App() {
  // const location = useLocation(); // Commented out as it's only needed for motion key

  return (
    <Layout> {/* Wrap everything in the main Layout */}
      {/* <AnimatePresence mode="wait"> */}
        {/* <motion.div
          key={location.pathname} 
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          className="flex-1" 
        > */}
          <div className="flex-1"> {/* Simple div wrapper */}
            <Outlet /> {/* Render the matched route component directly */}
          </div>
        {/* </motion.div> */}
      {/* </AnimatePresence> */}
      
      {/* Optional Router DevTools - Use Vite env variable */}
      { import.meta.env.DEV && <TanStackRouterDevtools router={router} /> }
      
      {/* Add Toaster here */} 
      <Toaster />
    </Layout>
  );
}

export default App;
