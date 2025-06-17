import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  Users, 
  Activity, 
  ExternalLink, 
  Calendar,
  BarChart3,
  Plus
} from "lucide-react";

interface Project {
  id: string;
  title: string;
  databaseCount: number;
  url: string;
  lastUpdated: string;
  userCount?: number;
  taskCount?: number;
}

interface ProjectDetails {
  databases: Array<{
    id: string;
    title: string;
    recordCount: number;
    lastSync: string;
  }>;
  recentActivity: Array<{
    user: string;
    action: string;
    timestamp: string;
  }>;
  stats: {
    totalTasks: number;
    completedTasks: number;
    activeUsers: number;
  };
}

interface DashboardProps {
  selectedProject?: Project;
}

export function AdminDashboard({ selectedProject }: DashboardProps) {
  // Query project details when a project is selected
  const { data: projectDetails, isLoading: isLoadingDetails } = useQuery<ProjectDetails>({
    queryKey: ['/api/admin/project-details', selectedProject?.id],
    enabled: !!selectedProject,
    retry: false,
  });

  // Query overall stats
  const { data: overallStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    retry: false,
  });

  const openNotionPage = (url: string) => {
    window.open(url, '_blank');
  };

  if (!selectedProject) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Select a project from the sidebar to view detailed information and manage databases.
          </p>
        </div>

        {/* Overall Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats?.totalProjects || 0}</div>
              <p className="text-xs text-muted-foreground">
                Connected Notion workspaces
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats?.activeUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Users accessing the system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats?.totalTasks || 0}</div>
              <p className="text-xs text-muted-foreground">
                Across all projects
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Welcome/Setup Section */}
        <Card className="text-center py-12">
          <CardContent>
            <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Welcome to the Admin Dashboard
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Manage your Notion workspaces, monitor project activity, and configure user access from this central hub.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{selectedProject.title}</h1>
          <p className="text-gray-600 mt-1">
            Project details and database management
          </p>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="secondary">
              {selectedProject.databaseCount} databases
            </Badge>
            <span className="text-sm text-gray-500">
              Last updated: {new Date(selectedProject.lastUpdated).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => openNotionPage(selectedProject.url)}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Notion
        </Button>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectDetails?.stats.totalTasks || 0}</div>
            <p className="text-xs text-muted-foreground">
              {projectDetails?.stats.completedTasks || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectDetails?.stats.activeUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Databases</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedProject.databaseCount}</div>
            <p className="text-xs text-muted-foreground">
              Connected databases
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Details Tabs */}
      <Tabs defaultValue="databases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="databases">Databases</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="users">User Access</TabsTrigger>
        </TabsList>

        <TabsContent value="databases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Databases</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDetails ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : projectDetails?.databases?.length ? (
                <div className="space-y-4">
                  {projectDetails.databases.map((database) => (
                    <div
                      key={database.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">{database.title}</h4>
                        <p className="text-sm text-gray-600">
                          {database.recordCount} records • Last sync: {new Date(database.lastSync).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{database.recordCount} records</Badge>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No databases found in this project</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {projectDetails?.recentActivity?.length ? (
                <div className="space-y-4">
                  {projectDetails.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.user}</span> {activity.action}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Access Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">User management coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}