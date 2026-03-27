import { 
  Layout, 
  Briefcase, 
  FileText, 
  Settings, 
  Shield, 
  ChevronRight, 
  LogOut, 
  ChevronLeft, 
  Sun, 
  Moon, 
  Menu, 
  CalendarCheck2,
  DollarSign,
  RefreshCw,
  PenTool,
  HardHat,
  ShoppingCart,
  Users as UsersIcon,
  Receipt,
  PieChart
} from 'lucide-react';
import { Enterprise, Project, Sheet } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  currentView: string;
  currentModule?: string;
  setView: (view: any) => void;
  setModule?: (module: string) => void;
  enterprise: Enterprise | null;
  project: Project | null;
  sheet: Sheet | null;
  userEmail?: string | null;
  userId?: string | null;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ 
  currentView, 
  currentModule,
  setView, 
  setModule,
  enterprise, 
  project, 
  sheet, 
  userEmail,
  userId,
  theme,
  setTheme,
  isCollapsed,
  setIsCollapsed,
}: SidebarProps) {
  const isSystemAdmin = userEmail === 'tarek.guindy@gmail.com';
  const isEnterpriseAdmin = userId && enterprise?.users?.[userId]?.role === 'Enterprise System Admin';
  const isProjectAdmin = userId && (isEnterpriseAdmin || project?.users?.[userId] === 'Project Admin');

  const enterpriseItems = [
    { id: 'enterprise', label: 'Enterprise Dashboard', icon: Layout, disabled: !enterprise },
  ];

  const projectModules = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'project-admin', label: 'Project Admin', icon: Settings, visible: !!project && (isProjectAdmin || isSystemAdmin) },
    { id: 'cost', label: 'Cost Management', icon: DollarSign },
    { id: 'change', label: 'Change Management', icon: RefreshCw },
    { id: 'design', label: 'Design Management', icon: PenTool },
    { id: 'field', label: 'Field Management', icon: HardHat },
    { id: 'procurement', label: 'Procurement', icon: ShoppingCart },
    { id: 'subcontract', label: 'Sub-Contract Management', icon: UsersIcon },
    { id: 'invoicing', label: 'Invoicing', icon: Receipt },
  ];

  const adminItems = [
    { id: 'system-admin', label: 'System Admin', icon: Shield, visible: isSystemAdmin },
    { id: 'enterprise-admin', label: 'Enterprise Admin', icon: Settings, visible: isEnterpriseAdmin || isSystemAdmin },
  ];

  const handleNavClick = (id: string) => {
    setView(id);
  };

  const handleModuleClick = (id: string) => {
    if (id === 'project-admin') {
      setView('project-admin');
    } else if (setModule) {
      setModule(id);
      setView('project');
    }
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

      <div className="p-6 overflow-hidden flex-1 flex flex-col">
        <div className={cn("flex items-center gap-2 mb-8 shrink-0", isCollapsed && "justify-center")}>
          {enterprise?.logoURL ? (
            <div className="shrink-0 w-8 h-8 rounded overflow-hidden border border-gray-200 dark:border-white/10">
              <img src={enterprise.logoURL} alt={enterprise.name} className="w-full h-full object-contain bg-white" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="shrink-0 w-8 h-8 bg-[#FF6321] rounded flex items-center justify-center font-bold text-white dark:text-black text-sm">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          )}
          {!isCollapsed && <span className="font-bold tracking-tight text-sm whitespace-nowrap dark:text-white">{enterprise?.name || 'Mend'}</span>}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6 custom-scrollbar">
          {/* Enterprise Section */}
          <div>
            {!isCollapsed && <p className="px-3 text-[10px] font-bold text-gray-900 dark:text-white/20 uppercase tracking-widest mb-2">Enterprise</p>}
            <nav className="space-y-1">
              {enterpriseItems.map((item) => (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                    currentView === item.id 
                      ? "bg-black text-white dark:bg-white dark:text-black" 
                      : "text-black dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5",
                    item.disabled && "opacity-20 cursor-not-allowed",
                    isCollapsed && "justify-center px-0"
                  )}
                  title={isCollapsed ? item.label : ""}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* Project Modules Section */}
          {project && (
            <div>
              {!isCollapsed && (
                <div className="px-3 mb-2">
                  <p className="text-[10px] font-bold text-gray-900 dark:text-white/20 uppercase tracking-widest">Project Modules</p>
                  <p className="text-[9px] text-blue-500 font-mono truncate mt-0.5">{project.projectName}</p>
                </div>
              )}
              <nav className="space-y-1">
                {projectModules.filter(i => i.visible !== false).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleModuleClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                      (currentView === 'project' && currentModule === item.id) || (currentView === 'project-admin' && item.id === 'project-admin')
                        ? "bg-black text-white dark:bg-white dark:text-black" 
                        : "text-black dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5",
                      isCollapsed && "justify-center px-0"
                    )}
                    title={isCollapsed ? item.label : ""}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>}
                  </button>
                ))}
                {/* Forecast Sheet Link if active */}
                {sheet && (
                  <button
                    onClick={() => setView('sheet')}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                      currentView === 'sheet'
                        ? "bg-black text-white dark:bg-white dark:text-black" 
                        : "text-black dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5",
                      isCollapsed && "justify-center px-0"
                    )}
                    title={isCollapsed ? "Forecast Sheet" : ""}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap">Forecast Sheet</span>}
                  </button>
                )}
              </nav>
            </div>
          )}

          {/* Administration Section */}
          <div>
            {!isCollapsed && <p className="px-3 text-[10px] font-bold text-gray-900 dark:text-white/20 uppercase tracking-widest mb-2">Administration</p>}
            <nav className="space-y-1">
              {adminItems.filter(i => i.visible).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                    currentView === item.id 
                      ? "bg-black text-white dark:bg-white dark:text-black" 
                      : "text-black dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5",
                    isCollapsed && "justify-center px-0"
                  )}
                  title={isCollapsed ? item.label : ""}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* User Section */}
          <div>
            {!isCollapsed && <p className="px-3 text-[10px] font-bold text-gray-900 dark:text-white/20 uppercase tracking-widest mb-2">User</p>}
            <nav className="space-y-1">
              <button
                onClick={() => handleNavClick('profile')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                  currentView === 'profile' 
                    ? "bg-black text-white dark:bg-white dark:text-black" 
                    : "text-black dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? "My Profile" : ""}
              >
                <UsersIcon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap">My Profile</span>}
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 space-y-4">
        <div className="pt-4 border-t border-gray-100 dark:border-white/10 space-y-2">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-black dark:text-white/40 hover:text-black dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 transition-all",
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
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-900 dark:text-white/20 uppercase tracking-widest">
              <span>Version</span>
              <span>1.0.0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
