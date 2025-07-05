import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, Search, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight, ExternalLink, Users, Calendar, BarChart3 } from "lucide-react";

interface NotionView {
  id: number;
  userEmail: string;
  viewType: string;
  pageId: string;
  databaseId: string | null;
  title: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseRecord {
  notionId: string;
  title: string;
  userEmail: string | null;
  createdTime: string;
  lastEditedTime: string;
  url: string;
  properties: any;
}

interface ProjectHierarchy {
  projects: {
    id: string;
    title: string;
    url: string;
    status?: string;
    completion?: number;
    people?: any[];
    subPages?: any[];
    databases?: any[];
    properties?: any;
  }[];
}

interface ProjectDetails {
  project: DatabaseRecord;
  subPages: any[];
  databases: any[];
  tasks: any[];
}

export default function UserDemo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testUserEmail, setTestUserEmail] = useState("basiliskan@gmail.com");
  const [simulateUser, setSimulateUser] = useState(false);
  const [activeView, setActiveView] = useState<string>('projects');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Set user email for testing
  const handleSetUserEmail = () => {
    if (testUserEmail.trim()) {
      localStorage.setItem('userEmail', testUserEmail);
      setSimulateUser(true);
      console.log('[Demo] Set user email in localStorage:', testUserEmail);
      toast({
        title: "User Email Set",
        description: `Now testing as: ${testUserEmail}`,
      });
    }
  };

  // Workspace discovery mutation
  const discoverWorkspace = useMutation({
    mutationFn: async () => {
      const userEmail = localStorage.getItem('userEmail') || testUserEmail;
      const response = await fetch('/api/notion-workspace/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[Demo] Discovery success:', data);
      toast({
        title: "Workspace Discovery Complete",
        description: `Found ${data.userDatabasesFound} databases with your data.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-views'] });
    },
    onError: (error: Error) => {
      console.log('[Demo] Discovery error:', error);
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch user's Notion views
  const { data: views, isLoading: viewsLoading } = useQuery<NotionView[]>({
    queryKey: ['/api/notion-views'],
    enabled: simulateUser && !!testUserEmail,
    retry: false
  });

  // Get active view data
  const activeViewData = views?.find(v => v.viewType === activeView);

  // Fetch database data for the active view
  const { data: databaseData, isLoading: pageLoading, error: databaseError } = useQuery<{
    database_id: string;
    user_email: string;
    records: DatabaseRecord[];
    total_count: number;
  }>({
    queryKey: [`/api/notion-database/${activeViewData?.databaseId}`],
    enabled: !!activeViewData?.databaseId && simulateUser,
    retry: false
  });

  // Fetch detailed project hierarchy for selected project
  const { data: projectDetails, isLoading: projectDetailsLoading } = useQuery<any>({
    queryKey: [`/api/debug/notion-page`, selectedProject],
    enabled: !!selectedProject && simulateUser,
    retry: false
  });

  // Toggle project expansion
  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  // Log results for debugging
  useEffect(() => {
    if (databaseData) {
      console.log('[Demo] Database query success:', databaseData);
    }
    if (databaseError) {
      console.log('[Demo] Database query error:', databaseError);
    }
  }, [databaseData, databaseError]);

  // Render project relationship data (tasks, relations)
  const renderProjectRelations = (record: DatabaseRecord) => {
    const tasks = record.properties?.Tasks?.relation || [];
    const dates = record.properties?.Dates?.date;
    
    if (tasks.length === 0 && !dates) return null;

    return (
      <div className="mt-4 space-y-3 border-t pt-3">
        {dates && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="font-medium">Project Timeline:</span>
            <span>
              {dates.start && new Date(dates.start).toLocaleDateString()}
              {dates.end && ` - ${new Date(dates.end).toLocaleDateString()}`}
            </span>
          </div>
        )}
        
        {tasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-green-600" />
              <span>Related Tasks ({tasks.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tasks.slice(0, 6).map((task: any, index: number) => (
                <div key={index} className="text-xs bg-gray-50 p-2 rounded border">
                  <span className="font-mono text-gray-600">Task ID: {task.id}</span>
                </div>
              ))}
              {tasks.length > 6 && (
                <div className="text-xs text-gray-500 col-span-2">
                  +{tasks.length - 6} more tasks
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render detailed project structure with expansion
  const renderDetailedProject = (record: DatabaseRecord) => {
    const status = record.properties?.Status?.status?.name || 'Unknown';
    const completion = record.properties?.Completion?.rollup?.number || 0;
    const people = record.properties?.People?.people || [];
    const isExpanded = expandedProjects.has(record.notionId);
    
    return (
      <Card key={record.notionId} className="hover:shadow-md transition-shadow">
        <Collapsible open={isExpanded} onOpenChange={() => toggleProjectExpansion(record.notionId)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">{record.title}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge variant={status === 'Planning' ? 'secondary' : 'default'}>
                    {status}
                  </Badge>
                  <Button size="sm" variant="ghost" asChild onClick={(e) => e.stopPropagation()}>
                    <a href={record.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Progress and basic info */}
                <div className="flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${completion * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 min-w-fit">
                    {Math.round(completion * 100)}%
                  </span>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Created: {new Date(record.createdTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Updated: {new Date(record.lastEditedTime).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Team members */}
                {people.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>Team Members ({people.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {people.map((person: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                          {person.avatar_url && (
                            <img src={person.avatar_url} alt={person.name} className="h-6 w-6 rounded-full" />
                          )}
                          <span className="text-sm">
                            {person.name || 'Team Member'}
                            {person.person?.email && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({person.person.email})
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project relations and tasks */}
                {renderProjectRelations(record)}

                {/* All properties debug */}
                <details className="mt-4">
                  <summary className="text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-900">
                    View Raw Properties Data
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                    <pre>{JSON.stringify(record.properties, null, 2)}</pre>
                  </div>
                </details>

                {/* Action buttons */}
                <div className="flex gap-2 pt-3 border-t">
                  <Button size="sm" variant="outline" asChild>
                    <a href={record.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open in Notion
                    </a>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedProject(record.notionId)}
                  >
                    <Database className="h-3 w-3 mr-1" />
                    Explore Structure
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  const renderDatabaseContent = () => {
    if (pageLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading project data...</span>
        </div>
      );
    }

    if (databaseError) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-4">
            Failed to load project data. Please check your configuration.
          </p>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/notion-database/${activeViewData?.databaseId}`] })}
            variant="outline"
          >
            Retry
          </Button>
        </div>
      );
    }

    if (!databaseData || !databaseData.records || databaseData.records.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Database className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-gray-600 mb-4">
            No projects found for this user. Try discovering your workspace first.
          </p>
          <Button
            onClick={() => discoverWorkspace.mutate()}
            disabled={discoverWorkspace.isPending}
          >
            {discoverWorkspace.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Discover Workspace
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Projects ({databaseData.total_count})
          </h3>
          <div className="flex gap-2">
            <Badge variant="outline">
              Database: {databaseData.database_id.slice(0, 8)}...
            </Badge>
            <Button size="sm" variant="outline" onClick={() => {
              setExpandedProjects(databaseData.records.length === expandedProjects.size 
                ? new Set() 
                : new Set(databaseData.records.map(r => r.notionId))
              );
            }}>
              {expandedProjects.size === databaseData.records.length ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {databaseData.records.map((record) => renderDetailedProject(record))}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Demo: User Data Access</h1>
        <p className="text-gray-600">
          Test the Notion integration by simulating different user email addresses.
        </p>
      </div>

      {/* User Email Input */}
      <Card>
        <CardHeader>
          <CardTitle>Simulate User Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userEmail">User Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="userEmail"
                type="email"
                value={testUserEmail}
                onChange={(e) => setTestUserEmail(e.target.value)}
                placeholder="Enter user email to simulate"
                className="flex-1"
              />
              <Button onClick={handleSetUserEmail} disabled={!testUserEmail.trim()}>
                Set User Email
              </Button>
            </div>
          </div>

          {simulateUser && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">
                Now simulating user: {testUserEmail}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Data Access */}
      {simulateUser && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>User Data Access</CardTitle>
              {activeViewData && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Active view: {activeViewData.title}</span>
                  <Badge variant="outline">
                    Database ID: {activeViewData.databaseId}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {viewsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading user views...</span>
              </div>
            ) : !views || views.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Views Found</h3>
                <p className="text-gray-600 mb-4">
                  No Notion views have been discovered for this user yet.
                </p>
                <Button
                  onClick={() => discoverWorkspace.mutate()}
                  disabled={discoverWorkspace.isPending}
                >
                  {discoverWorkspace.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Discover Workspace
                </Button>
              </div>
            ) : (
              <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  {views.map((view) => (
                    <TabsTrigger key={view.id} value={view.viewType}>
                      {view.icon} {view.title}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {views.map((view) => (
                  <TabsContent key={view.id} value={view.viewType} className="mt-6">
                    {renderDatabaseContent()}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}