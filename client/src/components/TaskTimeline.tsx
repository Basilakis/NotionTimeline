import React, { useMemo } from 'react';
import Timeline from 'react-timelines';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, Clock } from 'lucide-react';

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
  // Transform tasks data for react-timelines
  const timelineData = useMemo(() => {
    if (tasks.length === 0) {
      return {
        tracks: [],
        start: new Date(),
        end: new Date(),
        now: new Date()
      };
    }

    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get date range for timeline
    const validDates = tasks.map(task => 
      new Date(task.dueDate || task.createdTime).getTime()
    ).filter(date => !isNaN(date));

    const minDate = new Date(Math.min(...validDates));
    const maxDate = new Date(Math.max(...validDates));

    // Extend range if needed
    const timelineStart = new Date(Math.min(minDate.getTime(), oneWeekAgo.getTime()));
    const timelineEnd = new Date(Math.max(maxDate.getTime(), oneMonthFromNow.getTime()));

    // Create tracks (sections/projects)
    const sections = [...new Set(tasks.map(task => task.section))];
    const tracks = sections.map((section, index) => ({
      id: `track-${index}`,
      title: section || 'Uncategorized',
      elements: tasks
        .filter(task => task.section === section)
        .map(task => {
          const startTime = new Date(task.createdTime);
          const endTime = new Date(task.dueDate || task.lastEditedTime);
          
          // Ensure end time is after start time
          if (endTime <= startTime) {
            endTime.setTime(startTime.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
          }

          return {
            id: task.id,
            title: task.title,
            start: startTime,
            end: endTime,
            style: {
              backgroundColor: getStatusColor(task.status, task.isCompleted),
              color: 'white',
              borderRadius: '4px',
              border: task.priority === 'High' ? '2px solid #dc2626' : 'none'
            },
            tooltip: `${task.title} - ${task.status} (${task.progress}%)`,
            task: task
          };
        })
    }));

    return {
      tracks,
      start: timelineStart,
      end: timelineEnd,
      now: today
    };
  }, [tasks]);

  const getStatusColor = (status: string, isCompleted: boolean) => {
    if (isCompleted) return '#10b981'; // green
    switch (status.toLowerCase()) {
      case 'in progress': return '#3b82f6'; // blue
      case 'to do': return '#6b7280'; // gray
      case 'blocked': return '#dc2626'; // red
      default: return '#6b7280'; // gray
    }
  };

  const handleElementClick = (element: any) => {
    if (element.task) {
      onTaskClick(element.task);
    }
  };

  const customElementComponent = ({ element, ...props }: any) => {
    const task = element.task;
    const width = props.width || 100;
    const height = props.height || 24;
    
    return (
      <div
        style={{
          ...element.style,
          width: `${width}px`,
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        }}
        onClick={() => handleElementClick(element)}
        title={element.tooltip}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {element.title}
        </span>
        <span style={{ fontSize: '10px', marginLeft: '4px' }}>
          {task.progress}%
        </span>
      </div>
    );
  };

  // Custom timeline configuration
  const timelineConfig = {
    header: {
      dateFormat: 'MMM DD',
      height: 40
    },
    timeline: {
      height: 400
    },
    sidebar: {
      width: 200
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-600">No tasks in timeline</p>
          <p className="text-sm text-gray-500 mt-2">
            Tasks will appear here when they have due dates or creation dates
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Project Timeline</h2>
        <div className="text-sm text-gray-500">
          Total: {tasks.length} tasks across {timelineData.tracks.length} sections
        </div>
      </div>
      
      <Card>
        <CardContent className="p-4">
          <div className="mb-4">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded"></div>
                <span>To Do</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Red border = High priority</span>
              </div>
            </div>
          </div>
          
          <div style={{ height: '500px', overflow: 'auto' }}>
            <Timeline
              scale={{
                start: timelineData.start,
                end: timelineData.end,
                zoom: 1,
                zoomMin: 1,
                zoomMax: 20
              }}
              isOpen={true}
              toggleOpen={() => {}}
              zoomIn={() => {}}
              zoomOut={() => {}}
              tracks={timelineData.tracks}
              now={timelineData.now}
              format="MMM DD"
              elementClick={handleElementClick}
              elementComponent={customElementComponent}
            />
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>Click on any task bar to view details. Hover to see tooltip information.</p>
            <p>Timeline shows tasks from creation date to due date (or last edited date).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}