import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AdminSettings } from "@/components/admin/settings";
import { CRMUsers } from "@/components/admin/crm-users";

interface Project {
  id: string;
  title: string;
  databaseCount: number;
  url: string;
  lastUpdated: string;
}

export default function AdminSetup() {
  const [activeView, setActiveView] = useState<'dashboard' | 'settings' | 'crm'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | undefined>();

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setActiveView('dashboard');
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <AdminDashboard selectedProject={selectedProject} />;
      case 'crm':
        return <CRMUsers />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminDashboard selectedProject={selectedProject} />;
    }
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
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}