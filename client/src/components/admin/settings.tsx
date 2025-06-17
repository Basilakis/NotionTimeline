import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Key, Globe, Save, AlertCircle } from "lucide-react";

const settingsSchema = z.object({
  notionSecret: z.string().min(1, "Notion integration token is required"),
  notionPageUrl: z.string().url("Please enter a valid Notion page URL"),
  workspaceName: z.string().min(1, "Workspace name is required")
});

export function AdminSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      notionSecret: "",
      notionPageUrl: "",
      workspaceName: ""
    }
  });

  // Query current configuration
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['/api/admin/config'],
    retry: false,
  });

  // Update form values when config is loaded
  useEffect(() => {
    if (config) {
      form.reset({
        notionSecret: config.notionSecret || "",
        notionPageUrl: config.notionPageUrl || "",
        workspaceName: config.workspaceName || ""
      });
    }
  }, [config, form]);

  // Update configuration mutation
  const updateConfig = useMutation({
    mutationFn: async (data: z.infer<typeof settingsSchema>) => {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update configuration');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects'] });
      setIsEditing(false);
      toast({
        title: "Settings Updated",
        description: "Your Notion configuration has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Test connection mutation
  const testConnection = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Successful",
        description: `Connected to workspace: ${data.workspaceName}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: z.infer<typeof settingsSchema>) => {
    updateConfig.mutate(data);
  };

  const handleTestConnection = () => {
    testConnection.mutate();
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your Notion integration settings and workspace configuration.
          </p>
        </div>
        <div className="flex gap-2">
          {config && !isEditing && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Connection
            </Button>
          )}
          <Button
            variant={isEditing ? "outline" : "default"}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancel" : "Edit Settings"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Notion Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!config && !isEditing ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Configuration Found</h3>
              <p className="text-gray-600 mb-4">
                Set up your Notion integration to start managing projects.
              </p>
              <Button onClick={() => setIsEditing(true)}>
                Configure Integration
              </Button>
            </div>
          ) : isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="workspaceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Company Workspace" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notionSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notion Integration Token</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="secret_..."
                          className="font-mono text-sm"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-sm text-gray-500">
                        Your Notion integration token with read/write permissions
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notionPageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notion Page URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://www.notion.so/your-workspace/page-id"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-sm text-gray-500">
                        The main page URL where your databases are located
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateConfig.isPending}
                    className="flex items-center gap-2"
                  >
                    {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Save className="h-4 w-4" />
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Workspace Name</label>
                  <p className="text-gray-900 mt-1">{config.workspaceName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Connected
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Notion Integration</label>
                  <p className="text-gray-900 mt-1 font-mono text-sm">
                    {config.notionSecret ? `${config.notionSecret.substring(0, 12)}...` : 'Not configured'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Page URL</label>
                  <div className="mt-1">
                    <Button
                      variant="link"
                      className="p-0 h-auto text-blue-600 hover:text-blue-800"
                      onClick={() => window.open(config.notionPageUrl, '_blank')}
                    >
                      <Globe className="h-4 w-4 mr-1" />
                      Open in Notion
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}