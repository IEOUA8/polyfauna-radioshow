import React from 'react';
import { Search, Bell, User, Menu, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TopBar = ({ toggleMobileMenu }) => {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleDashboard = () => {
    if (userRole === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="h-24 px-6 flex items-center justify-between poly-surface sticky top-0 z-30 border-b border-white/5">
      {/* Mobile Menu Trigger & Branding */}
      <div className="flex items-center gap-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={toggleMobileMenu} className="text-foreground hover:bg-white/5">
          <Menu className="w-6 h-6" />
        </Button>
        <Logo size="md" />
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-xl mx-4 lg:mx-0 hidden sm:block">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text"
            placeholder="Search for shows, artists, or events..."
            className="w-full h-12 bg-[#222222]/50 border border-white/10 rounded-full pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-auto">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full hidden sm:flex">
          <Bell className="w-5 h-5" />
        </Button>
        
        {currentUser ? (
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
              <p className="text-xs text-secondary capitalize">{currentUser.role}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary border border-white/10 flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="poly-surface-elevated text-foreground min-w-[200px] border-white/10">
                <DropdownMenuItem onClick={handleDashboard} className="cursor-pointer hover:bg-white/10 focus:bg-white/10">
                  <Settings className="w-4 h-4 mr-2" />
                  {userRole === 'admin' ? 'Admin Panel' : 'Dashboard'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-foreground">Guest User</p>
              <p className="text-xs text-muted-foreground">Listener</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#222222] border border-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;