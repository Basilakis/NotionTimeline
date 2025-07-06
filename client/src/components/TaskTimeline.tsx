import { useState, useMemo, useCallback } from 'react';
import Timeline from 'react-timelines';
import 'react-timelines/lib/css/style.css';

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
  const [openTracks, setOpenTracks] = useState<Record<string, boolean>>({});
  const [scale, setScale] = useState({
    start: new Date(),
    end: new Date(),
    zoom: 1,
    zoomMin: 1,
    zoomMax: 20
  });

  const getStatusColor = useCallback((status: string | null, isCompleted: boolean) => {
    if (isCompleted) return '#10b981'; // Green
    switch (status?.toLowerCase()) {
      case 'in progress':
      case 'doing':
        return '#3b82f6'; // Blue
      case 'done':
      case 'completed':
        return '#10b981'; // Green
      case 'blocked':
      case 'stuck':
        return '#ef4444'; // Red
      case 'to do':
      case 'todo':
      case 'not started':
        return '#6b7280'; // Gray
      default:
        return '#8b5cf6'; // Purple
    }
  }, []);

  const toggleOpen = useCallback((trackId: string) => {
    setOpenTracks(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  }, []);

  const zoomIn = useCallback(() => {
    setScale(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.2, prev.zoomMax)
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.2, prev.zoomMin)
    }));
  }, []);

  const clickTrackButton = useCallback((trackId: string) => {
    toggleOpen(trackId);
  }, [toggleOpen]);

  const isOpen = true;

  const timelineData = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return {
        tracks: [],
        start: new Date(),
        end: new Date(),
        now: new Date(),
        timebar: []
      };
    }

    const today = new Date();
    
    // Get all valid dates from tasks
    const validDates = tasks.flatMap(task => {
      const dates = [];
      if (task.createdTime) dates.push(new Date(task.createdTime).getTime());
      if (task.dueDate) dates.push(new Date(task.dueDate).getTime());
      if (task.lastEditedTime) dates.push(new Date(task.lastEditedTime).getTime());
      return dates;
    }).filter(date => !isNaN(date));

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

    // Group tasks by project name first
    const projectGroups = tasks.reduce((groups, task) => {
      // Extract project name from task properties 
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

    // Create hierarchical tracks structure
    const tracks: any[] = [];
    let trackIndex = 0;

    Object.entries(projectGroups).forEach(([projectName, projectTasks]) => {
      // Create project header track
      const projectTrackId = `project-${trackIndex}`;
      
      // Create task tracks for this project
      const taskTracks = projectTasks.map((task, taskIndex) => {
        const startTime = new Date(task.createdTime);
        const endTime = new Date(task.dueDate || task.lastEditedTime);
        
        // Ensure end time is after start time
        if (endTime <= startTime) {
          endTime.setTime(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // Add 1 week
        }

        const taskTrackId = `task-${trackIndex}-${taskIndex}`;
        
        // Create subtask tracks if they exist
        const subtaskTracks = task.subtasks && task.subtasks.length > 0 
          ? task.subtasks.map((subtask: any, subIndex: number) => ({
              id: `subtask-${trackIndex}-${taskIndex}-${subIndex}`,
              title: `    → ${subtask.title || subtask.name || 'Subtask'}`,
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
            }))
          : [];

        return {
          id: taskTrackId,
          title: `  ${task.title}`,
          hasButton: task.subtasks && task.subtasks.length > 0,
          isOpen: openTracks[taskTrackId] || false,
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
          }],
          tracks: subtaskTracks
        };
      });

      // Add project track with child task tracks
      tracks.push({
        id: projectTrackId,
        title: `📁 ${projectName}`,
        hasButton: true,
        isOpen: openTracks[projectTrackId] !== false, // default to open
        elements: [], // Project header has no elements
        tracks: taskTracks
      });
      
      trackIndex++;
    });

    // Create timebar with proper month and week labels
    const timebar = [];
    const currentDate = new Date(timelineStart);
    
    while (currentDate <= timelineEnd) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Add month header
      timebar.push({
        id: `month-${currentDate.getFullYear()}-${currentDate.getMonth()}`,
        title: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        start: monthStart,
        end: monthEnd,
        style: {
          backgroundColor: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 'bold'
        }
      });
      
      // Add week headers within the month
      const weekStart = new Date(monthStart);
      while (weekStart <= monthEnd) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const weekNumber = Math.ceil((weekStart.getDate() + monthStart.getDay()) / 7);
        
        timebar.push({
          id: `week-${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekNumber}`,
          title: `W${weekNumber}`,
          start: new Date(weekStart),
          end: weekEnd > monthEnd ? monthEnd : weekEnd,
          style: {
            backgroundColor: '#f9fafb',
            borderRight: '1px solid #e5e7eb',
            fontSize: '11px'
          }
        });
        
        weekStart.setDate(weekStart.getDate() + 7);
      }
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return {
      tracks,
      start: timelineStart,
      end: timelineEnd,
      now: today,
      timebar
    };
  }, [tasks, getStatusColor, openTracks]);

  const handleElementClick = (element: any) => {
    if (element && element.task) {
      onTaskClick(element.task);
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">No tasks available for timeline view</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Project Timeline</h3>
            <p className="text-sm text-gray-500">
              {tasks.length} tasks across {Object.keys(timelineData.tracks).length} projects
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Zoom Out
            </button>
            <button
              onClick={zoomIn}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Zoom In
            </button>
          </div>
        </div>
      </div>
      
      <div style={{ height: '600px', overflow: 'auto' }}>
        <Timeline
          scale={{
            start: timelineData.start,
            end: timelineData.end,
            zoom: scale.zoom,
            zoomMin: scale.zoomMin,
            zoomMax: scale.zoomMax
          }}
          isOpen={isOpen}
          toggleOpen={toggleOpen}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          tracks={timelineData.tracks}
          now={timelineData.now}
          timebar={timelineData.timebar}
          clickElement={handleElementClick}
          clickTrackButton={clickTrackButton}
        />
      </div>
    </div>
  );
}