import React from 'react';
import { motion } from 'framer-motion';
import { 
  Radio, Home, Calendar, Mic2, 
  Video, FileText, MapPin, Users, 
  Info, Mail, Music2, LogIn, UserPlus, LogOut, User as UserIcon, Settings 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/Logo';

const Sidebar = ({ currentSection, setCurrentSection, isMobile, closeMobileMenu }) => {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'live', label: 'Radio Live', icon: Radio },
    { id: 'schedule', label: 'Programming', icon: Calendar },
    { id: 'podcasts', label: 'Podcasts', icon: Mic2 },
    { id: 'interviews', label: 'Interviews', icon: Video },
    { id: 'blog', label: 'Blog', icon: FileText },
    { id: 'events', label: 'Events', icon: MapPin },
    { id: 'directory', label: 'Directory', icon: Users },
    { id: 'about', label: 'About', icon: Info },
    { id: 'contact', label: 'Contact', icon: Mail },
  ];

  const categories = [
    { id: 'techno', label: 'Techno' },
    { id: 'house', label: 'House' },
    { id: 'ambient', label: 'Ambient' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'experimental', label: 'Experimental' },
  ];

  const handleNavClick = (id) => {
    setCurrentSection(id);
    if (isMobile && closeMobileMenu) {
      closeMobileMenu();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDashboard = () => {
    if (userRole === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
    if (isMobile && closeMobileMenu) {
      closeMobileMenu();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    if (isMobile && closeMobileMenu) {
      closeMobileMenu();
    }
  };

  return (
    <div className="flex flex-col h-full poly-bg relative overflow-hidden border-r border-white/5">
      <div className="poly-texture opacity-50" />
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo Area */}
        <div className="p-8 pb-6 flex justify-center border-b border-white/5">
          <div 
            className="flex flex-col items-center gap-3 cursor-pointer group"
            onClick={() => handleNavClick('home')}
          >
            <Logo size="lg" className="group-hover:opacity-80 transition-transform hover:scale-105 duration-500" />
          </div>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-hide">
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 px-4">
              Menu
            </h3>
            <div className="space-y-1">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full justify-start text-base h-12 rounded-xl transition-all duration-300 ${
                    currentSection === item.id
                      ? 'bg-secondary/20 text-secondary hover:bg-secondary/30 border border-secondary/20'
                      : 'text-foreground hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <item.icon className={`w-5 h-5 mr-3 ${currentSection === item.id ? 'text-secondary' : 'text-muted-foreground'}`} />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Categories / Playlists */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 px-4 flex items-center justify-between">
              <span>Categories</span>
              <Music2 className="w-3 h-3" />
            </h3>
            <div className="space-y-1">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant="ghost"
                  className="w-full justify-start text-sm h-10 rounded-xl text-foreground hover:bg-white/5 pl-4"
                >
                  <div className="w-2 h-2 rounded-full bg-primary mr-3 shadow-[0_0_8px_rgba(15,76,58,0.8)]" />
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Auth Section */}
        <div className="p-6 border-t border-white/5 space-y-3 bg-black/20 backdrop-blur-md">
          {currentUser ? (
            <>
              <div className="flex items-center gap-3 mb-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                </div>
              </div>
              <Button 
                onClick={handleDashboard}
                variant="outline" 
                className="w-full justify-center border-white/10 hover:bg-white/5 text-foreground"
              >
                <Settings className="w-4 h-4 mr-2" />
                {userRole === 'admin' ? 'Admin Panel' : 'Dashboard'}
              </Button>
              <Button 
                onClick={handleLogout}
                className="w-full justify-center bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={() => {
                  navigate('/login');
                  if (isMobile && closeMobileMenu) closeMobileMenu();
                }}
                variant="outline" 
                className="w-full justify-center border-white/10 hover:bg-white/5 text-foreground"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login
              </Button>
              <Button 
                onClick={() => {
                  navigate('/signup');
                  if (isMobile && closeMobileMenu) closeMobileMenu();
                }}
                className="w-full justify-center bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white border-0 shadow-lg"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Register
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;