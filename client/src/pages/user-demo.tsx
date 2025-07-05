import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, 
  Mail, 
  Database, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Users,
  Calendar,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface NotionView {
  id: number;
  userEmail: string;
  viewType: string;
  pageId: string;
  databaseId: string | null;
  title: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseRecord {
  notionId: string;
  title: string;
  userEmail: string | null;
  createdTime: string;
  lastEditedTime: string;
  properties: any;
}

export default function UserDemo() {
  const { toast } = useToast();
  const [testUserEmail, setTestUserEmail] = useState("");
  const [simulateUser, setSimulateUser] = useState(false);
  const [activeView, setActiveView] = useState<string>('tasks');

  // Set user email for testing
  const handleSetUserEmail = () => {
    if (testUserEmail.trim()) {
      localStorage.setItem('userEmail', testUserEmail);
      setSimulateUser(true);
      console.log('[Demo] Set user email in localStorage:', testUserEmail);
      toast({
        title: "User Email Set",
        description: `Now testing as: ${testUserEmail}`,
      });
    }
  };

  // Fetch user's Notion views
  const { data: views, isLoading: viewsLoading, refetch: refetchViews } = useQuery<NotionView[]>({
    queryKey: ['/api/notion-views'],
    enabled: simulateUser && !!testUserEmail,
    retry: false
  });

  // Fetch database data for the active view
  const activeViewData = views?.find(v => v.viewType === activeView);
  
  const { data: databaseData, isLoading: pageLoading, error: databaseError } = useQuery({
    queryKey: ['/api/notion-database', activeViewData?.databaseId],
    enabled: !!activeViewData?.databaseId && simulateUser,
    retry: false
  });
  
  // Log database query results
  if (databaseData) {
    console.log('[Demo] Database query success:', databaseData);
  }
  if (databaseError) {
    console.log('[Demo] Database query error:', databaseError);
  }

  // Workspace discovery mutation
  const discoverWorkspace = useMutation({
    mutationFn: async () => {
      const userEmail = localStorage.getItem('userEmail') || testUserEmail;
      const response = await fetch('/api/notion-workspace/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        }
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Workspace Discovery Complete",
        description: data.message
      });
      refetchViews();
    },
    onError: (error: Error) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetDemo = () => {
    localStorage.removeItem('userEmail');
    setTestUserEmail("");
    setSimulateUser(false);
    setActiveView('tasks');
    queryClient.clear();
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Experience Demo</h1>
          <p className="text-muted-foreground mt-1">
            Test how the system works for regular users accessing Notion data
          </p>
        </div>
        <Button variant="outline" onClick={resetDemo}>
          Reset Demo
        </Button>
      </div>

      {/* User Setup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Testing Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userEmail">Test User Email</Label>
            <div className="flex gap-2">
              <Input
                id="userEmail"
                type="email"
                placeholder="Enter email to test as user..."
                value={testUserEmail}
                onChange={(e) => setTestUserEmail(e.target.value)}
                disabled={simulateUser}
              />
              <Button 
                onClick={handleSetUserEmail}
                disabled={!testUserEmail.trim() || simulateUser}
              >
                Set User
              </Button>
            </div>
          </div>
          
          {simulateUser && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Now testing as: <strong>{testUserEmail}</strong>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* User Workspace Section */}
      {simulateUser && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                User Workspace Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading user workspace...
                </div>
              ) : !views || views.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="font-semibold mb-2">No Views Configured</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This user doesn't have any Notion views configured yet.
                    </p>
                    <Button 
                      onClick={() => discoverWorkspace.mutate()}
                      disabled={discoverWorkspace.isPending}
                    >
                      {discoverWorkspace.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Discovering...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Discover Workspace
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {views.length} views available for this user
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => discoverWorkspace.mutate()}
                      disabled={discoverWorkspace.isPending}
                    >
                      {discoverWorkspace.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {/* View Tabs */}
                  <div className="flex gap-2 flex-wrap">
                    {views.filter(v => v.isActive).map((view) => (
                      <Button
                        key={view.id}
                        variant={activeView === view.viewType ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveView(view.viewType)}
                      >
                        <span className="mr-2">{view.icon}</span>
                        {view.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Display */}
          {views && views.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  User Data Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    Loading user data...
                  </div>
                ) : !databaseData ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Active view: {activeViewData?.title || 'None'} | Database ID: {activeViewData?.databaseId || 'None'}
                    </p>
                  </div>
                ) : databaseData && (databaseData as any).records ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {(databaseData as any).records.length} records found for {testUserEmail}
                      </p>
                      <Badge variant="secondary">
                        {activeViewData?.title}
                      </Badge>
                    </div>
                    
                    {(databaseData as any).records.length > 0 ? (
                      <div className="grid gap-4">
                        {(databaseData as any).records.map((record: DatabaseRecord) => (
                          <Card key={record.notionId} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium mb-2">{record.title}</h3>
                                
                                {/* Display properties */}
                                <div className="space-y-2 text-sm">
                                  {record.properties.Status?.select?.name && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Status:</span>
                                      <Badge variant="secondary">
                                        {record.properties.Status.select.name}
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {record.properties.Priority?.select?.name && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Priority:</span>
                                      <Badge variant={
                                        record.properties.Priority.select.name === 'High' ? 'destructive' :
                                        record.properties.Priority.select.name === 'Medium' ? 'default' : 'secondary'
                                      }>
                                        {record.properties.Priority.select.name}
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {record.properties.Description?.rich_text?.[0]?.plain_text && (
                                    <div>
                                      <span className="text-muted-foreground">Description:</span>
                                      <p className="mt-1">{record.properties.Description.rich_text[0].plain_text}</p>
                                    </div>
                                  )}
                                  
                                  {record.properties.Proposal?.checkbox && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Type:</span>
                                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                        📋 Proposal
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-xs text-muted-foreground mt-3">
                              Updated: {new Date(record.lastEditedTime).toLocaleDateString()}
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">No Records Found</h3>
                        <p className="text-sm text-muted-foreground">
                          No records found for {testUserEmail} in this database.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Make sure the user's email is added to the "User Email" field in Notion.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Data Structure Debug</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Debug info for databaseData:
                    </p>
                    <div className="text-xs text-left bg-gray-100 p-4 rounded max-h-40 overflow-y-auto">
                      <pre>{JSON.stringify(databaseData, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Testing Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-700">
          <p><strong>1. Set User Email:</strong> Enter an email address that exists in your Notion databases</p>
          <p><strong>2. Discover Workspace:</strong> Click "Discover Workspace" to find available views</p>
          <p><strong>3. View Data:</strong> Switch between different view types to see filtered data</p>
          <p><strong>4. Test Filtering:</strong> Only records with matching "User Email" field will appear</p>
          <p><strong>5. Check Proposal Background:</strong> Records with "Proposal" checkbox will trigger the special background</p>
        </CardContent>
      </Card>
    </div>
  );
}