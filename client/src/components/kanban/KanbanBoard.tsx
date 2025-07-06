import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Flag, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Circle,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  statusColor: string;
  mainStatus: string;
  subStatus: string;
  priority: string | null;
  dueDate: Date | null;
  createdTime: Date;
  lastEditedTime: Date;
  projectName: string;
  assignee: string | null;
  description: string;
  subtasks: Task[];
}

interface KanbanColumn {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  statuses: string[];
  count: number;
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onTaskClick }) => {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Define the 4 main columns as requested
  const columns: KanbanColumn[] = useMemo(() => {
    const planning = tasks.filter(task => 
      task.mainStatus === 'Planning' || 
      task.status === 'Not Started' || 
      task.status === 'To Do' ||
      task.status === 'Planned'
    );
    
    const inProgress = tasks.filter(task => 
      task.mainStatus === 'In Progress' || 
      task.status === 'In Progress' || 
      task.status === 'Active' ||
      task.status === 'Working'
    );
    
    const done = tasks.filter(task => 
      task.mainStatus === 'Done' || 
      task.status === 'Done' || 
      task.status === 'Completed' ||
      task.status === 'Finished'
    );
    
    const cancelled = tasks.filter(task => 
      task.mainStatus === 'Cancelled' || 
      task.status === 'Cancelled' || 
      task.status === 'Blocked' ||
      task.status === 'On Hold'
    );

    return [
      {
        id: 'planning',
        title: 'Planning',
        icon: <Circle className="h-4 w-4" />,
        color: 'bg-gray-100 border-gray-300',
        statuses: ['Not Started', 'To Do', 'Planned', 'Planning'],
        count: planning.length
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        icon: <Clock className="h-4 w-4" />,
        color: 'bg-blue-50 border-blue-300',
        statuses: ['In Progress', 'Active', 'Working'],
        count: inProgress.length
      },
      {
        id: 'done',
        title: 'Done',
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'bg-green-50 border-green-300',
        statuses: ['Done', 'Completed', 'Finished'],
        count: done.length
      },
      {
        id: 'cancelled',
        title: 'Cancelled',
        icon: <XCircle className="h-4 w-4" />,
        color: 'bg-red-50 border-red-300',
        statuses: ['Cancelled', 'Blocked', 'On Hold'],
        count: cancelled.length
      }
    ];
  }, [tasks]);

  const getTasksForColumn = (columnId: string): Task[] => {
    const column = columns.find(col => col.id === columnId);
    if (!column) return [];
    
    return tasks.filter(task => {
      // Check both main status and regular status
      return column.statuses.some(status => 
        task.status === status || 
        task.mainStatus === status ||
        (columnId === 'planning' && (task.status === 'Not Started' || !task.status)) ||
        (columnId === 'in-progress' && task.status === 'In Progress') ||
        (columnId === 'done' && task.status === 'Done') ||
        (columnId === 'cancelled' && (task.status === 'Cancelled' || task.status === 'Blocked'))
      );
    });
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-200';
    }
  };

  const isOverdue = (dueDate: Date | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getStatusColor = (status: string, statusColor: string) => {
    switch (statusColor) {
      case 'blue':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'green':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'red':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'purple':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const isTaskOverdue = isOverdue(task.dueDate);
    
    return (
      <Card
        className={cn(
          "mb-3 cursor-pointer hover:shadow-md transition-shadow",
          getPriorityColor(task.priority),
          isTaskOverdue && "border-red-500 bg-red-50"
        )}
        onClick={() => onTaskClick(task)}
        draggable
        onDragStart={() => setDraggedTask(task)}
        onDragEnd={() => setDraggedTask(null)}
      >
        <CardContent className="p-3">
          {/* Subcategory status tag */}
          {task.subStatus && task.subStatus !== task.status && (
            <Badge 
              variant="outline" 
              className={cn("text-xs mb-2", getStatusColor(task.subStatus, task.statusColor))}
            >
              {task.subStatus}
            </Badge>
          )}
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
            
            {/* Project name */}
            <div className="text-xs text-gray-600">
              📁 {task.projectName || 'No Project'}
            </div>
            
            {/* Task metadata */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                {task.priority && (
                  <div className="flex items-center gap-1">
                    <Flag className="h-3 w-3" />
                    <span>{task.priority}</span>
                  </div>
                )}
                
                {task.assignee && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-20">{task.assignee}</span>
                  </div>
                )}
              </div>
              
              {task.dueDate && (
                <div className={cn(
                  "flex items-center gap-1",
                  isTaskOverdue && "text-red-600 font-medium"
                )}>
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                  {isTaskOverdue && <AlertTriangle className="h-3 w-3" />}
                </div>
              )}
            </div>
            
            {/* Subtasks indicator */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <MoreHorizontal className="h-3 w-3" />
                <span>{task.subtasks.length} subtasks</span>
              </div>
            )}
            
            {/* Main status badge */}
            <Badge 
              variant="outline" 
              className={cn("text-xs", getStatusColor(task.status, task.statusColor))}
            >
              {task.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn: React.FC<{ column: KanbanColumn }> = ({ column }) => {
    const columnTasks = getTasksForColumn(column.id);
    
    return (
      <div className="flex-1 min-w-80">
        <Card className={cn("h-full", column.color)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {column.icon}
                <span>{column.title}</span>
              </div>
              <Badge variant="secondary" className="ml-2">
                {columnTasks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[calc(100vh-250px)]">
              <div 
                className="min-h-20"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTask) {
                    // Here you could implement status change logic
                    console.log(`Moving task ${draggedTask.id} to ${column.title}`);
                  }
                }}
              >
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                
                {columnTasks.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No tasks in {column.title.toLowerCase()}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Properties Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task Properties Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Status Types</h4>
              <div className="space-y-1">
                {Array.from(new Set(tasks.map(t => t.status))).map(status => {
                  const task = tasks.find(t => t.status === status);
                  return (
                    <Badge 
                      key={status} 
                      variant="outline" 
                      className={cn("text-xs", task ? getStatusColor(status, task.statusColor) : '')}
                    >
                      {status}
                    </Badge>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Projects</h4>
              <div className="space-y-1">
                {Array.from(new Set(tasks.map(t => t.projectName).filter(Boolean))).map(project => (
                  <div key={project} className="text-xs text-gray-600">
                    📁 {project}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Priorities</h4>
              <div className="space-y-1">
                {Array.from(new Set(tasks.map(t => t.priority).filter(Boolean))).map(priority => (
                  <Badge key={priority} variant="outline" className="text-xs">
                    <Flag className="h-3 w-3 mr-1" />
                    {priority}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Statistics</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <div>Total Tasks: {tasks.length}</div>
                <div>Overdue: {tasks.filter(t => isOverdue(t.dueDate)).length}</div>
                <div>With Subtasks: {tasks.filter(t => t.subtasks?.length > 0).length}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn key={column.id} column={column} />
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;