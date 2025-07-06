import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, User, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Task {
  id: string;
  notionId: string;
  title: string;
  description: string;
  status: string;
  mainStatus: string;
  subStatus: string;
  statusColor: string;
  priority: string | null;
  dueDate: string | null;
  assignee: string | null;
  userEmail: string | null;
  url: string;
  projectName?: string;
  section: string;
  isCompleted: boolean;
  properties?: any;
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

interface StatusOption {
  name: string;
  color: string;
}

// Notion color mapping to Tailwind classes
const getNotionColorClasses = (notionColor: string): { badge: string; column: string } => {
  const colorMap: { [key: string]: { badge: string; column: string } } = {
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

const getStatusColorFromOptions = (statusName: string, statusOptions: StatusOption[]): { badge: string; column: string } => {
  const option = statusOptions.find(opt => opt.name === statusName);
  if (option && option.color) {
    return getNotionColorClasses(option.color);
  }
  return getNotionColorClasses('default');
};

const getPriorityColor = (priority: string | null): string => {
  if (!priority) return '';
  
  const priorityColors: { [key: string]: string } = {
    'High': 'border-l-4 border-red-500',
    'Medium': 'border-l-4 border-yellow-500',
    'Low': 'border-l-4 border-green-500'
  };
  return priorityColors[priority] || '';
};

const isOverdue = (dueDate: string | null): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

// Map Notion statuses to Kanban columns
const mapStatusToColumn = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    'Not Started': 'Planning',
    'Planning': 'Planning',
    'In Progress': 'In Progress', 
    'Done': 'Done',
    'Archived': 'Cancelled',
    // Additional fallbacks for other possible statuses
    'To Do': 'Planning',
    'Todo': 'Planning',
    'Backlog': 'Planning',
    'In Review': 'In Progress',
    'Review': 'In Progress',
    'Testing': 'In Progress',
    'Complete': 'Done',
    'Completed': 'Done',
    'Finished': 'Done',
    'Cancelled': 'Cancelled',
    'Canceled': 'Cancelled',
    'Blocked': 'Cancelled'
  };
  return statusMap[status] || 'Planning';
};

// Extract all unique properties from tasks
const extractTaskProperties = (tasks: Task[]): any[] => {
  const propertyDetails: { [key: string]: any } = {};
  
  tasks.forEach(task => {
    if (task.properties) {
      Object.keys(task.properties).forEach(propKey => {
        const prop = task.properties[propKey];
        
        // Skip certain system properties
        if (propKey.includes('formula') || propKey.includes('rollup') || propKey === 'title') {
          return;
        }
        
        // Clean up property names for display
        const displayName = propKey.includes('%') ? 
          decodeURIComponent(propKey).replace(/notion:\/\/tasks\/|_property/g, '') : 
          propKey;
        
        if (!propertyDetails[displayName]) {
          propertyDetails[displayName] = {
            name: displayName,
            type: prop?.type || 'unknown',
            options: new Set(),
            colors: new Set()
          };
        }
        
        // Extract options and colors based on property type
        if (prop?.type === 'select' && prop.select) {
          propertyDetails[displayName].options.add(prop.select.name);
          if (prop.select.color) {
            propertyDetails[displayName].colors.add(prop.select.color);
          }
        }
        
        if (prop?.type === 'multi_select' && prop.multi_select) {
          prop.multi_select.forEach((option: any) => {
            propertyDetails[displayName].options.add(option.name);
            if (option.color) {
              propertyDetails[displayName].colors.add(option.color);
            }
          });
        }
        
        if (prop?.type === 'status' && prop.status) {
          propertyDetails[displayName].options.add(prop.status.name);
          if (prop.status.color) {
            propertyDetails[displayName].colors.add(prop.status.color);
          }
        }
        
        // Handle people/relation properties
        if (prop?.type === 'people' && prop.people && prop.people.length > 0) {
          prop.people.forEach((person: any) => {
            if (person.name) {
              propertyDetails[displayName].options.add(person.name);
            }
          });
        }
      });
    }
  });
  
  return Object.keys(propertyDetails)
    .filter(key => propertyDetails[key].options.size > 0)
    .map(key => ({
      ...propertyDetails[key],
      options: Array.from(propertyDetails[key].options),
      colors: Array.from(propertyDetails[key].colors)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};



export default function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  // Fetch status options with colors from Notion
  const { data: statusOptions = [] } = useQuery<StatusOption[]>({
    queryKey: ['/api/notion-statuses'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Group tasks by main status category
  const tasksByStatus = tasks.reduce((acc, task) => {
    const column = mapStatusToColumn(task.status);
    if (!acc[column]) acc[column] = [];
    acc[column].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const getStatusColor = (task: Task): string => {
    return getStatusColorFromOptions(task.status, statusOptions).badge;
  };

  const getColumnColor = (columnName: string): string => {
    // Get colors based on the first task's status in each column
    const tasksInColumn = tasksByStatus[columnName] || [];
    if (tasksInColumn.length > 0) {
      return getStatusColorFromOptions(tasksInColumn[0].status, statusOptions).column;
    }
    return getNotionColorClasses('default').column;
  };

  const columns = ['Planning', 'In Progress', 'Done', 'Cancelled'];
  const taskProperties = extractTaskProperties(tasks);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {columns.map((column) => (
        <div key={column} className={`space-y-4 p-4 rounded-lg border ${getColumnColor(column)}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{column}</h3>
            <Badge variant="secondary" className="text-xs">
              {tasksByStatus[column]?.length || 0}
            </Badge>
          </div>
          
          <div className="space-y-3 min-h-[400px]">
            {(tasksByStatus[column] || []).map((task) => (
              <Card 
                key={task.id} 
                className={`cursor-pointer hover:shadow-md transition-shadow ${getPriorityColor(task.priority)} ${isOverdue(task.dueDate) ? 'ring-2 ring-red-400' : ''} ${getStatusColorFromOptions(task.status, statusOptions).column}`}
                onClick={() => onTaskClick(task)}
              >
                <CardContent className="p-4">
                  {/* Status Tag */}
                  <div className="mb-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getStatusColor(task)}`}
                    >
                      {task.status}
                    </Badge>
                  </div>
                  
                  {/* Task Title */}
                  <h4 className="font-medium text-sm mb-2 line-clamp-2">
                    {task.title}
                  </h4>
                  
                  {/* Task Meta */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {task.dueDate && (
                      <div className={`flex items-center gap-1 ${isOverdue(task.dueDate) ? 'text-red-600' : ''}`}>
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {task.priority && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>{task.priority}</span>
                      </div>
                    )}
                    
                    {task.assignee && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">{task.assignee}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Project Name */}
                  {task.projectName && (
                    <div className="mt-2 text-xs text-gray-400 truncate">
                      {task.projectName}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}