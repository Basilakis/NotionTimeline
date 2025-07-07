import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  Reply,
  ArrowLeft,
  User,
  Calendar
} from "lucide-react";

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
  senderEmail: string;
  createdAt: string;
}

export default function AdminRequests() {
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [replyText, setReplyText] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all requests
  const { data: requests = [], isLoading, refetch } = useQuery<Request[]>({
    queryKey: ['/api/admin/requests'],
    staleTime: 0,
    cacheTime: 0,
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
      refetch();
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
      refetch();
      if (selectedRequest) {
        setSelectedRequest({ ...selectedRequest, status: selectedRequest.status === 'open' ? 'resolved' : 'open' });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive"
      });
    }
  });

  const handleReply = () => {
    if (!selectedRequest || !replyText.trim()) return;
    replyMutation.mutate({ requestId: selectedRequest.id, message: replyText.trim() });
  };

  const handleStatusChange = (requestId: string, status: 'open' | 'resolved') => {
    updateStatusMutation.mutate({ requestId, status });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    return status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
  };

  // Sort requests by creation date (newest first)
  const sortedRequests = requests.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const openCount = requests.filter(r => r.status === 'open').length;
  const resolvedCount = requests.filter(r => r.status === 'resolved').length;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading requests...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Support Requests</h1>
          <p className="text-muted-foreground mt-1">
            Manage user support requests and provide assistance
          </p>
        </div>
        <div className="flex gap-4">
          <Badge variant="outline" className="px-3 py-1">
            <Clock className="h-3 w-3 mr-1" />
            {openCount} Open
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            <CheckCircle className="h-3 w-3 mr-1" />
            {resolvedCount} Resolved
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Request List */}
        <div className="col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                All Requests ({requests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {sortedRequests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    No requests found
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {sortedRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                          selectedRequest?.id === request.id 
                            ? 'bg-primary/5 border-primary' 
                            : 'bg-background hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedRequest(request)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{request.userEmail}</span>
                          </div>
                          <Badge 
                            className={`text-xs ${getStatusColor(request.status)}`}
                          >
                            {request.status === 'open' ? 'Open' : 'Resolved'}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {request.message}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatTimestamp(request.createdAt)}
                          </div>
                          {request.replies.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Reply className="h-3 w-3" />
                              {request.replies.length} replies
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Request Detail */}
        <div className="col-span-7">
          {selectedRequest ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRequest(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {selectedRequest.userEmail}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created {formatTimestamp(selectedRequest.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(selectedRequest.status)}>
                      {selectedRequest.status === 'open' ? 'Open' : 'Resolved'}
                    </Badge>
                    {selectedRequest.status === 'open' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(selectedRequest.id, 'resolved')}
                        disabled={updateStatusMutation.isPending}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Mark Solved
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(selectedRequest.id, 'open')}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <ScrollArea className="h-[400px] mb-4">
                  <div className="space-y-4">
                    {/* Original Request */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedRequest.userEmail}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(selectedRequest.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{selectedRequest.message}</p>
                    </div>

                    {/* Replies */}
                    {selectedRequest.replies.map((reply) => (
                      <div key={reply.id}>
                        <div className={`p-4 rounded-lg ${
                          reply.isAdmin 
                            ? 'bg-primary/5 border-l-4 border-primary ml-4' 
                            : 'bg-muted/30 mr-4'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${
                              reply.isAdmin ? 'bg-primary' : 'bg-muted-foreground'
                            }`} />
                            <span className="font-medium text-sm">
                              {reply.isAdmin ? 'Admin' : reply.senderEmail}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(reply.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm">{reply.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                {/* Reply Form */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Reply to Request</label>
                  <Textarea
                    placeholder="Type your reply here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                    disabled={replyMutation.isPending}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleReply}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Reply className="h-4 w-4" />
                      {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-[600px]">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Request Selected</h3>
                  <p className="text-muted-foreground">
                    Select a request from the list to view details and reply
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}