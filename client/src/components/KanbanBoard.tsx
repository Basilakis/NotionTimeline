import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, User, Calendar } from 'lucide-react';

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

const getStatusColor = (task: Task): string => {
  // Use actual Notion color if available
  if (task.statusColor && task.statusColor !== 'default') {
    const notionColor = getNotionColorClass(task.statusColor);
    return `bg-opacity-20 ${notionColor.replace('bg-', 'bg-')} text-gray-800 border-gray-300`;
  }
  
  // Fallback to predefined colors based on status
  const statusColors: { [key: string]: string } = {
    'Planning': 'bg-purple-100 text-purple-800 border-purple-300',
    'Not Started': 'bg-gray-100 text-gray-800 border-gray-300',
    'To Do': 'bg-purple-100 text-purple-800 border-purple-300',
    'Todo': 'bg-purple-100 text-purple-800 border-purple-300',
    'Backlog': 'bg-purple-100 text-purple-800 border-purple-300',
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-300',
    'In Review': 'bg-blue-100 text-blue-800 border-blue-300',
    'Review': 'bg-blue-100 text-blue-800 border-blue-300',
    'Testing': 'bg-blue-100 text-blue-800 border-blue-300',
    'Done': 'bg-green-100 text-green-800 border-green-300',
    'Complete': 'bg-green-100 text-green-800 border-green-300',
    'Completed': 'bg-green-100 text-green-800 border-green-300',
    'Finished': 'bg-green-100 text-green-800 border-green-300',
    'Cancelled': 'bg-red-100 text-red-800 border-red-300',
    'Canceled': 'bg-red-100 text-red-800 border-red-300',
    'Paused': 'bg-yellow-100 text-yellow-800 border-yellow-300'
  };
  return statusColors[task.status] || 'bg-gray-100 text-gray-800 border-gray-300';
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
    'Planning': 'Planning',
    'Not Started': 'Planning',
    'To Do': 'Planning',
    'Todo': 'Planning',
    'Backlog': 'Planning',
    'In Progress': 'In Progress',
    'In Review': 'In Progress',
    'Review': 'In Progress',
    'Testing': 'In Progress',
    'Done': 'Done',
    'Complete': 'Done',
    'Completed': 'Done',
    'Finished': 'Done',
    'Cancelled': 'Cancelled',
    'Canceled': 'Cancelled',
    'Paused': 'Cancelled'
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

// Get Notion color CSS class
const getNotionColorClass = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    'default': 'bg-gray-500',
    'gray': 'bg-gray-500',
    'brown': 'bg-amber-600',
    'orange': 'bg-orange-500',
    'yellow': 'bg-yellow-500',
    'green': 'bg-green-500',
    'blue': 'bg-blue-500',
    'purple': 'bg-purple-500',
    'pink': 'bg-pink-500',
    'red': 'bg-red-500'
  };
  return colorMap[color] || 'bg-gray-500';
};

export default function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  // Group tasks by main status category
  const tasksByStatus = tasks.reduce((acc, task) => {
    const column = mapStatusToColumn(task.status);
    if (!acc[column]) acc[column] = [];
    acc[column].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const columns = ['Planning', 'In Progress', 'Done', 'Cancelled'];
  const taskProperties = extractTaskProperties(tasks);

  return (
    <div className="space-y-6">
      {/* Properties Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">
            Tasks ({tasks.length}) - All Properties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {taskProperties.map((property) => (
            <div key={property.name} className="space-y-2">
              <div className="text-sm font-medium text-gray-800">{property.name}</div>
              <div className="flex flex-wrap gap-2">
                {property.options.map((option: string, idx: number) => (
                  <div key={option} className="flex items-center gap-2 text-xs">
                    <div 
                      className={`w-3 h-3 rounded-full ${
                        property.colors[idx % property.colors.length] ? 
                          getNotionColorClass(property.colors[idx % property.colors.length]) : 
                          'bg-gray-400'
                      }`}
                    />
                    <span className="text-gray-600">{option}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {columns.map((column) => (
          <div key={column} className="space-y-4">
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
                  className={`cursor-pointer hover:shadow-md transition-shadow ${getPriorityColor(task.priority)} ${isOverdue(task.dueDate) ? 'ring-2 ring-red-400' : ''}`}
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
    </div>
  );
}