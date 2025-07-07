import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Plus,
  Clock,
  CheckCircle,
  User,
  Send,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

export function RequestsInterface() {
  const [newRequestMessage, setNewRequestMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's requests
  const { data: requests = [], isLoading, refetch } = useQuery<Request[]>({
    queryKey: ['/api/user/requests'],
    staleTime: 0,
    cacheTime: 0,
  });

  // Create new request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest('/api/user/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your request has been submitted successfully. We'll respond soon!",
      });
      setNewRequestMessage("");
      setIsNewRequestOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/user/requests'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  // Reply to request mutation (for follow-ups)
  const replyMutation = useMutation({
    mutationFn: async ({ requestId, message }: { requestId: string; message: string }) => {
      return await apiRequest(`/api/user/requests/${requestId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Reply Sent",
        description: "Your follow-up message has been sent.",
      });
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/user/requests'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  const handleCreateRequest = () => {
    if (!newRequestMessage.trim()) return;
    createRequestMutation.mutate(newRequestMessage.trim());
  };

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const handleSendReply = () => {
    if (!selectedRequest || !replyMessage.trim()) return;
    
    replyMutation.mutate({
      requestId: selectedRequest.id,
      message: replyMessage.trim(),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Sort requests by creation date (newest first)
  const sortedRequests = requests.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const openCount = requests.filter(r => r.status === 'open').length;
  const resolvedCount = requests.filter(r => r.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Requests</h1>
          <p className="text-gray-600 mt-1">
            Create and track your support tickets
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="Describe your issue or question..."
                  value={newRequestMessage}
                  onChange={(e) => setNewRequestMessage(e.target.value)}
                  rows={5}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsNewRequestOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRequest}
                    disabled={!newRequestMessage.trim() || createRequestMutation.isPending}
                  >
                    {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Open Requests</p>
                <p className="text-xl font-bold text-orange-600">{openCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-xl font-bold text-green-600">{resolvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-xl font-bold text-blue-600">{requests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading requests...</p>
          </div>
        ) : sortedRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No requests yet</p>
              <Button onClick={() => setIsNewRequestOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedRequests.map((request) => (
            <Card 
              key={request.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleRequestClick(request)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        className={`text-xs ${getStatusColor(request.status)}`}
                        variant="outline"
                      >
                        {request.status === 'open' ? 'Open' : 'Resolved'}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {format(new Date(request.createdAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                      {request.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {request.replies.length} replies
                      </span>
                      {request.replies.length > 0 && (
                        <span>
                          Last activity: {format(new Date(request.replies[request.replies.length - 1].createdAt), 'MMM dd, HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Request Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Request Details
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-6">
                {/* Request Info */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge 
                      className={`${getStatusColor(selectedRequest.status)}`}
                      variant="outline"
                    >
                      {selectedRequest.status === 'open' ? 'Open' : 'Resolved'}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      Created: {format(new Date(selectedRequest.createdAt), 'MMMM dd, yyyy at HH:mm')}
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {selectedRequest.message}
                    </p>
                  </div>
                </div>

                {/* Conversation */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Conversation</h3>
                  
                  {selectedRequest.replies.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No replies yet. Our team will respond soon!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedRequest.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className={`flex ${reply.isAdmin ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              reply.isAdmin
                                ? 'bg-gray-100 text-gray-900'
                                : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs opacity-70">
                                {reply.isAdmin ? 'Support Team' : 'You'}
                              </span>
                              <span className="text-xs opacity-70">
                                {format(new Date(reply.createdAt), 'MMM dd, HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {reply.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reply Form (only for open requests) */}
                {selectedRequest.status === 'open' && (
                  <div className="space-y-3 border-t pt-4">
                    <h4 className="font-medium text-gray-900">Add Follow-up</h4>
                    <Textarea
                      placeholder="Add additional information or questions..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSendReply}
                        disabled={!replyMessage.trim() || replyMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {replyMutation.isPending ? 'Sending...' : 'Send Follow-up'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}