import { useState, useMemo, useCallback } from 'react';
import Timeline, { TimelineGroupBase, TimelineItemBase } from 'react-calendar-timeline';
import moment from 'moment';
import { useQuery } from '@tanstack/react-query';
import 'react-calendar-timeline/dist/style.css';

interface StatusOption {
  name: string;
  color: string;
}

// Notion color mapping to Tailwind classes
const getNotionColorClasses = (notionColor: string): { badge: string; timeline: string } => {
  const colorMap = {
    'default': {
      badge: 'bg-gray-100 text-gray-800 border-gray-200',
      timeline: '#e5e7eb'
    },
    'gray': {
      badge: 'bg-gray-100 text-gray-800 border-gray-200',
      timeline: '#e5e7eb'
    },
    'brown': {
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      timeline: '#fef3c7'
    },
    'orange': {
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
      timeline: '#fed7aa'
    },
    'yellow': {
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      timeline: '#fef3c7'
    },
    'green': {
      badge: 'bg-green-100 text-green-800 border-green-200',
      timeline: '#dcfce7'
    },
    'blue': {
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      timeline: '#dbeafe'
    },
    'purple': {
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      timeline: '#e9d5ff'
    },
    'pink': {
      badge: 'bg-pink-100 text-pink-800 border-pink-200',
      timeline: '#fce7f3'
    },
    'red': {
      badge: 'bg-red-100 text-red-800 border-red-200',
      timeline: '#fee2e2'
    },
  };
  
  return colorMap[notionColor] || colorMap['default'];
};

interface Task {
  id: string;
  title: string;
  status: string;
  mainStatus?: string;
  subStatus?: string;
  statusColor?: string;
  statusGroup?: string;
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

interface TimelineGroup extends TimelineGroupBase {
  id: string | number;
  title: string;
  rightTitle?: string;
  height?: number;
  parent?: string | number;
  stackItems?: boolean;
}

interface TimelineItem extends TimelineItemBase {
  id: string | number;
  group: string | number;
  title: string;
  start_time: moment.Moment;
  end_time: moment.Moment;
  itemProps?: {
    style?: React.CSSProperties;
    className?: string;
    'data-custom-attribute'?: string;
  };
  task?: Task;
}

export default function TaskTimeline({ tasks, onTaskClick }: TaskTimelineProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Fetch status options from API
  const { data: statusOptions = [] } = useQuery<StatusOption[]>({
    queryKey: ['/api/notion-statuses'],
    enabled: true,
  });

  const getStatusColorFromOptions = (statusName: string, statusOptions: StatusOption[]): { badge: string; timeline: string } => {
    const option = statusOptions.find(opt => opt.name === statusName);
    if (option && option.color) {
      return getNotionColorClasses(option.color);
    }
    return getNotionColorClasses('default');
  };

  const getStatusColor = useCallback((task: Task) => {
    if (task.isCompleted) return { bg: '#dcfce7', border: '#16a34a', progress: '#15803d' }; // Completed - green
    
    // Use Notion's actual status colors from API
    const colors = getStatusColorFromOptions(task.status, statusOptions);
    
    // Use dynamic colors based on Notion status
    const timelineColor = colors.timeline;
    
    switch (task.statusColor || 'default') {
      case 'blue':
        return { bg: timelineColor, border: '#2563eb', progress: '#1d4ed8' };
      case 'yellow':
        return { bg: timelineColor, border: '#d97706', progress: '#b45309' };
      case 'green':
        return { bg: timelineColor, border: '#16a34a', progress: '#15803d' };
      case 'red':
        return { bg: timelineColor, border: '#dc2626', progress: '#b91c1c' };
      case 'purple':
        return { bg: timelineColor, border: '#9333ea', progress: '#7c3aed' };
      case 'gray':
      case 'default':
        return { bg: timelineColor, border: '#6b7280', progress: '#4b5563' };
      default:
        return { bg: timelineColor, border: '#6b7280', progress: '#4b5563' };
    }
  }, [statusOptions]);

  const { groups, items, defaultTimeStart, defaultTimeEnd } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return {
        groups: [],
        items: [],
        defaultTimeStart: moment().startOf('day'),
        defaultTimeEnd: moment().endOf('day')
      };
    }

