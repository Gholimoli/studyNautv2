import React from 'react';
import { Button } from '@/components/ui/button';
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar" // Commented out until shadcn component is added
// import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet" // Commented out until shadcn component is added
import { MenuIcon, PlusIcon, UserCircle } from 'lucide-react'; // Using lucide-react for icons

// Placeholder for Logo component
const Logo = () => (
    <div className="flex items-center gap-2">
        {/* Replace with actual SVG or Image Logo */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="font-semibold text-lg">Studynaut</span>
    </div>
);

// Placeholder for Navigation Links
const NavLinks = () => (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
        <a href="/dashboard" className="text-foreground/80 hover:text-foreground transition-colors">Dashboard</a>
        <a href="/notes" className="text-foreground/80 hover:text-foreground transition-colors">Notes</a>
        <a href="/mind-maps" className="text-foreground/80 hover:text-foreground transition-colors">Mind Maps</a>
        {/* Add other main navigation links here */}
        <a href="/ai-tutor" className="text-foreground/80 hover:text-foreground transition-colors">AI Tutor</a>
    </nav>
);

// Placeholder for User Profile Menu
const UserMenu = () => (
    // <Avatar className="h-8 w-8 cursor-pointer"> // Commented out until shadcn component is added
    //     <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
    //     <AvatarFallback>CN</AvatarFallback>
    // </Avatar>
    <Button variant="ghost" size="icon" className="rounded-full">
        <UserCircle className="h-6 w-6" />
        <span className="sr-only">User Menu</span>
        {/* Add DropdownMenu for actual user actions (Profile, Settings, Logout) */}
    </Button>
);

// Placeholder for Mobile Sidebar Trigger/Content
const MobileSidebar = () => (
    // <Sheet> // Commented out until shadcn component is added
    //   <SheetTrigger asChild>
    //     <Button variant="ghost" size="icon" className="md:hidden">
    //       <MenuIcon className="h-5 w-5" />
    //       <span className="sr-only">Toggle Menu</span>
    //     </Button>
    //   </SheetTrigger>
    //   <SheetContent side="left" className="w-72 p-4">
    //     <div className="mb-6">
    //         <Logo />
    //     </div>
    //     <nav className="flex flex-col gap-4 text-base font-medium">
    //         <a href="/dashboard" className="text-foreground/80 hover:text-foreground transition-colors">Dashboard</a>
    //         <a href="/notes" className="text-foreground/80 hover:text-foreground transition-colors">Notes</a>
    //         <a href="/mind-maps" className="text-foreground/80 hover:text-foreground transition-colors">Mind Maps</a>
    //         <a href="/ai-tutor" className="text-foreground/80 hover:text-foreground transition-colors">AI Tutor</a>
    //          {/* Mirror main nav links here */}
    //     </nav>
    //     {/* Potentially add sidebar content here too */}
    //   </SheetContent>
    // </Sheet>
    <Button variant="ghost" size="icon" className="md:hidden">
        <MenuIcon className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
    </Button>
);

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
            <div className="mr-4 hidden md:flex">
                <Logo />
            </div>
            <MobileSidebar />
            <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                <div className="w-full flex-1 md:w-auto md:flex-none">
                     {/* Placeholder for potential global search */}
                </div>
                <NavLinks />
                <div className="flex items-center gap-4">
                    <Button size="sm">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Create
                    </Button>
                    <UserMenu />
                </div>
            </div>
        </div>
    </header>
  );
}

export default Header; 