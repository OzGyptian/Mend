import { User } from 'firebase/auth';
import { Enterprise, Project, Sheet } from '../types';
import { Bell, Search, User as UserIcon, ChevronRight } from 'lucide-react';

interface HeaderProps {
  user: User;
  enterprise: Enterprise | null;
  project: Project | null;
  sheet: Sheet | null;
  view: string;
  setView: (view: any) => void;
}

export default function Header({ user, enterprise, project, sheet, view, setView }: HeaderProps) {
  return (
    <header className="h-16 bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 z-10 transition-colors duration-300">
      <div className="flex items-center gap-2 text-sm">
        <button 
          onClick={() => setView('enterprise')}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          {enterprise?.name || 'Enterprise'}
        </button>
        
        {(view === 'project' || view === 'sheet') && project && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />
            <button 
              onClick={() => setView('project')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              {project.projectName}
            </button>
          </>
        )}

        {view === 'sheet' && sheet && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />
            <span className="font-medium text-gray-900 dark:text-white">{sheet.sheetName}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search workspace..." 
            className="pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-black/5 dark:focus:ring-white/5 w-64 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#FF6321] rounded-full border border-white dark:border-[#0A0A0A]"></span>
          </button>
          
          <div className="flex items-center gap-3 pl-4 border-l border-gray-100 dark:border-white/10">
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none mb-1">{user.displayName || 'Cost Engineer'}</p>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest leading-none">Project Controller</p>
            </div>
            {user.photoURL ? (
              <img src={user.photoURL} className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10" alt="Profile" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 border border-gray-200 dark:border-white/10">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
