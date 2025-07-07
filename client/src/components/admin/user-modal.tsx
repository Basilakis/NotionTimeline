import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Send, 
  Clock, 
  Mail, 
  MessageSquare, 
  User,
  Activity,
  Bell,
  Reply,
  Calendar,
  Phone,
  CheckCircle,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UserModalProps {
  user: {
    id: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Request {
  id: string;
  userEmail: string;
  message: string;
  timestamp: string;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
  replies: Reply[];
}

interface Reply {
  id: string;
  requestId: string;
  message: string;
  timestamp: string;
  isAdmin: boolean;
}

interface UserLog {
  id: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'login' | 'email' | 'sms' | 'activity' | 'notification';
}

export function UserModal({ user, isOpen, onClose }: UserModalProps) {
  const [replyText, setReplyText] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState<"email" | "sms">("email");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user requests  
  const { data: requests = [] } = useQuery({
    queryKey: ["/api/admin/users", user?.userEmail, "requests"],
    queryFn: () => fetch(`/api/admin/users/${user?.userEmail}/requests`, {
      headers: { 'x-user-email': 'basiliskan@gmail.com' }
    }).then(res => res.json()),
    enabled: isOpen && !!user,
    staleTime: 0
  });

  // Fetch user logs
  const { data: logs = [] } = useQuery({
    queryKey: ["/api/admin/users", user?.userEmail, "logs"],
    queryFn: () => fetch(`/api/admin/users/${user?.userEmail}/logs`, {
      headers: { 'x-user-email': 'basiliskan@gmail.com' }
    }).then(res => res.json()),
    enabled: isOpen && !!user,
    staleTime: 0
  });

  // Reply to request mutation
  const replyMutation = useMutation({
    mutationFn: async ({ requestId, message }: { requestId: string; message: string }) => {
      return apiRequest(`/api/admin/requests/${requestId}/reply`, "POST", { message });
    },
    onSuccess: () => {
      toast({
        title: "Reply sent",
        description: "Your reply has been sent to the user."
      });
      setReplyText("");
      setSelectedRequestId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", user?.userEmail, "requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", user?.userEmail, "logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive"
      });
    }
  });

  // Update request status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: 'open' | 'resolved' }) => {
      return apiRequest(`/api/admin/requests/${requestId}/status`, "PATCH", { status });
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Request status has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", user?.userEmail, "requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive"
      });
    }
  });

  // Send notification mutation
  const notificationMutation = useMutation({
    mutationFn: async ({ message, type }: { message: string; type: "email" | "sms" }) => {
      return apiRequest(`/api/admin/users/${user?.userEmail}/notify`, "POST", { message, type });
    },
    onSuccess: () => {
      toast({
        title: "Notification sent",
        description: `${notificationType.toUpperCase()} notification sent successfully.`
      });
      setNotificationMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", user?.userEmail, "logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive"
      });
    }
  });

  const handleReply = () => {
    if (!selectedRequestId || !replyText.trim()) return;
    replyMutation.mutate({ requestId: selectedRequestId, message: replyText.trim() });
  };

  const handleStatusChange = (requestId: string, status: 'open' | 'resolved') => {
    updateStatusMutation.mutate({ requestId, status });
  };

  const handleSendNotification = () => {
    if (!notificationMessage.trim()) return;
    notificationMutation.mutate({ 
      message: notificationMessage.trim(), 
      type: notificationType 
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'login': return <User className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <Phone className="h-4 w-4" />;
      case 'notification': return <Bell className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'login': return 'bg-green-100 text-green-800';
      case 'email': return 'bg-blue-100 text-blue-800';
      case 'sms': return 'bg-purple-100 text-purple-800';
      case 'notification': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[33vw] min-w-[400px] max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {user.userName} ({user.userEmail})
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="requests" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="notify" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Send Notification
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="flex-1 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-muted-foreground">No requests found</p>
                    </CardContent>
                  </Card>
                ) : (
                  requests.map((request: Request) => (
                    <Card key={request.id} className="w-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-sm text-muted-foreground">
                              {formatTimestamp(request.timestamp)}
                            </span>
                            <Badge 
                              variant={request.status === 'open' ? 'destructive' : 'default'}
                              className={request.status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}
                            >
                              {request.status === 'open' ? 'Open' : 'Resolved'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {request.status === 'open' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(request.id, 'resolved')}
                                disabled={updateStatusMutation.isPending}
                                className="flex items-center gap-1 text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Mark Solved
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(request.id, 'open')}
                                disabled={updateStatusMutation.isPending}
                                className="flex items-center gap-1"
                              >
                                <Clock className="h-3 w-3" />
                                Reopen
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRequestId(request.id)}
                              className="flex items-center gap-1"
                            >
                              <Reply className="h-3 w-3" />
                              Reply
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4">{request.message}</p>
                        
                        {/* Show replies */}
                        {request.replies && request.replies.length > 0 && (
                          <div className="space-y-2 border-l-2 border-gray-200 pl-4 ml-4">
                            {request.replies.map((reply: Reply) => (
                              <div key={reply.id} className="bg-gray-50 p-3 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant={reply.isAdmin ? "default" : "secondary"}>
                                    {reply.isAdmin ? "Admin" : "User"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(reply.timestamp)}
                                  </span>
                                </div>
                                <p className="text-sm">{reply.message}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply form */}
                        {selectedRequestId === request.id && (
                          <div className="mt-4 pt-4 border-t">
                            <Textarea
                              placeholder="Type your reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="mb-3"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={handleReply}
                                disabled={!replyText.trim() || replyMutation.isPending}
                                size="sm"
                              >
                                {replyMutation.isPending ? "Sending..." : "Send Reply"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setSelectedRequestId(null)}
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-3">
                {logs.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-muted-foreground">No logs found</p>
                    </CardContent>
                  </Card>
                ) : (
                  logs.map((log: UserLog) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className={`p-2 rounded-full ${getLogColor(log.type)}`}>
                        {getLogIcon(log.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{log.action}</h4>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notify" className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle>Send Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Notification Type</label>
                  <Select
                    value={notificationType}
                    onValueChange={(value: "email" | "sms") => setNotificationType(value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    placeholder="Type your notification message..."
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    className="mt-1"
                    rows={4}
                  />
                </div>

                <Button
                  onClick={handleSendNotification}
                  disabled={!notificationMessage.trim() || notificationMutation.isPending}
                  className="w-full"
                >
                  {notificationMutation.isPending ? "Sending..." : `Send ${notificationType.toUpperCase()}`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}