import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useStatusNotification, createStatusChangeData } from "@/hooks/useStatusNotification";
import { useAuth } from "@/hooks/useAuth";
import TaskTimeline from "@/components/TaskTimeline";
import KanbanBoard from "@/components/KanbanBoard";
import ProfessionalTimeline from "@/components/timeline/ProfessionalTimeline";
import KanbanBoardNew from "@/components/kanban/KanbanBoard";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Loader2, Database, Search, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight, ExternalLink, Users, Calendar, BarChart3, Eye, List, Settings, LogOut, Percent, FileText, Package, DollarSign, CreditCard, ShoppingCart, Send, Bot, User, MessageSquare } from "lucide-react";
import vertexLogo from "@assets/VertexDevelopments_1751826186443.png";

// Notion color mapping to Tailwind classes (matching KanbanBoard)
const getNotionColorClasses = (notionColor: string): { badge: string; column: string } => {
  const colorMap = {
    'default': {
      badge: 'bg-gray-100 text-gray-800 border-gray-200',
      column: 'bg-gray-50 border-gray-200'
    },
    'gray': {
      badge: 'bg-gray-100 text-gray-800 border-gray-200',
      column: 'bg-gray-50 border-gray-200'
    },
    'brown': {
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      column: 'bg-amber-50 border-amber-200'
    },
    'orange': {
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
      column: 'bg-orange-50 border-orange-200'
    },
    'yellow': {
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      column: 'bg-yellow-50 border-yellow-200'
    },
    'green': {
      badge: 'bg-green-100 text-green-800 border-green-200',
      column: 'bg-green-50 border-green-200'
    },
    'blue': {
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      column: 'bg-blue-50 border-blue-200'
    },
    'purple': {
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      column: 'bg-purple-50 border-purple-200'
    },
    'pink': {
      badge: 'bg-pink-100 text-pink-800 border-pink-200',
      column: 'bg-pink-50 border-pink-200'
    },
    'red': {
      badge: 'bg-red-100 text-red-800 border-red-200',
      column: 'bg-red-50 border-red-200'
    },
  };
  
  return colorMap[notionColor] || colorMap['default'];
};

// Helper function to get dot color for status indicators
const getDotColor = (notionColor: string): string => {
  const colorMap = {
    'default': 'bg-gray-500',
    'gray': 'bg-gray-500',
    'brown': 'bg-amber-500',
    'orange': 'bg-orange-500',
    'yellow': 'bg-yellow-500',
    'green': 'bg-green-500',
    'blue': 'bg-blue-500',
    'purple': 'bg-purple-500',
    'pink': 'bg-pink-500',
    'red': 'bg-red-500',
  };
  
  return colorMap[notionColor] || colorMap['default'];
};

// Filtering helper functions
const filterTasksByStatus = (tasks: any[], filter: string) => {
  if (filter === 'all') return tasks;
  return tasks.filter(task => task.status === filter);
};

const filterSubtasksByStatus = (subtasks: SubTask[], filter: string) => {
  if (filter === 'all') return subtasks;
  return subtasks.filter(subtask => subtask.status === filter);
};

