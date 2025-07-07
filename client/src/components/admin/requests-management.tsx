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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  User,
  Send,
  RefreshCw,
  Search,
  Filter,
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

export function RequestsManagement() {
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
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
      return await apiRequest(`/api/admin/requests/${requestId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Reply Sent",
        description: "Your reply has been sent successfully.",
      });
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/admin/requests'] });
      // Refresh the selected request to show new reply
      if (selectedRequest) {
        refetch();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: 'open' | 'resolved' }) => {
      return await apiRequest(`/api/admin/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Request status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/requests'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setIsSheetOpen(true);
  };

  const handleSendReply = () => {
    if (!selectedRequest || !replyMessage.trim()) return;
    
    replyMutation.mutate({
      requestId: selectedRequest.id,
      message: replyMessage.trim(),
    });
  };

  const handleStatusChange = (status: 'open' | 'resolved') => {
    if (!selectedRequest) return;
    
    updateStatusMutation.mutate({
      requestId: selectedRequest.id,
      status,
    });
    
    // Update local state
    setSelectedRequest({ ...selectedRequest, status });
  };

  // Filter requests based on status and search
  const filteredRequests = requests.filter(request => {
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesSearch = searchQuery === "" || 
      request.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // Sort requests by creation date (newest first)
  const sortedRequests = filteredRequests.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRequestStats = () => {
    const openCount = requests.filter(r => r.status === 'open').length;
    const resolvedCount = requests.filter(r => r.status === 'resolved').length;
    const totalReplies = requests.reduce((acc, r) => acc + r.replies.length, 0);
    
    return { openCount, resolvedCount, totalReplies };
  };

  const stats = getRequestStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requests Management</h1>
          <p className="text-gray-600 mt-1">
            Manage and respond to user support tickets
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Open Requests</p>
                <p className="text-xl font-bold text-orange-600">{stats.openCount}</p>
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
                <p className="text-xl font-bold text-green-600">{stats.resolvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total Replies</p>
                <p className="text-xl font-bold text-blue-600">{stats.totalReplies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-xl font-bold text-purple-600">{requests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
              <p className="text-gray-600">
                {searchQuery || statusFilter !== "all" ? "No requests match your filters" : "No requests found"}
              </p>
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
                      <span className="text-sm text-gray-500">
                        {request.userEmail}
                      </span>
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
                          Last reply: {format(new Date(request.replies[request.replies.length - 1].createdAt), 'MMM dd, HH:mm')}
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

      {/* Request Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[600px] sm:w-[700px] overflow-y-auto">
          {selectedRequest && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Request Details
                </SheetTitle>
              </SheetHeader>
              
              <div className="space-y-6 mt-6">
                {/* Request Info */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={`${getStatusColor(selectedRequest.status)}`}
                        variant="outline"
                      >
                        {selectedRequest.status === 'open' ? 'Open' : 'Resolved'}
                      </Badge>
                      <span className="text-sm text-gray-600">{selectedRequest.userEmail}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={selectedRequest.status === 'open' ? 'default' : 'outline'}
                        onClick={() => handleStatusChange('open')}
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark Open
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedRequest.status === 'resolved' ? 'default' : 'outline'}
                        onClick={() => handleStatusChange('resolved')}
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Created: {format(new Date(selectedRequest.createdAt), 'MMMM dd, yyyy at HH:mm')}
                    </p>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">
                        {selectedRequest.message}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Conversation */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Conversation</h3>
                  
                  {selectedRequest.replies.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No replies yet. Be the first to respond!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedRequest.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className={`flex ${reply.isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              reply.isAdmin
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs opacity-70">
                                {reply.isAdmin ? 'Admin' : 'User'}
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

                {/* Reply Form */}
                <div className="space-y-3 border-t pt-4">
                  <h4 className="font-medium text-gray-900">Send Reply</h4>
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim() || replyMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}