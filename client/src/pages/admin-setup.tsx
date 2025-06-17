import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AdminSettings } from "@/components/admin/settings";

interface Project {
  id: string;
  title: string;
  databaseCount: number;
  url: string;
  lastUpdated: string;
}

export default function AdminSetup() {
  const [activeView, setActiveView] = useState<'dashboard' | 'settings'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | undefined>();

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setActiveView('dashboard');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <AdminSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onProjectSelect={handleProjectSelect}
        selectedProject={selectedProject}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {activeView === 'dashboard' ? (
            <AdminDashboard selectedProject={selectedProject} />
          ) : (
            <AdminSettings />
          )}
        </div>
      </div>
    </div>
  );
}