// Helper function to format status display with proper capitalization
const formatStatusDisplay = (status: string): string => {
  if (!status) return '';
  
  // Handle common status patterns
  const statusMap: { [key: string]: string } = {
    'in progress': 'In Progress',
    'not started': 'Not Started',
    'done': 'Done',
    'to do': 'To Do',
    'in_progress': 'In Progress',
    'not_started': 'Not Started',
    'todo': 'To Do'
  };
  
  // Check if we have a direct mapping
  const lowerStatus = status.toLowerCase();
  if (statusMap[lowerStatus]) {
    return statusMap[lowerStatus];
  }
  
  // For other cases, capitalize each word
  return status.split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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

interface StatusOption {
  name: string;
  color: string;
}

interface ProjectSummary {
  id: string;
  title: string;
  completion: number;
  proposal: string;
  proposalUrl: string | null;
  materialsProposal: string;
  materialsProposalUrl: string | null;
  projectPrice: number;
  totalPayments: string;
  url: string;
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

interface Task {
  id: string;
  title: string;
  status: string;
  mainStatus?: string;
  subStatus?: string;
  statusColor?: string;
  statusGroup?: string;
  priority: string;
  dueDate: string | null;
  description: string;
  section: string;
  isCompleted: boolean;
  progress: number;
  createdTime: string;
  lastEditedTime: string;
  url: string;
  properties: any;
  subtasks?: SubTask[];
}

interface SubTask {
  id: string;
  title: string;
  status: string;
  statusColor?: string;
  type: 'child_page' | 'relation';
  lastEditedTime: string;
}

// ChatMessage interface moved to ChatInterface component

function getUserEmail(): string {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    console.log("[Workspace] No user email found, using fallback");
    return '';
  }
  return userEmail;
}

export default function Workspace() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { triggerStatusChange } = useStatusNotification();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('tasks'); // Start with tasks tab
  const [statusFilter, setStatusFilter] = useState<string>('all'); // Filter state for tasks and subtasks
  
  // Removed old chat state - now using ChatInterface component

  // Removed handleSendRequest - now handled by ChatInterface component;

  // Handle tab change with cache invalidation to refresh data
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    
    // Invalidate relevant caches based on the tab being switched to
    if (newTab === 'tasks') {
      console.log("[Workspace] Refreshing tasks data on tab switch");
      queryClient.invalidateQueries({ queryKey: ['/api/tasks-from-notion'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-statuses'] });
    } else if (newTab === 'purchases') {
      console.log("[Workspace] Refreshing purchases data on tab switch");
      queryClient.invalidateQueries({ queryKey: ['/api/purchases-from-notion'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-statuses'] });
    } else if (newTab === 'projects') {
      console.log("[Workspace] Refreshing projects data on tab switch");
      queryClient.invalidateQueries({ queryKey: ['/api/notion-database/07ede7dbc952491784e9c5022523e2e0'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-project-summary'] });
    }
  };

  // Manual refresh function for current tab
  const handleManualRefresh = () => {
    console.log(`[Workspace] Manual refresh triggered for ${activeTab} tab`);
    if (activeTab === 'tasks') {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks-from-notion'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-statuses'] });
    } else if (activeTab === 'purchases') {
      queryClient.invalidateQueries({ queryKey: ['/api/purchases-from-notion'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-statuses'] });
    } else if (activeTab === 'projects') {
      queryClient.invalidateQueries({ queryKey: ['/api/notion-database/07ede7dbc952491784e9c5022523e2e0'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notion-project-summary'] });
    }
    
    toast({
      title: "Data Refreshed",
      description: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} data has been refreshed from Notion`,
    });
  };

  // Auto-refresh all task-related data when task modal closes or task is updated
  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
    
    // Refresh all task data when closing task modal to catch any status changes
    console.log("[Workspace] Task modal closed - refreshing all task data");
    queryClient.invalidateQueries({ queryKey: ['/api/tasks-from-notion'] });
    queryClient.invalidateQueries({ queryKey: ['/api/purchases-from-notion'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notion-statuses'] });
  };

  // Status color helper function
  const getStatusColorFromOptions = (statusName: string, statusOptions: StatusOption[]): string => {
    const option = statusOptions.find(opt => opt.name === statusName);
    if (option && option.color) {
      return getNotionColorClasses(option.color).badge;
    }
    return getNotionColorClasses('default').badge;
  };
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<string>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  const userEmail = getUserEmail();
  
  // Check if user is admin
  const isAdmin = user?.email === 'basiliskan@gmail.com';

  // Set user email in localStorage on mount
  useEffect(() => {
    if (user?.email) {
      localStorage.setItem('userEmail', user.email);
      console.log("[Workspace] Set user email in localStorage:", user.email);
    }
  }, [user]);

  // Fetch user's Notion views
  const { data: views, isLoading: viewsLoading } = useQuery<NotionView[]>({
    queryKey: ['/api/notion-views'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch database records for projects
  const { data: databaseData, isLoading: databaseLoading } = useQuery({
    queryKey: ['/api/notion-database/07ede7dbc952491784e9c5022523e2e0'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch project hierarchy
  const { data: projectHierarchy, isLoading: hierarchyLoading } = useQuery<ProjectHierarchy>({
    queryKey: ['/api/notion-project-hierarchy'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch project summary data
  const { data: projectSummary, isLoading: summaryLoading } = useQuery<ProjectSummary[]>({
    queryKey: ['/api/notion-project-summary'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch status options from API
  const { data: statusOptions = [] } = useQuery<StatusOption[]>({
    queryKey: ['/api/notion-statuses'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch regular tasks from Notion (excluding Αγορές)
  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks-from-notion'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch purchase tasks (Αγορές) from Notion
  const { data: purchaseTasks, isLoading: purchasesLoading } = useQuery<Task[]>({
    queryKey: ['/api/purchases-from-notion'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Use the selected task directly since it already has all details including subtasks
  const taskDetails = selectedTask;
  const taskDetailsLoading = false;






  // Auto-load tasks when views are available
  useEffect(() => {
    if (views && views.length > 0 && userEmail && !selectedViewId) {
      // Find the Tasks view and automatically select it to load tasks
      const tasksView = views.find(view => 
        view.viewType.toLowerCase().includes('task') || 
        view.title.toLowerCase().includes('task')
      );
      
      if (tasksView) {
        setSelectedViewId(tasksView.id);
        setTaskViewMode('list'); // Default to list view
        setActiveTab('tasks'); // Switch to tasks tab
        console.log('[Workspace] Auto-loading tasks from view:', tasksView.title);
      }
    }
  }, [views, userEmail, selectedViewId]);

  const handleProjectClick = (project: any) => {
    setSelectedProject(project);
  };

  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  // Handle status change with email notification
  const handleStatusChange = async (task: Task, newStatus: string) => {
    const oldStatus = task.status;
    
    if (oldStatus === newStatus) {
      return; // No change needed
    }

    try {
      // Send status change notification
      await triggerStatusChange(createStatusChangeData(
        task,
        oldStatus,
        newStatus,
        userEmail || 'basiliskan@gmail.com'
      ));
      
      console.log(`[Status Change] Successfully triggered notification for task "${task.title}"`);
    } catch (error) {
      console.error('[Status Change] Failed to send notification:', error);
    }
  };

  const openAllSubtasks = (subtasks: SubTask[]) => {
    subtasks.forEach(subtask => {
      window.open(`https://www.notion.so/${subtask.id.replace(/-/g, '')}`, '_blank');
    });
  };



  const filteredProjects = databaseData?.records?.filter((project: any) =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.properties?.['Project name']?.title?.[0]?.plain_text?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredTasks = filterTasksByStatus(
    tasks?.filter((task: Task) =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    statusFilter
  );

  const filteredPurchaseTasks = filterTasksByStatus(
    purchaseTasks?.filter((task: Task) =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    statusFilter
  );

  // Helper function to get tasks for a specific project
  const getProjectTasks = (projectTaskIds: string[]) => {
    const projectTasks = tasks?.filter(task => projectTaskIds.includes(task.id)) || [];
    return filterTasksByStatus(projectTasks, statusFilter);
  };

  // Helper function to get project summary data for a specific project
  const getProjectSummary = (projectId: string) => {
    return projectSummary?.find(summary => summary.id === projectId);
  };

  // Helper function to get badge variant and color classes based on Notion status color
  const getStatusBadgeStyle = (statusColor: string, isMainStatus: boolean = false) => {
    const colorMap = {
      blue: isMainStatus ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-blue-50 text-blue-700 border-blue-200',
      yellow: isMainStatus ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200',
      green: isMainStatus ? 'bg-green-100 text-green-800 border-green-200' : 'bg-green-50 text-green-700 border-green-200',
      red: isMainStatus ? 'bg-red-100 text-red-800 border-red-200' : 'bg-red-50 text-red-700 border-red-200',
      purple: isMainStatus ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-purple-50 text-purple-700 border-purple-200',
      gray: isMainStatus ? 'bg-gray-100 text-gray-800 border-gray-200' : 'bg-gray-50 text-gray-700 border-gray-200',
      default: isMainStatus ? 'bg-gray-100 text-gray-800 border-gray-200' : 'bg-gray-50 text-gray-700 border-gray-200'
    };
    return colorMap[statusColor as keyof typeof colorMap] || colorMap.default;
  };

  // Helper function to group tasks by status for Kanban view
  const groupTasksByStatus = (projectTasks: Task[]) => {
    // Initialize groups with available statuses from API
    const groups: { [key: string]: Task[] } = {};
    
    // Add all available statuses as empty groups
    availableStatuses.forEach(status => {
      groups[status] = [];
    });
    
    // Add fallback groups if no statuses are available
    if (availableStatuses.length === 0) {
      groups['To Do'] = [];
      groups['In Progress'] = [];
      groups['Done'] = [];
      groups['Other'] = [];
    } else {
      // Always add 'Other' for any tasks with unrecognized statuses
      groups['Other'] = [];
    }
    
    projectTasks.forEach(task => {
      const status = task.status || 'Other';
      if (groups[status]) {
        groups[status].push(task);
      } else {
        groups['Other'].push(task);
      }
    });
    
    return groups;
  };

  if (viewsLoading || databaseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img 
            src={vertexLogo} 
            alt="Vertex Developments" 
            className="h-16 w-auto"
          />
          <Badge variant="outline" className="text-xs">
            {user?.email}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/demo'}
              >
                🧪 Test Users
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/admin'}
              >
                ⚙️ Admin
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/agent'}
          >
            <Bot className="h-4 w-4 mr-2" />
            AI Agent
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>



      {/* Search and Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search projects, tasks, or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Done">Done</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="projects">
            <Database className="h-4 w-4 mr-2" />
            Projects ({filteredProjects.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <CheckCircle className="h-4 w-4 mr-2" />
            Tasks ({filteredTasks.length})
          </TabsTrigger>
          <TabsTrigger value="purchases">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Purchases ({(purchaseTasks || []).length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            <FileText className="h-4 w-4 mr-2" />
            Requests
          </TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-600">No projects found</p>
                <p className="text-sm text-gray-500 mt-2">
                  {searchTerm ? "Try adjusting your search terms" : "No projects are available for your account"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {filteredProjects.map((project: any) => (
                <Collapsible key={project.notionId}>
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {expandedProjects.has(project.notionId) ? (
                                <ChevronDown className="h-5 w-5 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-500" />
                              )}
                              <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {project.properties?.Status?.select?.name || 'Active'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Updated {new Date(project.lastEditedTime).toLocaleDateString()}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(project.url, '_blank');
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
                        <div className="space-y-6">
                          {/* Project Details */}
                          <div className="space-y-4">
                            {/* First row: Basic Info in 2 columns */}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <span>Created: {new Date(project.createdTime).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <span>Updated: {new Date(project.lastEditedTime).toLocaleDateString()}</span>
                              </div>
                              
                              {(() => {
                                const summary = getProjectSummary(project.notionId);
                                return summary && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Percent className="h-4 w-4 text-green-600 flex-shrink-0" />
                                    <span>Completion: <span className="font-medium text-green-600">{summary.completion}%</span></span>
                                  </div>
                                );
                              })()}
                              
                              {project.properties?.People?.people?.length > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Users className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                  <span>{project.properties.People.people.length} team members</span>
                                </div>
                              )}
                              
                              {project.properties?.['User Email']?.email && (
                                <div className="flex items-start gap-2 text-sm col-span-2">
                                  <span className="text-gray-500 flex-shrink-0 mt-0.5">Owner:</span>
                                  <span className="break-all">{project.properties['User Email'].email}</span>
                                </div>
                              )}
                            </div>

                            {(() => {
                              const summary = getProjectSummary(project.notionId);
                              if (!summary) return null;
                              
                              return (
                                <>
                                  {/* Second row: Price and Payments */}
                                  <div className="grid grid-cols-1 gap-3 pt-3 border-t border-gray-100">
                                    {summary.projectPrice > 0 && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <DollarSign className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                        <span>Price: <span className="font-medium text-purple-600">€{summary.projectPrice.toLocaleString()}</span></span>
                                      </div>
                                    )}
                                    
                                    {summary.totalPayments && (
                                      <div className="flex items-start gap-2">
                                        <CreditCard className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <span className="text-gray-500 text-sm">Payments:</span>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {summary.totalPayments.split(',').map((payment, index) => (
                                              <span
                                                key={index}
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                                              >
                                                {payment.trim()}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Third row: Materials and Proposal on separate lines */}
                                  <div className="grid grid-cols-1 gap-3">
                                    {summary.materialsProposalUrl ? (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Package className="h-4 w-4 text-orange-600 flex-shrink-0" />
                                        <Button
                                          variant="link"
                                          size="sm"
                                          onClick={() => window.open(summary.materialsProposalUrl, '_blank')}
                                          className="h-auto p-0 text-sm text-orange-600 hover:text-orange-800 text-left"
                                        >
                                          Materials: {summary.materialsProposal}
                                        </Button>
                                      </div>
                                    ) : summary.materialsProposal !== 'Not Set' && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Package className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                        <span>Materials: {summary.materialsProposal}</span>
                                      </div>
                                    )}
                                    
                                    {summary.proposalUrl ? (
                                      <div className="flex items-center gap-2 text-sm">
                                        <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                        <Button
                                          variant="link"
                                          size="sm"
                                          onClick={() => window.open(summary.proposalUrl, '_blank')}
                                          className="h-auto p-0 text-sm text-blue-600 hover:text-blue-800 text-left"
                                        >
                                          Proposal: {summary.proposal}
                                        </Button>
                                      </div>
                                    ) : summary.proposal !== 'Not Set' && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                        <span>Proposal: {summary.proposal}</span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Project Tasks */}
                          {(() => {
                            const projectTaskIds = project.properties?.Tasks?.relation?.map((task: any) => task.id) || [];
                            const projectTasks = getProjectTasks(projectTaskIds);
                            
                            if (projectTasks.length > 0) {
                              return (
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-3">Tasks ({projectTasks.length})</h4>
                                  <div className="space-y-2">
                                    {projectTasks.map((task: Task) => (
                                      <div
                                        key={task.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleTaskClick(task)}
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h5 className="font-medium text-gray-800">{task.title}</h5>
                                            <div className="flex items-center gap-1">
                                              <Badge className={`text-xs ${getStatusBadgeStyle(task.statusColor || 'default', true)}`}>
                                                {task.status}
                                              </Badge>
                                            </div>
                                            {task.priority && (
                                              <Badge variant={
                                                task.priority === 'High' ? 'destructive' :
                                                task.priority === 'Medium' ? 'default' : 'secondary'
                                              } className="text-xs">
                                                {task.priority}
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span>Progress: {task.progress}%</span>
                                            {task.dueDate && (
                                              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                            )}
                                          </div>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-gray-400" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(project.url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open in Notion
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleProjectClick(project)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading tasks...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-600">No tasks found</p>
                <p className="text-sm text-gray-500 mt-2">
                  {searchTerm ? "Try adjusting your search terms" : "No tasks are available for your account"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Task View Mode Selector */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Tasks ({filteredTasks.length})</h3>
                <Tabs value={taskViewMode} onValueChange={setTaskViewMode} className="w-auto">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="list">List</TabsTrigger>
                    <TabsTrigger value="kanban-pro">Kanban</TabsTrigger>
                    <TabsTrigger value="timeline-pro">Timeline</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* List View */}
              {taskViewMode === 'list' && (
                <div className="grid gap-4">
                  {filteredTasks.map((task: Task) => (
                    <Card key={task.id} className={`cursor-pointer hover:shadow-md transition-shadow ${getNotionColorClasses(statusOptions.find(opt => opt.name === task.status)?.color || 'default').column}`}>
                      <CardContent className="p-4" onClick={() => handleTaskClick(task)}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-gray-900">{task.title}</h3>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getStatusColorFromOptions(task.status, statusOptions)}`}
                              >
                                {formatStatusDisplay(task.status)}
                              </Badge>
                              {task.priority && (
                                <Badge variant={
                                  task.priority === 'High' ? 'destructive' :
                                  task.priority === 'Medium' ? 'default' : 'secondary'
                                }>
                                  {task.priority}
                                </Badge>
                              )}
                            </div>
                            
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Progress: {task.progress}%</span>
                              {task.dueDate && (
                                <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(task.url, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}



              {/* Professional Kanban View */}
              {taskViewMode === 'kanban-pro' && (
                <KanbanBoardNew 
                  tasks={filteredTasks} 
                  onTaskClick={handleTaskClick}
                />
              )}

              {/* Professional Timeline View */}
              {taskViewMode === 'timeline-pro' && (
                <ProfessionalTimeline 
                  tasks={filteredTasks}
                  projects={filteredProjects}
                  onTaskClick={handleTaskClick}
                />
              )}
            </div>
          )}
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases" className="space-y-4">
          {purchasesLoading ? (
            <Card>
              <CardContent className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium">Loading purchase tasks...</p>
              </CardContent>
            </Card>
          ) : !purchaseTasks || purchaseTasks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-600">No purchase tasks found</p>
                <p className="text-sm text-gray-500 mt-2">
                  No tasks containing "Αγορές" were found in your projects
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Purchase Tasks</h3>
                <Badge variant="outline" className="px-3 py-1">
                  {purchaseTasks.length} task{purchaseTasks.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {purchaseTasks.map((task) => (
                  <Card key={task.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            task.status === 'Done' ? 'bg-green-500' : 
                            task.status === 'In Progress' ? 'bg-yellow-500' : 
                            task.status === 'Planning' ? 'bg-blue-500' :
                            'bg-gray-300'
                          }`} />
                          <h4 className="font-medium">{task.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`${getNotionColorClasses(task.statusColor || 'default').badge} px-2 py-1 text-xs`}
                          >
                            {formatStatusDisplay(task.status)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(task.url, '_blank')}
                            className="h-6 w-6 p-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3">
                        {task.projectName && (
                          <span>Project: {task.projectName}</span>
                        )}
                        {task.priority && (
                          <span>Priority: {task.priority}</span>
                        )}
                        {task.dueDate && (
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        )}
                        {task.assignee && (
                          <span>Assignee: {task.assignee}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Requests Tab - AI Agent & Support */}
        <TabsContent value="requests" className="space-y-4">
          <div className="h-[600px]">
            <ChatInterface userEmail={getUserEmail()} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Details Modal */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {selectedTask?.title || 'Task Details'}
            </DialogTitle>
          </DialogHeader>
          
          {taskDetailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading task details...</span>
            </div>
          ) : taskDetails ? (
            <div className="space-y-6">
              {/* Task Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Task Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={taskDetails.isCompleted ? "default" : "secondary"}>
                        {taskDetails.status}
                      </Badge>

                    </div>
                    <div className="flex items-center gap-2">
                      <span>Progress: {taskDetails.progress}%</span>
                      {taskDetails.priority && (
                        <Badge variant={
                          taskDetails.priority === 'High' ? 'destructive' :
                          taskDetails.priority === 'Medium' ? 'default' : 'secondary'
                        }>
                          {taskDetails.priority}
                        </Badge>
                      )}
                    </div>
                    {taskDetails.dueDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>Due: {new Date(taskDetails.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Created: {new Date(taskDetails.createdTime).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Last Updated: {new Date(taskDetails.lastEditedTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {taskDetails.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {taskDetails.description}
                  </p>
                </div>
              )}

              {/* Subtasks */}
              {taskDetails.subtasks && taskDetails.subtasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4 text-blue-600" />
                      <Label className="text-sm font-medium text-gray-700">
                        Subtasks ({filterSubtasksByStatus(taskDetails.subtasks, statusFilter).length})
                      </Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAllSubtasks(taskDetails.subtasks!)}
                    >
                      Open All Subtasks
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {filterSubtasksByStatus(taskDetails.subtasks, statusFilter).map((subtask: SubTask) => (
                      <div
                        key={subtask.id}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:opacity-80 ${getNotionColorClasses(subtask.statusColor || 'default').column}`}
                        onClick={() => window.open(`https://www.notion.so/${subtask.id.replace(/-/g, '')}`, '_blank')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${getDotColor(subtask.statusColor || 'default')}`} />
                          <div>
                            <p className="font-medium text-gray-900">{subtask.title}</p>
                            <p className="text-xs text-gray-500">
                              {subtask.type === 'child_page' ? 'Child Page' : 'Related Task'} • 
                              Updated {new Date(subtask.lastEditedTime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getNotionColorClasses(subtask.statusColor || 'default').badge}`}
                          >
                            {formatStatusDisplay(subtask.status)}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}



              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => window.open(taskDetails.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Notion
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsTaskModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Unable to load task details.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}