import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Database, 
  Settings, 
  ExternalLink, 
  FolderOpen, 
  ChevronRight,
  LogOut,
  Users,
  Mail,
  MessageSquare
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Project {
  id: string;
  title: string;
  databaseCount: number;
  url: string;
  lastUpdated: string;
}

interface SidebarProps {
  activeView: 'dashboard' | 'settings' | 'crm' | 'notifications';
  onViewChange: (view: 'dashboard' | 'settings' | 'crm' | 'notifications') => void;
  onProjectSelect: (project: Project) => void;
  selectedProject?: Project;
}

export function AdminSidebar({ activeView, onViewChange, onProjectSelect, selectedProject }: SidebarProps) {
  const { user, logout } = useAuth();

  // Query for connected Notion projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['/api/admin/projects'],
    retry: false,
  });

  const openNotionPage = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
            {user && (
              <p className="text-sm text-gray-600">{user.email}</p>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={logout}
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4">
        <div className="space-y-2">
          <Button
            variant={activeView === 'dashboard' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onViewChange('dashboard')}
          >
            <Database className="h-4 w-4 mr-2" />
            Projects Dashboard
          </Button>
          <Button
            variant={activeView === 'crm' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onViewChange('crm')}
          >
            <Users className="h-4 w-4 mr-2" />
            CRM Users
          </Button>
          <Button
            variant={activeView === 'settings' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onViewChange('settings')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            variant={activeView === 'notifications' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onViewChange('notifications')}
          >
            <Mail className="h-4 w-4 mr-2" />
            Notifications
          </Button>

        </div>
      </div>

      <Separator />

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Connected Projects</h3>
            <Badge variant="secondary" className="text-xs">
              {projects.length}
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No projects connected</p>
              <p className="text-xs text-gray-400 mt-1">
                Set up your first Notion workspace
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project: Project) => (
                <Card 
                  key={project.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedProject?.id === project.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => onProjectSelect(project)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {project.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {project.databaseCount} databases
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Updated: {new Date(project.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNotionPage(project.url);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          TaskFlow Admin v1.0
        </p>
      </div>
    </div>
  );
}