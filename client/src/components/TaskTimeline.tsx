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
  const getStatusColor = (status: string, isCompleted: boolean) => {
    if (isCompleted) return '#10b981'; // green
    switch (status.toLowerCase()) {
      case 'in progress': return '#3b82f6'; // blue
      case 'to do': return '#6b7280'; // gray
      case 'blocked': return '#dc2626'; // red
      default: return '#6b7280'; // gray
    }
  };

  // Transform tasks data for react-timelines
  const timelineData = useMemo(() => {
    if (tasks.length === 0) {
      return {
        tracks: [],
        start: new Date(),
        end: new Date(),
        now: new Date(),
        timebar: []
      };
    }

    const today = new Date();
    
    // Get date range for timeline
    const validDates = tasks.map(task => 
      new Date(task.dueDate || task.createdTime).getTime()
    ).filter(date => !isNaN(date));

    if (validDates.length === 0) {
      return {
        tracks: [],
        start: new Date(),
        end: new Date(),
        now: today,
        timebar: []
      };
    }

    const minDate = new Date(Math.min(...validDates));
    const maxDate = new Date(Math.max(...validDates));

    // Extend range by a few months for better visualization
    const timelineStart = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
    const timelineEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

    // Group tasks by project first, then create individual tracks for each task
    const projectGroups = tasks.reduce((groups, task) => {
      // Extract project name from task properties or use section
      let projectName = 'General Tasks';
      
      if (task.properties) {
        // Try to find project name in various property formats
        if (task.properties.Project && typeof task.properties.Project === 'string') {
          projectName = task.properties.Project;
        } else if (task.properties.project && typeof task.properties.project === 'string') {
          projectName = task.properties.project;
        } else if (task.properties.Project && task.properties.Project.select) {
          projectName = task.properties.Project.select.name;
        } else if (task.properties.project && task.properties.project.select) {
          projectName = task.properties.project.select.name;
        } else if (task.properties.Project && Array.isArray(task.properties.Project) && task.properties.Project.length > 0) {
          projectName = task.properties.Project[0].name || task.properties.Project[0];
        }
      }
      
      // Fallback to section if no project found
      if (projectName === 'General Tasks' && task.section) {
        projectName = task.section;
      }
      
      if (!groups[projectName]) {
        groups[projectName] = [];
      }
      groups[projectName].push(task);
      return groups;
    }, {} as Record<string, typeof tasks>);

    // Create tracks - each task gets its own track, grouped by project
    const tracks: any[] = [];
    let trackIndex = 0;

    Object.entries(projectGroups).forEach(([projectName, projectTasks]) => {
      // Add project header track
      tracks.push({
        id: `project-${trackIndex}`,
        title: projectName,
        isOpen: true,
        hasButton: true,
        elements: [],
        tracks: projectTasks.map((task, taskIndex) => {
          const startTime = new Date(task.createdTime);
          const endTime = new Date(task.dueDate || task.lastEditedTime);
          
          // Ensure end time is after start time
          if (endTime <= startTime) {
            endTime.setTime(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // Add 1 week
          }

          const taskTrack = {
            id: `task-${trackIndex}-${taskIndex}`,
            title: task.title,
            hasButton: task.subtasks && task.subtasks.length > 0,
            isOpen: false,
            elements: [{
              id: task.id,
              title: task.title,
              start: startTime,
              end: endTime,
              style: {
                backgroundColor: getStatusColor(task.status, task.isCompleted),
                color: 'white',
                borderRadius: '4px',
                border: task.priority === 'High' ? '2px solid #dc2626' : 'none',
                fontSize: '12px',
                padding: '2px 6px'
              },
              tooltip: `${task.title} - ${task.status} (${task.progress}%)`,
              task: task
            }]
          };

          // Add subtask tracks if they exist
          if (task.subtasks && task.subtasks.length > 0) {
            taskTrack.tracks = task.subtasks.map((subtask: any, subIndex: number) => ({
              id: `subtask-${trackIndex}-${taskIndex}-${subIndex}`,
              title: `  → ${subtask.title || subtask.name || 'Subtask'}`,
              elements: [{
                id: `${task.id}-sub-${subIndex}`,
                title: subtask.title || subtask.name || 'Subtask',
                start: startTime,
                end: new Date(startTime.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days duration
                style: {
                  backgroundColor: '#94a3b8', // gray for subtasks
                  color: 'white',
                  borderRadius: '2px',
                  fontSize: '11px',
                  padding: '1px 4px'
                },
                tooltip: `Subtask: ${subtask.title || subtask.name}`,
                task: subtask
              }]
            }));
          }

          return taskTrack;
        })
      });
      trackIndex++;
    });

    // Create timebar with months and days
    const timebar = [
      {
        id: 'months',
        title: 'Months',
        cells: []
      },
      {
        id: 'weeks',
        title: 'Weeks', 
        cells: []
      }
    ];

    return {
      tracks,
      start: timelineStart,
      end: timelineEnd,
      now: today,
      timebar
    };
  }, [tasks, getStatusColor]);

  const handleElementClick = (element: any) => {
    if (element && element.task) {
      onTaskClick(element.task);
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
              timebar={timelineData.timebar}
              clickElement={handleElementClick}
              clickTrackButton={() => {}}
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