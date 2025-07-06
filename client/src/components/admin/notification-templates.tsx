import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageSquare, Save, RefreshCw, Eye, AlertCircle, CheckCircle } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  description: string;
  variables: string[];
}

const defaultTemplates: EmailTemplate[] = [
  {
    id: "status-change",
    name: "Status Change Notification",
    subject: "Task Status Update: {{taskTitle}} - {{newStatus}}",
    description: "Sent when a task status changes (Planning, In Progress, Done, etc.)",
    variables: ["taskTitle", "projectName", "oldStatus", "newStatus", "userEmail", "assigneeEmail", "taskUrl", "dueDate", "priority"],
    htmlBody: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Status Update</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 20px; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin: 4px; }
        .status-blue { background-color: #dbeafe; color: #1e40af; }
        .status-yellow { background-color: #fef3c7; color: #b45309; }
        .status-green { background-color: #dcfce7; color: #166534; }
        .status-red { background-color: #fee2e2; color: #b91c1c; }
        .status-purple { background-color: #f3e8ff; color: #7c3aed; }
        .task-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{urgencyIndicator}} Task Status Update</h1>
        </div>
        <div class="content">
            <h2>{{taskTitle}}</h2>
            <p>{{statusChangeMessage}}</p>
            <div style="margin: 20px 0;">
                <span class="status-badge status-{{oldStatusColor}}">{{oldStatus}}</span>
                <span style="margin: 0 10px;">→</span>
                <span class="status-badge status-{{newStatusColor}}">{{newStatus}}</span>
            </div>
            <div class="task-details">
                <p><strong>Project:</strong> {{projectName}}</p>
                {{#if dueDate}}<p><strong>Due Date:</strong> {{dueDate}}</p>{{/if}}
                {{#if priority}}<p><strong>Priority:</strong> {{priority}}</p>{{/if}}
                <p><strong>Assigned to:</strong> {{assigneeEmail}}</p>
            </div>
            <a href="{{taskUrl}}" class="button">View Task in Notion</a>
        </div>
        <div class="footer">
            <p>This notification was sent because you are assigned to this task.</p>
            <p>Task management powered by Notion</p>
        </div>
    </div>
</body>
</html>`,
    textBody: `Task Status Update: {{taskTitle}}

{{statusChangeMessage}}

Status changed from "{{oldStatus}}" to "{{newStatus}}"

Project: {{projectName}}
{{#if dueDate}}Due Date: {{dueDate}}{{/if}}
{{#if priority}}Priority: {{priority}}{{/if}}
Assigned to: {{assigneeEmail}}

View task: {{taskUrl}}

This notification was sent because you are assigned to this task.`
  },
  {
    id: "task-reminder",
    name: "Task Reminder",
    subject: "Reminder: {{taskTitle}} is due {{dueDate}}",
    description: "Sent as a reminder for upcoming task deadlines",
    variables: ["taskTitle", "projectName", "dueDate", "assigneeEmail", "taskUrl", "priority"],
    htmlBody: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Reminder</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 20px; }
        .reminder-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Task Reminder</h1>
        </div>
        <div class="content">
            <h2>{{taskTitle}}</h2>
            <div class="reminder-box">
                <p><strong>This task is due: {{dueDate}}</strong></p>
                <p>Project: {{projectName}}</p>
                {{#if priority}}<p>Priority: {{priority}}</p>{{/if}}
            </div>
            <a href="{{taskUrl}}" class="button">View Task in Notion</a>
        </div>
        <div class="footer">
            <p>Don't forget to update your task progress!</p>
        </div>
    </div>
</body>
</html>`,
    textBody: `Task Reminder: {{taskTitle}}

This task is due: {{dueDate}}

Project: {{projectName}}
{{#if priority}}Priority: {{priority}}{{/if}}

View task: {{taskUrl}}

Don't forget to update your task progress!`
  }
];

export function NotificationTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(defaultTemplates[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');

  // Query for email templates
  const { data: templates = defaultTemplates, isLoading } = useQuery({
    queryKey: ['/api/admin/email-templates'],
    retry: false,
  });

  // Save template mutation
  const saveTemplate = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const response = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': 'basiliskan@gmail.com'
        },
        body: JSON.stringify(template)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save template');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Template Saved",
        description: "Email template has been saved successfully.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: "Failed to save email template.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveTemplate.mutate(selectedTemplate);
  };

  const handleTemplateChange = (field: keyof EmailTemplate, value: string) => {
    setSelectedTemplate(prev => ({
      ...prev,
      [field]: value
    }));
    setIsEditing(true);
  };

  const renderPreview = () => {
    if (previewMode === 'html') {
      // Replace template variables with sample data for preview
      const sampleData = {
        taskTitle: "Sample Task: Website Redesign",
        projectName: "Vertex Developments",
        oldStatus: "Planning",
        newStatus: "In Progress",
        oldStatusColor: "blue",
        newStatusColor: "yellow",
        urgencyIndicator: "🔄",
        statusChangeMessage: "The task status has been updated and is now in progress.",
        assigneeEmail: "basiliskan@gmail.com",
        taskUrl: "https://notion.so/sample-task",
        dueDate: "January 15, 2025",
        priority: "High"
      };

      let previewHtml = selectedTemplate.htmlBody;
      Object.entries(sampleData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        previewHtml = previewHtml.replace(regex, value);
      });

      return (
        <div 
          className="border rounded-lg p-4 bg-white max-h-96 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      );
    } else {
      return (
        <div className="border rounded-lg p-4 bg-gray-50 whitespace-pre-wrap max-h-96 overflow-y-auto font-mono text-sm">
          {selectedTemplate.textBody}
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-600 mt-1">
            Manage and customize email notification templates
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <Button 
              onClick={handleSave}
              disabled={saveTemplate.isPending}
            >
              {saveTemplate.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTemplate.id === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setSelectedTemplate(template);
                  setIsEditing(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  {selectedTemplate.id === template.id && (
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.variables.slice(0, 3).map((variable) => (
                    <Badge key={variable} variant="secondary" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                  {template.variables.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{template.variables.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Template Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {selectedTemplate.name}
              {isEditing && (
                <Badge variant="outline" className="ml-2">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Unsaved Changes
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="content" className="space-y-4">
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="variables">Variables</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={selectedTemplate.subject}
                    onChange={(e) => handleTemplateChange('subject', e.target.value)}
                    placeholder="Enter email subject..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="htmlBody">HTML Body</Label>
                  <textarea
                    id="htmlBody"
                    value={selectedTemplate.htmlBody}
                    onChange={(e) => handleTemplateChange('htmlBody', e.target.value)}
                    placeholder="Enter HTML template..."
                    rows={12}
                    className="mt-1 font-mono text-sm w-full border border-gray-300 rounded-md p-2 resize-y"
                  />
                </div>

                <div>
                  <Label htmlFor="textBody">Plain Text Body</Label>
                  <textarea
                    id="textBody"
                    value={selectedTemplate.textBody}
                    onChange={(e) => handleTemplateChange('textBody', e.target.value)}
                    placeholder="Enter plain text template..."
                    rows={8}
                    className="mt-1 font-mono text-sm w-full border border-gray-300 rounded-md p-2 resize-y"
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Label>Preview Mode:</Label>
                  <Button
                    variant={previewMode === 'html' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('html')}
                  >
                    HTML
                  </Button>
                  <Button
                    variant={previewMode === 'text' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('text')}
                  >
                    Text
                  </Button>
                </div>
                {renderPreview()}
              </TabsContent>

              <TabsContent value="variables" className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Available Variables</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Use these variables in your templates by wrapping them in double curly braces, e.g., <code>{"{{taskTitle}}"}</code>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <code className="text-sm font-mono text-blue-600">{"{{" + variable + "}}"}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}