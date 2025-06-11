import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Clock, Circle } from "lucide-react";
import type { Task } from "@shared/schema";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="text-white text-sm h-4 w-4" />;
      case 'pending':
        return <Clock className="text-white text-sm h-4 w-4" />;
      default:
        return <Circle className="text-white text-sm h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'task-status-completed';
      case 'pending':
        return 'task-status-pending';
      default:
        return 'task-status-not-started';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            Completed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            Pending
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            Not Started
          </Badge>
        );
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="relative flex items-start space-x-4">
      <div className="relative">
        <div className={`w-10 h-10 rounded-full ${getStatusColor(task.status)} flex items-center justify-center z-10 relative bg-white border-2 border-current`}>
          {getStatusIcon(task.status)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div 
          className="bg-gray-50 rounded-lg p-4 hover-lift smooth-transition cursor-pointer" 
          onClick={onClick}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-medium text-gray-900 truncate pr-2">
              {task.title}
            </h3>
            {getStatusBadge(task.status)}
          </div>
          
          {task.description && (
            <p className="text-sm text-gray-500 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              {task.assignee && (
                <span>{task.assignee}</span>
              )}
              {task.dueDate && (
                <span>Due: {formatDate(task.dueDate)}</span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {task.status === 'completed' && task.completedAt ? (
                <span>Completed: {formatDate(task.completedAt)}</span>
              ) : task.status === 'pending' && task.progress ? (
                <>
                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-orange-500 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                  <span>{task.progress}%</span>
                </>
              ) : task.estimatedHours ? (
                <span>Est: {task.estimatedHours}h</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
