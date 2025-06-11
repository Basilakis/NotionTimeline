import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Database, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

export default function Setup() {
  const [notionPageUrl, setNotionPageUrl] = useState("");
  const [notionSecret, setNotionSecret] = useState("");
  const [databaseName, setDatabaseName] = useState("Tasks");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Check if configuration already exists
  const { data: existingConfig } = useQuery({
    queryKey: ['/api/config', user.email],
    queryFn: async () => {
      if (!user.email) return null;
      try {
        const response = await apiRequest('GET', `/api/config/${encodeURIComponent(user.email)}`);
        return response.json();
      } catch (error) {
        return null; // Config doesn't exist yet
      }
    },
    enabled: !!user.email,
  });

  const setupMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/config', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Setup complete",
        description: "Your Notion workspace has been connected successfully!",
      });
      setLocation('/');
    },
    onError: (error) => {
      toast({
        title: "Setup failed",
        description: error.message || "Failed to setup Notion integration.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notionPageUrl || !notionSecret) {
      toast({
        title: "Missing information",
        description: "Please provide both Notion page URL and integration secret.",
        variant: "destructive",
      });
      return;
    }

    setupMutation.mutate({
      userEmail: user.email,
      notionPageUrl,
      notionSecret,
      databaseName,
    });
  };

  if (existingConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-2xl shadow-material">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold text-gray-900">Setup Complete</CardTitle>
            <p className="text-gray-600">
              Your Notion workspace is already connected and ready to use.
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => setLocation('/')}
              className="bg-blue-700 hover:bg-blue-600 text-white"
            >
              Go to Timeline
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-material">
          <CardHeader>
            <div className="flex items-center space-x-2 mb-4">
              <Database className="text-blue-700 h-6 w-6" />
              <CardTitle className="text-xl font-bold text-gray-900">
                Connect Your Notion Workspace
              </CardTitle>
            </div>
            <p className="text-gray-600">
              Set up your Notion integration to sync and display your tasks in timeline format.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">Before you start:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a Notion integration at notion.so/my-integrations</li>
                    <li>Copy the "Internal Integration Secret"</li>
                    <li>Share your Notion page with the integration</li>
                    <li>Copy the page URL from your browser</li>
                  </ol>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notionSecret" className="text-sm font-medium text-gray-700">
                  Notion Integration Secret
                </Label>
                <Input
                  id="notionSecret"
                  type="password"
                  value={notionSecret}
                  onChange={(e) => setNotionSecret(e.target.value)}
                  placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                />
                <p className="text-xs text-gray-500">
                  Get this from your Notion integration settings
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notionPageUrl" className="text-sm font-medium text-gray-700">
                  Notion Page URL
                </Label>
                <Input
                  id="notionPageUrl"
                  type="url"
                  value={notionPageUrl}
                  onChange={(e) => setNotionPageUrl(e.target.value)}
                  placeholder="https://www.notion.so/your-page-url"
                  required
                />
                <p className="text-xs text-gray-500">
                  The URL of the Notion page containing your task database
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="databaseName" className="text-sm font-medium text-gray-700">
                  Database Name
                </Label>
                <Input
                  id="databaseName"
                  type="text"
                  value={databaseName}
                  onChange={(e) => setDatabaseName(e.target.value)}
                  placeholder="Tasks"
                  required
                />
                <p className="text-xs text-gray-500">
                  The name of your task database in Notion
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-blue-700 hover:bg-blue-600 text-white"
                  disabled={setupMutation.isPending}
                >
                  {setupMutation.isPending ? "Connecting..." : "Connect Notion"}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => window.open('https://www.notion.so/my-integrations', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Notion
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}