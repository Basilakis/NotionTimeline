import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  description: string;
  section: string;
  isCompleted: boolean;
  progress: number;
  createdTime: string;
  lastEditedTime: string;
  url: string;
  properties: any;
  subtasks?: any[];
}

interface TaskTimelineProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export default function TaskTimeline({ tasks, onTaskClick }: TaskTimelineProps) {
  // Create timeline data with proper date sorting and grouping
  const timelineData = useMemo(() => {
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Sort tasks by date (due date first, then creation date)
    const sortedTasks = tasks
      .map(task => ({
        ...task,
        sortDate: new Date(task.dueDate || task.createdTime),
        displayDate: task.dueDate || task.createdTime,
        dateType: task.dueDate ? 'due' : 'created'
      }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

    // Group tasks by time periods
    const groups = {
      overdue: sortedTasks.filter(task => 
        task.dueDate && new Date(task.dueDate) < today && !task.isCompleted
      ),
      thisWeek: sortedTasks.filter(task => {
        const taskDate = new Date(task.displayDate);
        return taskDate >= oneWeekAgo && taskDate <= oneWeekFromNow;
      }),
      upcoming: sortedTasks.filter(task => {
        const taskDate = new Date(task.displayDate);
        return taskDate > oneWeekFromNow && taskDate <= oneMonthFromNow;
      }),
      future: sortedTasks.filter(task => {
        const taskDate = new Date(task.displayDate);
        return taskDate > oneMonthFromNow;
      })
    };

    return { groups, sortedTasks };
  }, [tasks]);

  const getStatusColor = (status: string, isCompleted: boolean) => {
    if (isCompleted) return 'bg-green-500';
    switch (status.toLowerCase()) {
      case 'in progress': return 'bg-blue-500';
      case 'to do': return 'bg-gray-400';
      case 'blocked': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
    });
  };

  const TimelineGroup = ({ title, tasks, color }: { title: string; tasks: any[]; color: string }) => {
    if (tasks.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${color}`}></div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <Badge variant="outline" className="text-xs">{tasks.length}</Badge>
        </div>
        
        <div className="ml-6 space-y-4">
          {tasks.map((task, index) => (
            <div key={task.id} className="relative">
              {/* Timeline connector */}
              {index < tasks.length - 1 && (
                <div className="absolute left-6 top-16 w-0.5 h-8 bg-gray-200"></div>
              )}
              
              <div className="flex items-start gap-4">
                {/* Timeline node */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border-2 border-white shadow-md ${getStatusColor(task.status, task.isCompleted)}`}></div>
                  <div className="text-xs text-gray-500 mt-1 text-center min-w-20">
                    {formatDate(task.displayDate)}
                  </div>
                </div>
                
                {/* Task card */}
                <Card 
                  className="flex-1 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
                  onClick={() => onTaskClick(task)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          <Badge variant={task.isCompleted ? "default" : "secondary"} className="text-xs">
                            {task.status}
                          </Badge>
                          {task.priority && (
                            <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                          <span>Section: {task.section}</span>
                          <span>Progress: {task.progress}%</span>
                          {task.subtasks && task.subtasks.length > 0 && (
                            <span>{task.subtasks.length} subtasks</span>
                          )}
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              task.isCompleted ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                        
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>Due: {formatDate(task.dueDate)}</span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(task.url, '_blank');
                        }}
                        className="ml-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Project Timeline</h2>
        <div className="text-sm text-gray-500">
          Total: {tasks.length} tasks
        </div>
      </div>
      
      <div className="relative">
        {/* Main timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-8">
          <TimelineGroup 
            title="Overdue" 
            tasks={timelineData.groups.overdue} 
            color="bg-red-500" 
          />
          <TimelineGroup 
            title="This Week" 
            tasks={timelineData.groups.thisWeek} 
            color="bg-blue-500" 
          />
          <TimelineGroup 
            title="Upcoming" 
            tasks={timelineData.groups.upcoming} 
            color="bg-yellow-500" 
          />
          <TimelineGroup 
            title="Future" 
            tasks={timelineData.groups.future} 
            color="bg-gray-400" 
          />
        </div>
        
        {timelineData.sortedTasks.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-600">No tasks in timeline</p>
              <p className="text-sm text-gray-500 mt-2">
                Tasks will appear here when they have due dates or creation dates
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}