import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Database, 
  Users, 
  Activity, 
  ExternalLink, 
  Calendar,
  BarChart3,
  Plus,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder
} from "lucide-react";

interface SubPage {
  id: string;
  title: string;
  userEmail: string | null;
  databaseCount: number;
  recordCount: number;
  databases: Array<{
    id: string;
    title: string;
    recordCount: number;
    url: string;
  }>;
  url: string;
  lastUpdated: string;
}

interface Project {
  id: string;
  title: string;
  databaseCount: number;
  subPageCount: number;
  url: string;
  lastUpdated: string;
  userCount?: number;
  taskCount?: number;
  subPages: SubPage[];
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
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  // Query all projects for admin
  const { data: allProjects = [], isLoading: isLoadingProjects, refetch: refetchProjects } = useQuery<Project[]>({
    queryKey: ['/api/admin/projects'],
    retry: false,
  });

  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects Dashboard</h1>
            <p className="text-gray-600 mt-1">
              All connected Notion projects and their databases
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetchProjects()}
            disabled={isLoadingProjects}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingProjects ? 'animate-spin' : ''}`} />
            Refresh Projects
          </Button>
        </div>

        {/* Overall Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allProjects.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Connected Notion workspaces
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Databases</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allProjects.reduce((sum, project) => sum + project.databaseCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all projects
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

        {/* All Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              All Connected Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading projects...
              </div>
            ) : allProjects.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Projects Connected
                </h3>
                <p className="text-gray-600 mb-6">
                  Configure your first Notion workspace integration to get started.
                </p>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Project
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Structure</TableHead>
                      <TableHead>Owner/User</TableHead>
                      <TableHead>Databases/Records</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allProjects.map((project) => (
                      <>
                        {/* Main Project Row */}
                        <TableRow key={project.id} className="bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleProjectExpansion(project.id)}
                              >
                                {expandedProjects.has(project.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <Folder className="h-4 w-4 text-blue-600" />
                              <div>
                                <div className="font-medium">{project.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  Main Project • {project.subPageCount || 0} sub-pages
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              Admin Project
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="secondary">
                                {project.databaseCount} total databases
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {project.userCount || 0} users
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(project.lastUpdated).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openNotionPage(project.url)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Sub-pages */}
                        {expandedProjects.has(project.id) && project.subPages?.map((subPage) => (
                          <TableRow key={subPage.id} className="border-l-2 border-l-blue-200">
                            <TableCell>
                              <div className="flex items-center gap-2 ml-8">
                                <FileText className="h-4 w-4 text-green-600" />
                                <div>
                                  <div className="font-medium">{subPage.title}</div>
                                  <div className="text-sm text-muted-foreground">
                                    Sub-page • {subPage.databaseCount} databases
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {subPage.userEmail ? (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-gray-500" />
                                  <span className="text-sm">{subPage.userEmail}</span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">
                                  No user assigned
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant="default">
                                  {subPage.recordCount} records
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  {subPage.databaseCount} databases
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(subPage.lastUpdated).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openNotionPage(subPage.url)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    console.log('View databases:', subPage.databases);
                                  }}
                                >
                                  <Database className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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