    // Get all valid dates from tasks
    const validDates = tasks.flatMap(task => {
      const dates = [];
      if (task.createdTime) dates.push(moment(task.createdTime));
      if (task.dueDate) dates.push(moment(task.dueDate));
      if (task.lastEditedTime) dates.push(moment(task.lastEditedTime));
      return dates.filter(date => date.isValid());
    });

    if (validDates.length === 0) {
      return {
        groups: [],
        items: [],
        defaultTimeStart: moment().startOf('day'),
        defaultTimeEnd: moment().endOf('day')
      };
    }

    const minDate = moment.min(validDates);
    const maxDate = moment.max(validDates);

    // Extend range for better visualization
    const timeStart = minDate.clone().subtract(1, 'month').startOf('month');
    const timeEnd = maxDate.clone().add(2, 'months').endOf('month');

    // Group tasks by project name - use a smarter approach based on task categories
    const projectGroups = tasks.reduce((groups, task) => {
      let projectName = 'Uncategorized Tasks';
      
      // Strategy 1: Use the task title itself to infer project
      // Many Greek tasks belong to specific projects
      const title = task.title.toLowerCase();
      
      if (title.includes('αποξηλώσ') || title.includes('υδραυλ') || title.includes('ηλεκτρολογ') || title.includes('θέρμανση')) {
        projectName = 'Vertex Developments';
      } else if (title.includes('ethos') || title.includes('ai') || title.includes('starter')) {
        projectName = 'ethos';
      } else if (title.includes('creative') || title.includes('design')) {
        projectName = 'creativeG';
      } else if (title.includes('template') || title.includes('example')) {
        projectName = 'Project Template';
      }
      
      // Strategy 2: Use section if it's not "Uncategorized"
      if (projectName === 'Uncategorized Tasks' && task.section && task.section !== 'Uncategorized') {
        projectName = task.section;
      }
      
      // Strategy 3: Check URL patterns for project identification
      if (projectName === 'Uncategorized Tasks' && task.url) {
        const url = task.url.toLowerCase();
        if (url.includes('vertex')) {
          projectName = 'Vertex Developments';
        } else if (url.includes('ethos')) {
          projectName = 'ethos';
        } else if (url.includes('creative')) {
          projectName = 'creativeG';
        }
      }
      
      // Strategy 4: Group by task type based on properties
      if (projectName === 'Uncategorized Tasks' && task.properties) {
        const hasTaskProgress = task.properties['Task Progress'];
        const hasProjectStatus = task.properties['Project Status'];
        
        if (hasProjectStatus && hasProjectStatus.rollup && hasProjectStatus.rollup.array) {
          // This indicates it's part of a project structure
          if (title.includes('gmail') || title.includes('saas') || title.includes('ai')) {
            projectName = 'ethos';
          } else {
            projectName = 'Development Tasks';
          }
        }
      }
      
      console.log('Assigned project name:', projectName, 'for task:', task.title);
      
      if (!groups[projectName]) {
        groups[projectName] = [];
      }
      groups[projectName].push(task);
      return groups;
    }, {} as Record<string, typeof tasks>);

    // Create hierarchical groups and items
    const timelineGroups: TimelineGroup[] = [];
    const timelineItems: TimelineItem[] = [];
    let groupIndex = 0;
    let itemIndex = 0;

