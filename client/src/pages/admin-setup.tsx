import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Settings, CheckCircle, LogOut } from "lucide-react";

const adminSetupSchema = z.object({
  notionSecret: z.string().min(1, "Notion integration token is required"),
  notionPageUrl: z.string().url("Please enter a valid Notion page URL"),
  adminEmail: z.string().email("Please enter a valid admin email")
});

interface Database {
  id: string;
  title: string;
  url: string;
}

export default function AdminSetup() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const form = useForm<z.infer<typeof adminSetupSchema>>({
    resolver: zodResolver(adminSetupSchema),
    defaultValues: {
      notionSecret: "",
      notionPageUrl: "",
      adminEmail: ""
    }
  });

  // Setup admin workspace
  const setupWorkspace = useMutation({
    mutationFn: async (data: z.infer<typeof adminSetupSchema>) => {
      const response = await fetch('/api/admin/workspace/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Workspace Setup Complete",
        description: data.message
      });
      setIsSetupComplete(true);
      // Trigger database discovery
      discoverDatabases.mutate({ adminEmail: form.getValues('adminEmail') });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Discover databases in workspace
  const discoverDatabases = useMutation({
    mutationFn: async (data: { adminEmail: string }) => {
      const response = await fetch('/api/admin/workspace/auto-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setDatabases(data.databases);
      toast({
        title: "Databases Discovered",
        description: `Found ${data.databases.length} databases in your workspace`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: z.infer<typeof adminSetupSchema>) => {
    setupWorkspace.mutate(data);
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Workspace Setup</h1>
          <p className="text-muted-foreground mt-2">
            Configure your centralized Notion workspace. Users will access databases through email-based filtering.
          </p>
          {user && (
            <p className="text-sm text-gray-600 mt-1">Logged in as: {user.email}</p>
          )}
        </div>
        <Button 
          variant="outline" 
          onClick={logout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      {!isSetupComplete ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure Notion Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@yourcompany.com" {...field} />
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
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Create an integration at notion.so/my-integrations and copy the token
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
                          placeholder="https://www.notion.so/your-workspace/..."
                          {...field} 
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        URL of the main page containing your databases
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  disabled={setupWorkspace.isPending}
                  className="w-full"
                >
                  {setupWorkspace.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up workspace...
                    </>
                  ) : (
                    <>
                      <Settings className="mr-2 h-4 w-4" />
                      Setup Workspace
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Workspace Configured Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Your Notion workspace is now connected. Users can log in with their email and access their assigned database records.
              </p>
            </CardContent>
          </Card>

          {databases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Discovered Databases ({databases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {databases.map((db) => (
                    <div key={db.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{db.title}</h3>
                        <p className="text-sm text-muted-foreground font-mono">{db.id}</p>
                      </div>
                      <Badge variant="secondary">
                        Ready for user access
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-medium mb-2">Next Steps:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Ensure each database has a "User Email" field (email type)</li>
                    <li>• Add user email addresses to records they should access</li>
                    <li>• Users can now log in and see only their assigned records</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {discoverDatabases.isPending && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Discovering databases...</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}