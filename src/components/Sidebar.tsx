import { Layout, Briefcase, FileText, Settings, Shield, ChevronRight, LogOut, ChevronLeft, Sun, Moon, Menu } from 'lucide-react';
import { Enterprise, Project, Sheet } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  currentView: 'enterprise' | 'project' | 'sheet' | 'system-admin' | 'enterprise-admin' | 'project-admin';
  setView: (view: any) => void;
  enterprise: Enterprise | null;
  project: Project | null;
  sheet: Sheet | null;
  userEmail?: string | null;
  userId?: string | null;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onClearEnterprise?: () => void;
}

export default function Sidebar({ 
  currentView, 
  setView, 
  enterprise, 
  project, 
  sheet, 
  userEmail,
  userId,
  theme,
  setTheme,
  isCollapsed,
  setIsCollapsed,
  onClearEnterprise
}: SidebarProps) {
  const isSystemAdmin = userEmail === 'tarek.guindy@gmail.com';
  const isEnterpriseAdmin = userId && enterprise?.users?.[userId]?.role === 'Enterprise System Admin';
  const isProjectAdmin = userId && (isEnterpriseAdmin || project?.users?.[userId] === 'Project Admin');

  const navItems = [
    { id: 'enterprise', label: 'Enterprise', icon: Layout, disabled: !enterprise },
    { id: 'project', label: 'Project', icon: Briefcase, disabled: !project },
    { id: 'sheet', label: 'Forecast Sheet', icon: FileText, disabled: !sheet },
  ];

  const adminItems = [
    { id: 'system-admin', label: 'System Admin', icon: Shield, visible: isSystemAdmin },
    { id: 'enterprise-admin', label: 'Enterprise Admin', icon: Settings, visible: isEnterpriseAdmin || isSystemAdmin },
    { id: 'project-admin', label: 'Project Admin', icon: Settings, visible: !!project && (isProjectAdmin || isSystemAdmin) },
  ];

  const handleNavClick = (id: any) => {
    if (id === 'system-admin' && isSystemAdmin && onClearEnterprise) {
      onClearEnterprise();
    }
    setView(id);
  };

  return (
    <div className={cn(
      "bg-white dark:bg-[#141414] text-black dark:text-white flex flex-col border-r border-gray-200 dark:border-white/10 transition-all duration-300 ease-in-out relative",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-10 w-6 h-6 bg-[#FF6321] rounded-full flex items-center justify-center text-white dark:text-black shadow-lg z-50 hover:scale-110 transition-transform"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="p-6 overflow-hidden">
        <div className={cn("flex items-center gap-2 mb-8", isCollapsed && "justify-center")}>
          <div className="shrink-0 w-8 h-8 bg-[#FF6321] rounded flex items-center justify-center font-bold text-white dark:text-black text-sm">BU</div>
          {!isCollapsed && <span className="font-bold tracking-tight text-sm whitespace-nowrap dark:text-white">CostForecast Pro</span>}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => handleNavClick(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                currentView === item.id 
                  ? "bg-gray-100 dark:bg-white/10 text-black dark:text-white" 
                  : "text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5",
                item.disabled && "opacity-20 cursor-not-allowed",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? item.label : ""}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>}
              {!isCollapsed && currentView === item.id && <ChevronRight className="w-3 h-3" />}
            </button>
          ))}
        </nav>

        <div className="mt-8">
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-gray-400 dark:text-white/20 uppercase tracking-widest mb-4">Administration</p>}
          <nav className="space-y-1">
            {adminItems.filter(i => i.visible).map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                  currentView === item.id 
                    ? "bg-gray-100 dark:bg-white/10 text-black dark:text-white" 
                    : "text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? item.label : ""}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>}
                {!isCollapsed && currentView === item.id && <ChevronRight className="w-3 h-3" />}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-auto p-6 space-y-4">
        <div className="pt-4 border-t border-gray-100 dark:border-white/10 space-y-2">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-all",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : ""}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!isCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button 
            onClick={() => signOut(auth)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-all",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? "Sign Out" : ""}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
        
        {!isCollapsed && (
          <div className="px-3 pt-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 dark:text-white/20 uppercase tracking-widest">
              <span>Version</span>
              <span>1.0.0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
