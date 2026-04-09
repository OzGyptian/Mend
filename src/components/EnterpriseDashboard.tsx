import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { Enterprise, Project } from '../types';
import { Plus, Briefcase, TrendingUp, Users, DollarSign, ArrowUpRight, Trash2, AlertTriangle, X, CalendarCheck2, ShieldAlert, Activity, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EnterpriseDashboardProps {
  enterprise: Enterprise | null;
  userId: string;
  isSystemOwner: boolean;
}

export default function EnterpriseDashboard({ enterprise, userId, isSystemOwner }: EnterpriseDashboardProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', code: '' });
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSelectProject = (project: Project) => {
    navigate(`/project/${project.id}`);
  };

  const codeExists = !isSubmitting && projects.some(p => p.projectCode === newProject.code);

  const isEnterpriseAdmin = isSystemOwner || enterprise?.users?.[userId]?.role === 'Enterprise System Admin' || enterprise?.adminUsers.includes(userId);

  useEffect(() => {
    if (!enterprise) return;

    const q = query(collection(db, 'projects'), where('enterpriseId', '==', enterprise.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allProjects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
      
      // Filter projects if not enterprise admin
      const filtered = isEnterpriseAdmin 
        ? allProjects 
        : allProjects.filter(p => p.users && p.users[userId]);
        
      setProjects(filtered);
    }, (error) => {
      console.error("Projects fetch error:", error);
    });
    return () => unsubscribe();
  }, [enterprise, isEnterpriseAdmin, userId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enterprise) return;

    if (codeExists) {
      alert('This Project Code already exists!');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const finalName = newProject.name.trim() || 'Project Name';
      await addDoc(collection(db, 'projects'), {
        enterpriseId: enterprise.id,
        projectName: finalName,
        projectCode: newProject.code,
        projectBudget: 0,
        startDate: now.split('T')[0],
        endDate: now.split('T')[0],
        cutoffDate: now.split('T')[0],
        users: { [userId]: 'Project Admin' },
        dateCreated: now,
        dateLastModified: now
      });
      setIsModalOpen(false);
      setNewProject({ name: '', code: '' });
    } catch (error) {
      console.error('Failed to create project', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Find all sheets for this project
      const sheetsQuery = query(collection(db, 'sheets'), where('projectId', '==', projectToDelete.id));
      const sheetsSnapshot = await getDocs(sheetsQuery);
      
      for (const sheetDoc of sheetsSnapshot.docs) {
        // 2. Find all rows for each sheet
        const rowsQuery = query(collection(db, `sheets/${sheetDoc.id}/rows`));
        const rowsSnapshot = await getDocs(rowsQuery);
        rowsSnapshot.docs.forEach(rowDoc => {
          batch.delete(rowDoc.ref);
        });
        // 3. Delete the sheet
        batch.delete(sheetDoc.ref);
      }
      
      // 4. Delete the project
      batch.delete(doc(db, 'projects', projectToDelete.id));
      
      await batch.commit();
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project', error);
      alert('Failed to delete project. Check console for details.');
    } finally {
      setIsDeleting(false);
    }
  };

  const stats = [
    { label: 'Total Projects', value: projects.length, icon: Briefcase, color: 'text-blue-600' },
    { label: 'Portfolio Budget', value: `$${(projects.reduce((acc, p) => acc + p.projectBudget, 0) / 1e6).toFixed(1)}M`, icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Month-End Status', value: '85% Complete', icon: CalendarCheck2, color: 'text-amber-600' },
    { label: 'Performance Index', value: '1.04', icon: Activity, color: 'text-[#FF6321]' },
  ];

  return (
    <div className="flex-1 flex flex-col w-full h-full p-4 md:p-8 overflow-y-auto transition-colors duration-300">
      <div className="w-full max-w-[1600px] mx-auto flex-1 flex flex-col">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 dark:text-white">Overall Project Performance</h1>
            <p className="text-gray-900 dark:text-gray-400 text-sm">Integrated month-end performance tracking across all project modules.</p>
          </div>
          {isEnterpriseAdmin && (
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          )}
        </div>

        {/* Module Overview Section */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {[
            { label: 'Cost', icon: DollarSign, status: 'Active', color: 'bg-emerald-500' },
            { label: 'Schedule', icon: CalendarCheck2, status: 'Coming Soon', color: 'bg-amber-500' },
            { label: 'Risk', icon: ShieldAlert, status: 'Coming Soon', color: 'bg-red-500' },
            { label: 'Safety', icon: Activity, status: 'Coming Soon', color: 'bg-blue-500' },
            { label: 'Procurement', icon: Briefcase, status: 'Coming Soon', color: 'bg-purple-500' },
            { label: 'Field Progress', icon: TrendingUp, status: 'Coming Soon', color: 'bg-indigo-500' },
          ].map((module, i) => (
            <Card key={i} className="opacity-80 hover:opacity-100 transition-opacity cursor-default">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                    <module.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className={`w-2 h-2 rounded-full ${module.color}`} />
                </div>
                <p className="text-sm font-bold dark:text-white mb-1">{module.label}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{module.status}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, i) => (
            <Card key={i} className="transition-colors">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg bg-gray-50 dark:bg-white/5 ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">+12%</span>
                </div>
                <p className="text-gray-900 dark:text-gray-400 text-xs uppercase tracking-widest font-semibold mb-1">{stat.label}</p>
                <p className="text-2xl font-bold dark:text-white">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardHeader className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Active Projects</CardTitle>
          </CardHeader>
          
          <CardContent className="p-0 flex-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Project</TableHead>
                  <TableHead className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Code</TableHead>
                  <TableHead className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Budget</TableHead>
                  <TableHead className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</TableHead>
                  <TableHead className="p-4 w-12 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">...</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow 
                    key={project.id}
                    className="group cursor-pointer"
                    onClick={() => onSelectProject(project)}
                  >
                    <TableCell className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center font-bold text-gray-400 text-xs shrink-0">
                          {project.projectCode.slice(0, 2)}
                        </div>
                        <span className="font-bold text-sm dark:text-white group-hover:text-blue-600 transition-colors">{project.projectName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">{project.projectCode}</span>
                    </TableCell>
                    <TableCell className="p-4">
                      <span className="text-xs font-mono font-medium dark:text-white">${project.projectBudget.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-xs text-emerald-600 font-medium">On Track</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(project);
                          }}
                          className="text-gray-400 hover:text-blue-600"
                          title="Open Project"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Button>
                        {isEnterpriseAdmin && (
                          <Button 
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(project);
                            }}
                            className="text-gray-400 hover:text-red-600"
                            title="Delete Project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {projects.length === 0 && (
              <div className="p-12 text-center">
                <Briefcase className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-4" />
                <p className="text-gray-900 dark:text-gray-400 text-sm">No active projects found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <AlertTriangle className="w-6 h-6" />
              <DialogTitle className="text-xl font-bold">Delete Project?</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">"{projectToDelete?.projectName}"</span>? 
              This action is permanent and will delete all associated sheets and forecast data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              disabled={isDeleting}
              variant="outline"
              onClick={() => setProjectToDelete(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              disabled={isDeleting}
              variant="destructive"
              onClick={handleDeleteProject}
              className="flex-1"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Deleting...
                </>
              ) : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                Project Code <span className="text-red-500">*</span>
              </label>
              <Input 
                required
                maxLength={20}
                value={newProject.code}
                onChange={e => setNewProject({...newProject, code: e.target.value})}
                className={cn(
                  codeExists && "border-red-500 focus-visible:ring-red-500/20"
                )}
                placeholder="e.g. BR-2024-001"
              />
              {codeExists && (
                <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">This Project Code already exists!</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Project Name</label>
              <Input 
                maxLength={40}
                value={newProject.name}
                onChange={e => setNewProject({...newProject, name: e.target.value})}
                placeholder="e.g. Harbor View Mixed-Use"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={!newProject.code || codeExists || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

