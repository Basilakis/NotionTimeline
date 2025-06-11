import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Task } from "@shared/schema";

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  if (!task) return null;

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
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-900">
            {task.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {task.description && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Description
              </label>
              <p className="text-sm text-gray-500 whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Status
              </label>
              {getStatusBadge(task.status)}
            </div>
            
            {task.assignee && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Assignee
                </label>
                <p className="text-sm text-gray-500">{task.assignee}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Due Date
              </label>
              <p className="text-sm text-gray-500">{formatDate(task.dueDate)}</p>
            </div>
            
            {task.priority && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Priority
                </label>
                <p className="text-sm text-gray-500 capitalize">{task.priority}</p>
              </div>
            )}
            
            {task.section && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Section
                </label>
                <p className="text-sm text-gray-500">{task.section}</p>
              </div>
            )}
            
            {task.completedAt && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Completed At
                </label>
                <p className="text-sm text-gray-500">{formatDate(task.completedAt)}</p>
              </div>
            )}
          </div>
          
          {task.notionUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Notion Link
              </label>
              <Button
                variant="link"
                className="text-sm text-blue-700 hover:text-blue-500 p-0 h-auto"
                onClick={() => window.open(task.notionUrl!, '_blank')}
              >
                View in Notion <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {task.notionUrl && (
            <Button
              onClick={() => window.open(task.notionUrl!, '_blank')}
              className="bg-blue-700 text-white hover:bg-blue-600"
            >
              Edit in Notion
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
