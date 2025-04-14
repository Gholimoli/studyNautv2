import React from 'react';
import { Link } from '@tanstack/react-router';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            {/* <Icons.logo className="h-6 w-6" /> TODO: Add Logo */}
            <span className="hidden font-bold sm:inline-block text-primary">
              Studynaut
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              to="/dashboard"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
              // activeProps={{ className: "text-foreground" }} // For active link styling
            >
              Dashboard
            </Link>
             {/* Add other nav links here */}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center">
             {/* TODO: Add Theme Toggle */}
             {/* TODO: Add User Auth Button/Dropdown */}
            <Link to="/login" className="text-sm text-foreground/60 hover:text-foreground/80 p-2">Login</Link>
            <Link to="/register" className="text-sm text-foreground/60 hover:text-foreground/80 p-2">Register</Link>
          </nav>
        </div>
      </div>
    </header>
  );
} 