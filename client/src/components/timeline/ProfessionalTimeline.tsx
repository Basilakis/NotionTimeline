import React, { useState, useMemo } from 'react';
import Timeline from 'react-calendar-timeline';
import moment from 'moment';
import 'react-calendar-timeline/dist/style.css';
import { ChevronRight, ChevronDown, Calendar, Clock, User, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Task {
  id: string;
  title: string;
  status: string;
  statusColor: string;
  priority: string | null;
  dueDate: Date | null;
  createdTime: Date;
  lastEditedTime: Date;
  projectName: string;
  assignee: string | null;
  description: string;
  subtasks: Task[];
}

interface Project {
  id: string;
  name: string;
  tasks: Task[];
  startDate: Date;
  endDate: Date;
  status: string;
  color: string;
}

interface ProfessionalTimelineProps {
  tasks: Task[];
  projects: any[];
  onTaskClick: (task: Task) => void;
}

const ProfessionalTimeline: React.FC<ProfessionalTimelineProps> = ({
  tasks,
  projects,
  onTaskClick
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('month');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Process projects and tasks for timeline
  const timelineData = useMemo(() => {
    const groups: any[] = [];
    const items: any[] = [];
    let groupId = 0;

    // Group tasks by project
    const projectGroups: { [key: string]: Task[] } = {};
    
    tasks.forEach(task => {
      const projectName = task.projectName || 'Uncategorized';
      if (!projectGroups[projectName]) {
        projectGroups[projectName] = [];
      }
      projectGroups[projectName].push(task);
    });

    Object.entries(projectGroups).forEach(([projectName, projectTasks]) => {
      const projectGroupId = ++groupId;
      const isExpanded = expandedProjects.has(projectName);
      
      // Add project group
      groups.push({
        id: projectGroupId,
        title: projectName,
        stackItems: true,
        height: 50,
        isProject: true,
        expanded: isExpanded,
        taskCount: projectTasks.length
      });

      // Calculate project timeline
      const projectStart = projectTasks.reduce((earliest, task) => {
        const taskStart = task.createdTime || new Date();
        return taskStart < earliest ? taskStart : earliest;
      }, new Date());

      const projectEnd = projectTasks.reduce((latest, task) => {
        const taskEnd = task.dueDate || task.lastEditedTime || new Date();
        return taskEnd > latest ? taskEnd : latest;
      }, new Date());

      // Add project item
      items.push({
        id: `project-${projectName}`,
        group: projectGroupId,
        title: `${projectName} (${projectTasks.length} tasks)`,
        start_time: moment(projectStart),
        end_time: moment(projectEnd),
        canMove: false,
        canResize: false,
        className: 'project-item',
        itemProps: {
          'data-project': projectName,
          'data-type': 'project'
        }
      });

      // Add individual tasks if project is expanded
      if (isExpanded) {
        projectTasks.forEach(task => {
          const taskGroupId = ++groupId;
          const taskStart = task.createdTime || new Date();
          const taskEnd = task.dueDate || task.lastEditedTime || new Date();
          
          groups.push({
            id: taskGroupId,
            title: `  └ ${task.title}`,
            stackItems: false,
            height: 40,
            isTask: true,
            parentProject: projectName,
            task: task
          });

          items.push({
            id: task.id,
            group: taskGroupId,
            title: task.title,
            start_time: moment(taskStart),
            end_time: moment(taskEnd),
            canMove: false,
            canResize: false,
            className: `task-item status-${task.status.toLowerCase().replace(' ', '-')}`,
            itemProps: {
              'data-task-id': task.id,
              'data-status': task.status,
              'data-priority': task.priority || 'none',
              'data-type': 'task'
            }
          });

          // Add subtasks if task is expanded
          if (expandedTasks.has(task.id) && task.subtasks?.length > 0) {
            task.subtasks.forEach(subtask => {
              const subtaskGroupId = ++groupId;
              const subtaskStart = subtask.createdTime || new Date();
              const subtaskEnd = subtask.dueDate || subtask.lastEditedTime || new Date();
              
              groups.push({
                id: subtaskGroupId,
                title: `    └ ${subtask.title}`,
                stackItems: false,
                height: 35,
                isSubtask: true,
                parentTask: task.id,
                task: subtask
              });

              items.push({
                id: subtask.id,
                group: subtaskGroupId,
                title: subtask.title,
                start_time: moment(subtaskStart),
                end_time: moment(subtaskEnd),
                canMove: false,
                canResize: false,
                className: `subtask-item status-${subtask.status.toLowerCase().replace(' ', '-')}`,
                itemProps: {
                  'data-task-id': subtask.id,
                  'data-status': subtask.status,
                  'data-priority': subtask.priority || 'none',
                  'data-type': 'subtask'
                }
              });
            });
          }
        });
      }
    });

    return { groups, items };
  }, [tasks, expandedProjects, expandedTasks]);

  const toggleProjectExpansion = (projectName: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectName)) {
      newExpanded.delete(projectName);
    } else {
      newExpanded.add(projectName);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getTimeRange = () => {
    const now = moment();
    switch (selectedTimeRange) {
      case 'week':
        return {
          visibleTimeStart: now.clone().startOf('week').valueOf(),
          visibleTimeEnd: now.clone().endOf('week').valueOf()
        };
      case 'month':
        return {
          visibleTimeStart: now.clone().startOf('month').valueOf(),
          visibleTimeEnd: now.clone().endOf('month').valueOf()
        };
      case 'quarter':
        return {
          visibleTimeStart: now.clone().startOf('quarter').valueOf(),
          visibleTimeEnd: now.clone().endOf('quarter').valueOf()
        };
      default:
        return {
          visibleTimeStart: now.clone().subtract(1, 'month').valueOf(),
          visibleTimeEnd: now.clone().add(2, 'months').valueOf()
        };
    }
  };

  const customGroupRenderer = ({ group }: any) => {
    const isProject = group.isProject;
    const isTask = group.isTask;
    const isSubtask = group.isSubtask;
    
    if (isProject) {
      const isExpanded = expandedProjects.has(group.title);
      return (
        <div className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
             onClick={() => toggleProjectExpansion(group.title)}>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold text-[#003319]">{group.title}</span>
          <Badge variant="secondary" className="ml-2">
            {group.taskCount}
          </Badge>
        </div>
      );
    }
    
    if (isTask) {
      const task = group.task;
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const isExpanded = expandedTasks.has(task.id);
      
      return (
        <div className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
             onClick={() => {
               if (hasSubtasks) {
                 toggleTaskExpansion(task.id);
               } else {
                 onTaskClick(task);
               }
             }}>
          {hasSubtasks && (
            <>
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </>
          )}
          <span className="text-sm">{group.title}</span>
          <Badge 
            variant="outline" 
            className={`text-xs ${task.statusColor === 'blue' ? 'border-blue-500 text-blue-700' : 
                                 task.statusColor === 'green' ? 'border-green-500 text-green-700' : 
                                 'border-gray-500 text-gray-700'}`}
          >
            {task.status}
          </Badge>
          {task.priority && (
            <Badge variant="outline" className="text-xs">
              <Flag className="h-3 w-3 mr-1" />
              {task.priority}
            </Badge>
          )}
        </div>
      );
    }
    
    if (isSubtask) {
      const subtask = group.task;
      return (
        <div className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
             onClick={() => onTaskClick(subtask)}>
          <span className="text-xs text-gray-600">{group.title}</span>
          <Badge 
            variant="outline" 
            className={`text-xs ${subtask.statusColor === 'blue' ? 'border-blue-500 text-blue-700' : 
                                 subtask.statusColor === 'green' ? 'border-green-500 text-green-700' : 
                                 'border-gray-500 text-gray-700'}`}
          >
            {subtask.status}
          </Badge>
        </div>
      );
    }
    
    return <span>{group.title}</span>;
  };

  const customItemRenderer = ({ item, getItemProps, getResizeProps }: any) => {
    const { className, ...otherProps } = getItemProps(item.itemProps);
    
    return (
      <div
        {...otherProps}
        className={`${className} timeline-item`}
        style={{
          backgroundColor: item.itemProps['data-type'] === 'project' ? '#003319' : 
                          item.itemProps['data-status'] === 'In Progress' ? '#3b82f6' :
                          item.itemProps['data-status'] === 'Done' ? '#10b981' : '#6b7280',
          color: 'white',
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '12px',
          border: item.itemProps['data-priority'] === 'High' ? '2px solid #ef4444' : 
                  item.itemProps['data-priority'] === 'Medium' ? '2px solid #f59e0b' : 'none'
        }}
      >
        {item.title}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Project Timeline
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={selectedTimeRange === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('week')}
            >
              Week
            </Button>
            <Button
              variant={selectedTimeRange === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('month')}
            >
              Month
            </Button>
            <Button
              variant={selectedTimeRange === 'quarter' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('quarter')}
            >
              Quarter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="timeline-container" style={{ height: '600px' }}>
          <Timeline
            groups={timelineData.groups}
            items={timelineData.items}
            {...getTimeRange()}
            onCanvasClick={(groupId, time) => {
              console.log('Timeline clicked:', { groupId, time });
            }}
            onItemClick={(itemId, e, time) => {
              const item = timelineData.items.find(i => i.id === itemId);
              if (item && item.itemProps['data-type'] === 'task') {
                const task = tasks.find(t => t.id === itemId);
                if (task) {
                  onTaskClick(task);
                }
              }
            }}
            groupRenderer={customGroupRenderer}
            itemRenderer={customItemRenderer}
            canMove={false}
            canResize={false}
            lineHeight={50}
            itemHeightRatio={0.8}
            stackItems={false}
            traditionalZoom={true}
            sidebarWidth={300}
            rightSidebarWidth={0}
            dragSnap={24 * 60 * 60 * 1000} // 1 day
            minZoom={24 * 60 * 60 * 1000} // 1 day
            maxZoom={365 * 24 * 60 * 60 * 1000} // 1 year
          />
        </div>
        
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#003319] rounded"></div>
            <span>Project</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Done</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded"></div>
            <span>Not Started</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-red-500 rounded"></div>
            <span>High Priority</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfessionalTimeline;