import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCard } from "./task-card";
import { Clock } from "lucide-react";
import type { Task } from "@shared/schema";

interface TimelineViewProps {
  tasks: Task[];
  isLoading: boolean;
  onTaskClick: (task: Task) => void;
}

export function TimelineView({ tasks, isLoading, onTaskClick }: TimelineViewProps) {
  if (isLoading) {
    return (
      <Card className="shadow-material fade-in">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-medium text-gray-900">Project Timeline</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="relative flex items-start space-x-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Skeleton className="w-3/4 h-5 mb-2" />
                    <Skeleton className="w-full h-4 mb-3" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="w-24 h-3" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="shadow-material fade-in">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-medium text-gray-900">Project Timeline</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>No tasks found</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Clock className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks to display</h3>
            <p className="text-gray-500 mb-4">
              Sync with your Notion database to see tasks in the timeline.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-material fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-medium text-gray-900">Project Timeline</CardTitle>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="timeline-container">
          {tasks.map((task, index) => (
            <div 
              key={task.id} 
              className={`relative ${index < tasks.length - 1 ? 'pb-8 timeline-connector' : 'pb-4'} fade-in`}
            >
              <TaskCard task={task} onClick={() => onTaskClick(task)} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
