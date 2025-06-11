import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/timeline/header";
import { Sidebar } from "@/components/timeline/sidebar";
import { TimelineView } from "@/components/timeline/timeline-view";
import { TaskDetailModal } from "@/components/timeline/task-detail-modal";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";

export default function Timeline() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if user has Notion configuration
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['/api/config', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        return await api.getConfiguration(user.email);
      } catch (error) {
        return null; // No configuration exists
      }
    },
    enabled: !!user?.email,
  });

  // Redirect to setup if no configuration exists
  useEffect(() => {
    if (!configLoading && user && !config) {
      setLocation('/setup');
    }
  }, [config, configLoading, user, setLocation]);

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['/api/tasks', filterStatus === 'all' ? undefined : filterStatus],
    queryFn: () => api.getTasks(filterStatus === 'all' ? undefined : filterStatus),
    enabled: !!config, // Only fetch tasks if configuration exists
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['/api/tasks/stats'],
    queryFn: api.getTaskStats,
    enabled: !!config,
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleSyncTasks = async () => {
    try {
      const result = await api.syncTasks();
      toast({
        title: "Sync completed",
        description: result.message,
      });
      refetchTasks();
      refetchStats();
    } catch (error) {
      console.error('Failed to sync tasks:', error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Failed to sync tasks from Notion",
        variant: "destructive",
      });
    }
  };

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
  };

  // Show loading while checking configuration
  if (configLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header 
        filterStatus={filterStatus}
        onFilterChange={handleFilterChange}
        onSync={handleSyncTasks}
        isLoading={tasksLoading}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <Sidebar 
            stats={stats}
            onSync={handleSyncTasks}
            isLoading={tasksLoading}
          />
          
          <main className="lg:col-span-3">
            <TimelineView 
              tasks={tasks}
              isLoading={tasksLoading}
              onTaskClick={handleTaskClick}
            />
          </main>
        </div>
      </div>

      <TaskDetailModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={handleCloseTaskModal}
      />
    </div>
  );
}
