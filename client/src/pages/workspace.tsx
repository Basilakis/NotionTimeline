import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { NotionRenderer } from "react-notion-x";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Settings } from "lucide-react";
import proposalBg from "@assets/proposal-background.png";

// Import notion-x styles
import "react-notion-x/src/styles.css";
import "prismjs/themes/prism-tomorrow.css";
import "katex/dist/katex.min.css";

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

interface DatabaseData {
  database_id: string;
  user_email: string;
  records: NotionRecord[];
  total_count: number;
}

interface NotionRecord {
  notionId: string;
  title: string;
  userEmail: string | null;
  createdTime: string;
  lastEditedTime: string;
  properties: any;
}

export default function Workspace() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState<string>('tasks');
  const [pageData, setPageData] = useState<any>(null);
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const userEmail = user?.email || '';

  // Fetch user's Notion views
  const { data: views, isLoading: viewsLoading } = useQuery<NotionView[]>({
    queryKey: ['/api/notion-views'],
    enabled: !!userEmail,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch filtered database data for the active view
  const activeViewData = views?.find(v => v.viewType === activeView);
  
  const { data: databaseData, isLoading: pageLoading } = useQuery<DatabaseData>({
    queryKey: ['/api/notion-database', activeViewData?.databaseId],
    enabled: !!activeViewData?.databaseId,
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Check if any records in the current view have Proposal field marked as true
  const hasProposalRecords = databaseData?.records?.some((record: any) => 
    record.properties.Proposal?.checkbox === true
  );

  // Workspace discovery mutation
  const discoverWorkspace = useMutation({
    mutationFn: async () => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/notion-views'] });
      setAutoDiscovering(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
      setAutoDiscovering(false);
    }
  });

  // Auto-discover workspace when user first arrives and has no views
  useEffect(() => {
    if (userEmail && !viewsLoading && views && views.length === 0 && !autoDiscovering) {
      console.log('[Workspace] Auto-discovering workspace for user:', userEmail);
      setAutoDiscovering(true);
      discoverWorkspace.mutate();
    }
  }, [userEmail, views, viewsLoading, autoDiscovering]);

  if (viewsLoading || autoDiscovering) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>
            {autoDiscovering ? 'Discovering your workspace...' : 'Loading workspace...'}
          </span>
        </div>
      </div>
    );
  }

  if (!views || views.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Welcome to Your Workspace!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Hi <strong>{userEmail}</strong>! We're setting up your personalized workspace.
              </p>
              <p className="text-sm text-muted-foreground">
                We'll automatically discover your Notion databases and create views for data assigned to your email.
              </p>
            </div>
            <Button 
              onClick={() => discoverWorkspace.mutate()}
              disabled={discoverWorkspace.isPending}
              className="w-full"
            >
              {discoverWorkspace.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Discovering Your Workspace...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Discover My Notion Workspace
                </>
              )}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              <p>This process scans your Notion databases for records containing your email address.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeViews = views.filter(v => v.isActive);

  return (
    <>
      {/* Full-page static background for proposal records */}
      {hasProposalRecords && (
        <div 
          className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-[-1]"
          style={{
            backgroundImage: `url(${proposalBg})`,
            backgroundAttachment: 'fixed'
          }}
        />
      )}
      
      <div className={`container mx-auto py-6 ${hasProposalRecords ? 'relative z-10' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {userEmail.split('@')[0]}!</h1>
            <p className="text-muted-foreground mt-1">Your personalized workspace with {views?.length || 0} active views</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/demo'}
            >
              🧪 Test Users
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/admin'}
            >
              ⚙️ Admin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => discoverWorkspace.mutate()}
              disabled={discoverWorkspace.isPending}
            >
              {discoverWorkspace.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Views
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </div>

        <Tabs value={activeView} onValueChange={setActiveView} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            {activeViews.map((view) => (
              <TabsTrigger key={view.id} value={view.viewType}>
                <span className="mr-2">{view.icon}</span>
                {view.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeViews.map((view) => (
            <TabsContent key={view.id} value={view.viewType}>
              <Card className={hasProposalRecords ? 'bg-white/90 backdrop-blur-sm dark:bg-gray-900/90' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>{view.icon}</span>
                    {view.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pageLoading && activeView === view.viewType ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Loading {view.title.toLowerCase()}...</span>
                      </div>
                    </div>
                  ) : databaseData && activeView === view.viewType && databaseData.records ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {databaseData.total_count} records found
                        </p>
                      </div>
                      
                      {databaseData.records.length > 0 ? (
                        <div className="grid gap-4">
                          {databaseData.records.map((record: any) => {
                            // Check if this record has Proposal field marked as True
                            const isProposal = record.properties.Proposal?.checkbox === true;
                            
                            return (
                              <Card 
                                key={record.notionId} 
                                className={`p-4 ${
                                  isProposal 
                                    ? 'bg-white/95 backdrop-blur-sm border-blue-200 dark:bg-gray-900/95 dark:border-blue-800' 
                                    : hasProposalRecords 
                                      ? 'bg-white/90 backdrop-blur-sm dark:bg-gray-900/90' 
                                      : ''
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h3 className="font-medium">{record.title}</h3>
                                      {isProposal && (
                                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700">
                                          📋 Proposal
                                        </Badge>
                                      )}
                                    </div>
                                  
                                    {/* Render common properties */}
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
                                      
                                      {record.properties.DueDate?.date?.start && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">Due:</span>
                                          <span>{new Date(record.properties.DueDate.date.start).toLocaleDateString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="text-xs text-muted-foreground">
                                  Updated: {new Date(record.lastEditedTime).toLocaleDateString()}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No records found for your account in this database.</p>
                          <p className="text-xs mt-2">Make sure your email is added to the "User Email" field in the Notion database.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Unable to load {view.title.toLowerCase()}. Please check your configuration.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}