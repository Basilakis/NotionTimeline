import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Database, Download } from "lucide-react";
import type { TaskStats } from "@/lib/api";

interface SidebarProps {
  stats?: TaskStats;
  onSync: () => void;
  isLoading: boolean;
}

export function Sidebar({ stats, onSync, isLoading }: SidebarProps) {
  if (isLoading || !stats) {
    return (
      <aside className="lg:col-span-1">
        <Card className="mb-6 fade-in">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="w-16 h-4" />
                </div>
                <Skeleton className="w-6 h-4" />
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card className="fade-in">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-12" />
            ))}
          </CardContent>
        </Card>
      </aside>
    );
  }

  return (
    <aside className="lg:col-span-1">
      <Card className="shadow-material mb-6 fade-in">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full task-status-completed"></div>
              <span className="text-sm text-gray-500">Completed</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{stats.completed}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full task-status-pending"></div>
              <span className="text-sm text-gray-500">Pending</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{stats.pending}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full task-status-not-started"></div>
              <span className="text-sm text-gray-500">Not Started</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{stats.notStarted}</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-material fade-in">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm hover:bg-gray-50 smooth-transition"
            onClick={() => window.open('https://notion.so', '_blank')}
          >
            <Plus className="h-4 w-4 mr-2 text-blue-700" />
            Create New Task
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-sm hover:bg-gray-50 smooth-transition"
            onClick={onSync}
            disabled={isLoading}
          >
            <Database className="h-4 w-4 mr-2 text-green-600" />
            Sync with Notion
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-sm hover:bg-gray-50 smooth-transition"
          >
            <Download className="h-4 w-4 mr-2 text-gray-500" />
            Export Timeline
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}
