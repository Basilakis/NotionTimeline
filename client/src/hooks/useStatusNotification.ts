import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface StatusChangeData {
  taskId: string;
  oldStatus: string;
  newStatus: string;
  userEmail: string;
  taskTitle: string;
  projectName?: string;
  assigneeEmail?: string;
  taskUrl?: string;
  dueDate?: string;
  priority?: string;
}

export function useStatusNotification() {
  const { toast } = useToast();

  const statusChangeMutation = useMutation({
    mutationFn: async (data: StatusChangeData) => {
      const { taskId, ...statusChange } = data;
      return api.sendStatusChangeNotification(taskId, statusChange);
    },
    onSuccess: (result) => {
      if (result.notificationSent) {
        toast({
          title: "Status Update Sent",
          description: "Email notification sent successfully.",
          variant: "default",
        });
      } else {
        toast({
          title: "Status Updated",
          description: "Status changed but notification failed to send.",
          variant: "default",
        });
      }
    },
    onError: (error) => {
      console.error('Status notification error:', error);
      toast({
        title: "Notification Failed",
        description: "Status may have updated but email notification failed.",
        variant: "destructive",
      });
    },
  });

  const triggerStatusChange = async (data: StatusChangeData) => {
    // Skip if status hasn't changed
    if (data.oldStatus === data.newStatus) {
      return;
    }

    console.log('[Status Change] Triggering notification:', {
      task: data.taskTitle,
      from: data.oldStatus,
      to: data.newStatus,
      recipient: data.assigneeEmail || data.userEmail
    });

    await statusChangeMutation.mutateAsync(data);
  };

  return {
    triggerStatusChange,
    isLoading: statusChangeMutation.isPending,
    error: statusChangeMutation.error,
  };
}

// Utility function to extract task data for status change notifications
export function createStatusChangeData(
  task: any,
  oldStatus: string,
  newStatus: string,
  userEmail: string
): StatusChangeData {
  return {
    taskId: task.notionId || task.id,
    oldStatus,
    newStatus,
    userEmail,
    taskTitle: task.title,
    projectName: task.project?.title || task.projectName || 'Unknown Project',
    assigneeEmail: task.assigneeEmail || task.userEmail,
    taskUrl: task.url || `https://notion.so/${task.notionId || task.id}`,
    dueDate: task.dueDate,
    priority: task.priority,
  };
}