import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Header } from "@/components/timeline/header";
import { Sidebar } from "@/components/timeline/sidebar";
import { TimelineView } from "@/components/timeline/timeline-view";
import { TaskDetailModal } from "@/components/timeline/task-detail-modal";
import type { Task } from "@shared/schema";

export default function Timeline() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['/api/tasks', filterStatus === 'all' ? undefined : filterStatus],
    queryFn: () => api.getTasks(filterStatus === 'all' ? undefined : filterStatus),
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['/api/tasks/stats'],
    queryFn: api.getTaskStats,
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
      await api.syncTasks('default');
      refetchTasks();
      refetchStats();
    } catch (error) {
      console.error('Failed to sync tasks:', error);
    }
  };

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
  };

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
