import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, User, AlertCircle } from "lucide-react";

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
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export default function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Group tasks by main status
  const tasksByStatus = {
    'To-do': tasks.filter(task => task.mainStatus === 'To-do'),
    'In Progress': tasks.filter(task => task.mainStatus === 'In Progress'),
    'Completed': tasks.filter(task => task.mainStatus === 'Completed')
  };

  const getStatusColor = (statusColor: string) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200',
      default: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colorMap[statusColor as keyof typeof colorMap] || colorMap.default;
  };

  const getPriorityColor = (priority: string | null) => {
    if (!priority) return '';
    
    switch (priority.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'border-l-4 border-l-red-500';
      case 'medium':
        return 'border-l-4 border-l-yellow-500';
      case 'low':
        return 'border-l-4 border-l-green-500';
      default:
        return '';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const KanbanColumn = ({ 
    title, 
    tasks, 
    colorClass 
  }: { 
    title: string; 
    tasks: Task[]; 
    colorClass: string;
  }) => (
    <div className="flex-1 min-w-80">
      <Card className="h-full">
        <CardHeader className={`${colorClass} text-white`}>
          <CardTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {tasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No tasks in {title.toLowerCase()}</p>
            </div>
          ) : (
            tasks.map((task) => (
              <Card
                key={task.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${getPriorityColor(task.priority)}`}
                onClick={() => onTaskClick(task)}
              >
                <CardContent className="p-4">
                  {/* Subcategory Tag */}
                  {task.subStatus && (
                    <Badge 
                      className={`mb-2 ${getStatusColor(task.statusColor)}`}
                      variant="outline"
                    >
                      {task.subStatus}
                    </Badge>
                  )}
                  
                  {/* Task Title */}
                  <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                    {task.title}
                  </h4>
                  
                  {/* Task Description */}
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  
                  {/* Task Meta Info */}
                  <div className="space-y-2">
                    {/* Project and Section */}
                    {(task.projectName || task.section) && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{task.projectName || task.section}</span>
                      </div>
                    )}
                    
                    {/* Due Date and Priority */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {task.dueDate && (
                          <div className={`flex items-center gap-1 text-xs ${
                            isOverdue(task.dueDate) ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(task.dueDate)}</span>
                            {isOverdue(task.dueDate) && (
                              <AlertCircle className="h-3 w-3" />
                            )}
                          </div>
                        )}
                        
                        {task.priority && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              task.priority.toLowerCase() === 'high' || task.priority.toLowerCase() === 'urgent'
                                ? 'border-red-300 text-red-700'
                                : task.priority.toLowerCase() === 'medium'
                                ? 'border-yellow-300 text-yellow-700'
                                : 'border-green-300 text-green-700'
                            }`}
                          >
                            {task.priority}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Assignee */}
                      {task.assignee && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-20">{task.assignee}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(task.url, '_blank');
                      }}
                      className="text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Notion
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Task Board</h2>
        <div className="text-sm text-gray-500">
          Total: {tasks.length} tasks
        </div>
      </div>
      
      <div className="flex gap-6 overflow-x-auto pb-4">
        <KanbanColumn
          title="To-do"
          tasks={tasksByStatus['To-do']}
          colorClass="bg-blue-600"
        />
        <KanbanColumn
          title="In Progress"
          tasks={tasksByStatus['In Progress']}
          colorClass="bg-yellow-600"
        />
        <KanbanColumn
          title="Completed"
          tasks={tasksByStatus['Completed']}
          colorClass="bg-green-600"
        />
      </div>
    </div>
  );
}