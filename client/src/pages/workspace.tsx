import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { NotionRenderer } from "react-notion-x";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Settings } from "lucide-react";

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

function getUserEmail(): string {
  return localStorage.getItem('userEmail') || '';
}

export default function Workspace() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<string>('tasks');
  const [pageData, setPageData] = useState<any>(null);
  const userEmail = getUserEmail();

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
    },
    onError: (error: Error) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (viewsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading workspace...</span>
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
              No Views Configured
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              No database views have been set up for your account. Please contact your administrator to configure access to your databases.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeViews = views.filter(v => v.isActive);

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Workspace</h1>
        <Button
          variant="outline"
          onClick={() => discoverWorkspace.mutate()}
          disabled={discoverWorkspace.isPending}
        >
          {discoverWorkspace.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh Views
        </Button>
      </div>

      <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {activeViews.map((view) => (
            <TabsTrigger key={view.id} value={view.viewType} className="flex items-center gap-2">
              {view.icon && <span>{view.icon}</span>}
              {view.title}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {activeViews.map((view) => (
          <TabsContent key={view.id} value={view.viewType} className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {view.icon && <span>{view.icon}</span>}
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
                        {databaseData.records.map((record: any) => (
                          <Card key={record.notionId} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium mb-2">{record.title}</h3>
                                
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
                              
                              <div className="text-xs text-muted-foreground">
                                Updated: {new Date(record.lastEditedTime).toLocaleDateString()}
                              </div>
                            </div>
                          </Card>
                        ))}
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
  );
}