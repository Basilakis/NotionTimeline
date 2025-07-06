import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, Search, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight, ExternalLink, Users, Calendar, BarChart3, Eye, List } from "lucide-react";

interface UnifiedWorkspaceViewProps {
  userEmail: string;
  isDemoMode?: boolean;
  onUserEmailChange?: (email: string) => void;
}

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

export default function UnifiedWorkspaceView({ userEmail, isDemoMode = false, onUserEmailChange }: UnifiedWorkspaceViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<string>('projects');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [testUserEmail, setTestUserEmail] = useState(userEmail || "");
  const [simulateUser, setSimulateUser] = useState(!!userEmail);

  // Set user email for testing (demo mode only)
  const handleSetUserEmail = () => {
    if (testUserEmail.trim() && onUserEmailChange) {
      localStorage.setItem('userEmail', testUserEmail);
      setSimulateUser(true);
      onUserEmailChange(testUserEmail);
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
      const currentUserEmail = isDemoMode ? (localStorage.getItem('userEmail') || testUserEmail) : userEmail;
      const response = await fetch('/api/notion-workspace/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUserEmail
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Workspace Discovery Complete",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-views'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Fetch notion views
  const { data: views, isLoading: viewsLoading } = useQuery<NotionView[]>({
    queryKey: ['/api/notion-views'],
    enabled: !!userEmail && (isDemoMode ? simulateUser : true),
    retry: false,
    meta: {
      headers: {
        'x-user-email': isDemoMode ? (localStorage.getItem('userEmail') || testUserEmail) : userEmail
      }
    }
  });

  // Fetch database data for active view
  const activeViewData = views?.find(v => v.viewType === activeView);
  
  const { data: databaseData, isLoading: databaseLoading } = useQuery({
    queryKey: ['/api/notion-database', activeViewData?.databaseId],
    enabled: !!activeViewData?.databaseId,
    retry: false,
    meta: {
      headers: {
        'x-user-email': isDemoMode ? (localStorage.getItem('userEmail') || testUserEmail) : userEmail
      }
    }
  });

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/tasks'],
    retry: false,
    meta: {
      headers: {
        'x-user-email': isDemoMode ? (localStorage.getItem('userEmail') || testUserEmail) : userEmail
      }
    }
  });

  // Task details mutation
  const taskDetailsMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        headers: {
          'x-user-email': isDemoMode ? (localStorage.getItem('userEmail') || testUserEmail) : userEmail
        }
      });
      if (!response.ok) {
        throw new Error('Task not found');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedTask(data);
      setTaskModalOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleTaskClick = (task: any) => {
    taskDetailsMutation.mutate(task.id);
  };

  const handleProjectToggle = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  // Show demo email setup if in demo mode and no user email set
  if (isDemoMode && !simulateUser) {
    return (
      <div className="container mx-auto py-8 space-y-6">
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentUserEmail = isDemoMode ? (localStorage.getItem('userEmail') || testUserEmail) : userEmail;

  if (viewsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  // Show discovery option if no views
  if (!views || views.length === 0) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        {isDemoMode && simulateUser && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-800">
              Now simulating user: {currentUserEmail}
            </span>
          </div>
        )}
        
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {isDemoMode ? 'User Workspace Access' : 'Welcome to Your Workspace!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isDemoMode ? (
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Hi <strong>{currentUserEmail}</strong>! We're setting up your personalized workspace.
                </p>
                <p className="text-sm text-muted-foreground">
                  We'll automatically discover your Notion databases and create views for data assigned to your email.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                This user doesn't have any Notion views configured yet. Discover their workspace to create views automatically.
              </p>
            )}
            
            <Button 
              onClick={() => discoverWorkspace.mutate()}
              disabled={discoverWorkspace.isPending}
              className="w-full"
            >
              {discoverWorkspace.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isDemoMode ? 'Discovering...' : 'Discovering Your Workspace...'}
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  {isDemoMode ? 'Discover User Workspace' : 'Discover My Notion Workspace'}
                </>
              )}
            </Button>
            
            {!isDemoMode && (
              <div className="text-xs text-muted-foreground text-center">
                <p>This process scans your Notion databases for records containing your email address.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeViews = views.filter(v => v.isActive);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {isDemoMode && simulateUser && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-800">
            Now simulating user: {currentUserEmail}
          </span>
        </div>
      )}

      <Tabs value={activeView} onValueChange={setActiveView} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {activeViews.map((view) => (
            <TabsTrigger key={view.id} value={view.viewType}>
              <span className="mr-2">{view.icon}</span>
              {view.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {activeViews.map((view) => (
          <TabsContent key={view.id} value={view.viewType}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{view.icon}</span>
                  {view.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(databaseLoading || tasksLoading) && activeView === view.viewType ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Loading {view.title.toLowerCase()}...</span>
                    </div>
                  </div>
                ) : view.viewType === 'tasks' && tasks ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {tasks.length} tasks found
                      </p>
                    </div>
                    
                    {tasks.length > 0 ? (
                      <div className="grid gap-4">
                        {tasks.map((task: any) => (
                          <Card 
                            key={task.id} 
                            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-medium">{task.title}</h3>
                                  <Badge variant={
                                    task.status === 'completed' ? 'default' :
                                    task.status === 'in-progress' ? 'secondary' : 'outline'
                                  }>
                                    {task.status || 'pending'}
                                  </Badge>
                                </div>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground">{task.description}</p>
                                )}
                              </div>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No tasks found for this user.</p>
                      </div>
                    )}
                  </div>
                ) : databaseData && activeView === view.viewType && databaseData.records ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {databaseData.total_count} records found
                      </p>
                    </div>
                    
                    {databaseData.records.length > 0 ? (
                      <div className="space-y-4">
                        {databaseData.records.map((record: DatabaseRecord) => {
                          const isExpanded = expandedProjects.has(record.notionId);
                          
                          return (
                            <Collapsible
                              key={record.notionId}
                              open={isExpanded}
                              onOpenChange={() => handleProjectToggle(record.notionId)}
                            >
                              <Card className="overflow-hidden">
                                <CollapsibleTrigger asChild>
                                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <div>
                                          <CardTitle className="text-left">{record.title}</CardTitle>
                                          <p className="text-sm text-muted-foreground">
                                            Updated: {new Date(record.lastEditedTime).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(record.url, '_blank');
                                          }}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardHeader>
                                </CollapsibleTrigger>
                                
                                <CollapsibleContent>
                                  <CardContent className="pt-0">
                                    <div className="space-y-4">
                                      {/* Project Properties */}
                                      <div className="grid gap-4">
                                        {record.properties.Status?.select?.name && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Status:</span>
                                            <Badge variant="secondary">
                                              {record.properties.Status.select.name}
                                            </Badge>
                                          </div>
                                        )}
                                        
                                        {record.properties.People?.people && record.properties.People.people.length > 0 && (
                                          <div className="space-y-2">
                                            <span className="text-sm text-muted-foreground">Team Members:</span>
                                            <div className="flex flex-wrap gap-2">
                                              {record.properties.People.people.map((person: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                                  {person.avatar_url && (
                                                    <img 
                                                      src={person.avatar_url} 
                                                      alt={person.name}
                                                      className="w-6 h-6 rounded-full object-cover"
                                                    />
                                                  )}
                                                  <span className="text-sm">{person.name}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </CollapsibleContent>
                              </Card>
                            </Collapsible>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No records found for this user in this database.</p>
                        <p className="text-xs mt-2">Make sure the user's email is added to the "User Email" field in the Notion database.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Unable to load {view.title.toLowerCase()}. Please check your configuration.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Task Details Modal */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.title}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(selectedTask?.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-6">
              {/* Task Details */}
              <div className="grid gap-4">
                <div className="flex items-center gap-4">
                  <Badge variant={
                    selectedTask.status === 'completed' ? 'default' :
                    selectedTask.status === 'in-progress' ? 'secondary' : 'outline'
                  }>
                    {selectedTask.status || 'pending'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Progress: {selectedTask.progress || 0}%
                  </span>
                </div>
                
                {selectedTask.description && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                  </div>
                )}
                
                {selectedTask.dueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Due: {new Date(selectedTask.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Subtasks Section */}
              {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Subtasks ({selectedTask.subtasks.length})
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        selectedTask.subtasks.forEach((subtask: any) => {
                          if (subtask.url) {
                            window.open(subtask.url, '_blank');
                          }
                        });
                      }}
                    >
                      Open All Subtasks
                    </Button>
                  </div>
                  
                  <div className="grid gap-3">
                    {selectedTask.subtasks.map((subtask: any, index: number) => (
                      <Card 
                        key={index} 
                        className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => window.open(subtask.url, '_blank')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {subtask.completed ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">{subtask.title}</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {subtask.description && (
                          <p className="text-sm text-muted-foreground mt-2 ml-7">
                            {subtask.description}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}