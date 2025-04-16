import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MenuIcon, PlusIcon, UserCircle, LogOut, Settings, User } from 'lucide-react';
import { useLogoutMutation } from '@/hooks/useAuthMutations';

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

// User Profile Menu with Logout
const UserMenu = () => {
    const logoutMutation = useLogoutMutation();

    const handleLogout = () => {
        logoutMutation.mutate();
    };
    
    // Placeholder user data for display
    const user = { displayName: 'User Name', email: 'user@example.com', avatarUrl: undefined };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8"> 
                        {/* Use dynamic image and fallback */} 
                        <AvatarImage src={user?.avatarUrl || undefined} alt={user?.displayName || 'User'} />
                        <AvatarFallback>{user?.displayName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.displayName || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user?.email || 'No Email'}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                     <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{logoutMutation.isPending ? 'Logging out...' : 'Log out'}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// Placeholder for Mobile Sidebar Trigger/Content
const MobileSidebar = () => (
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