    Object.entries(projectGroups).forEach(([projectName, projectTasks]) => {
      const projectGroupId = `project-${groupIndex}`;
      
      // Add project header group
      timelineGroups.push({
        id: projectGroupId,
        title: `📁 ${projectName}`,
        rightTitle: `${projectTasks.length} tasks`,
        height: 40,
        stackItems: false
      });

      // Add task groups and items for this project
      projectTasks.forEach((task, taskIndex) => {
        const taskGroupId = `task-${groupIndex}-${taskIndex}`;
        const startTime = moment(task.createdTime);
        let endTime = moment(task.dueDate || task.lastEditedTime);
        
        // Ensure end time is after start time
        if (!endTime.isValid() || endTime.isSameOrBefore(startTime)) {
          endTime = startTime.clone().add(7, 'days'); // Default 1 week duration
        }

        // Add task group
        timelineGroups.push({
          id: taskGroupId,
          title: `  ${task.title}`,
          rightTitle: `${task.status} (${task.progress}%)`,
          height: 30,
          parent: projectGroupId,
          stackItems: false
        });

        const colors = getStatusColor(task);
        
        // Add task item with progress bar styling
        timelineItems.push({
          id: `item-${itemIndex}`,
          group: taskGroupId,
          title: task.title,
          start_time: startTime,
          end_time: endTime,
          itemProps: {
            style: {
              backgroundColor: colors.bg,
              border: `2px solid ${task.priority === 'High' ? '#dc2626' : colors.border}`,
              borderRadius: '6px',
              color: '#1f2937', // Dark text for readability
              fontSize: '12px',
              fontWeight: '500',
              position: 'relative',
              overflow: 'hidden',
              // Add a subtle gradient for depth using API colors
              background: `linear-gradient(to right, ${colors.progress} 0%, ${colors.progress} ${task.progress}%, ${colors.bg} ${task.progress}%, ${colors.bg} 100%)`
            },
            className: `${getStatusColorFromOptions(task.status, statusOptions).badge}`
          },
          task: task
        });

        // Add subtask items if they exist
        if (task.subtasks && task.subtasks.length > 0) {
          task.subtasks.forEach((subtask: any, subIndex: number) => {
            const subtaskGroupId = `subtask-${groupIndex}-${taskIndex}-${subIndex}`;
            
            // Add subtask group
            timelineGroups.push({
              id: subtaskGroupId,
              title: `    → ${subtask.title || subtask.name || 'Subtask'}`,
              height: 25,
              parent: taskGroupId,
              stackItems: false
            });

            // Add subtask item with improved styling
            timelineItems.push({
              id: `subitem-${itemIndex}-${subIndex}`,
              group: subtaskGroupId,
              title: subtask.title || subtask.name || 'Subtask',
              start_time: startTime.clone(),
              end_time: startTime.clone().add(3, 'days'), // 3 days duration for subtasks
              itemProps: {
                style: {
                  backgroundColor: '#f1f5f9', // Light gray background
                  border: '1px solid #64748b',
                  borderRadius: '4px',
                  color: '#1e293b', // Dark text for readability
                  fontSize: '11px',
                  fontWeight: '400'
                }
              },
              task: subtask
            });
          });
        }

        itemIndex++;
      });

      groupIndex++;
    });

    return {
      groups: timelineGroups,
      items: timelineItems,
      defaultTimeStart: timeStart,
      defaultTimeEnd: timeEnd
    };
  }, [tasks, getStatusColor]);

  const handleItemClick = useCallback((itemId: string | number, e: React.SyntheticEvent, time: number) => {
    const item = items.find(item => item.id === itemId);
    if (item && item.task) {
      onTaskClick(item.task);
    }
  }, [items, onTaskClick]);

  const handleItemSelect = useCallback((itemId: string | number, e: React.SyntheticEvent, time: number) => {
    // Optional: Handle item selection
  }, []);

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
              {tasks.length} tasks across {Object.keys(groups.reduce((acc, group) => {
                if (!group.parent) acc[group.id] = true;
                return acc;
              }, {} as Record<string, boolean>)).length} projects
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Done</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Planning</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>In Progress</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span>Paused</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-500 rounded"></div>
                <span>Backlog</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Canceled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ height: '600px' }}>
        <Timeline
          groups={groups}
          items={items}
          defaultTimeStart={defaultTimeStart}
          defaultTimeEnd={defaultTimeEnd}
          onItemClick={handleItemClick}
          onItemSelect={handleItemSelect}
          canMove={false}
          canResize={false}
          canChangeGroup={false}
          lineHeight={30}
          itemHeightRatio={0.8}
          sidebarWidth={300}
          rightSidebarWidth={150}
          timeSteps={{
            second: 1,
            minute: 1,
            hour: 1,
            day: 1,
            month: 1,
            year: 1
          }}
          minZoom={24 * 60 * 60 * 1000} // 1 day
          maxZoom={365.24 * 86400 * 1000 * 5} // 5 years
        />
      </div>
    </div>
  );
}