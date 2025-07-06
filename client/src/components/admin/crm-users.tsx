import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Phone, 
  Mail,
  Calendar,
  Download,
  RefreshCw,
  Bell,
  MessageSquare
} from "lucide-react";
import { ReminderModal } from "./reminder-modal";
import { SMSModal } from "./sms-modal";
import { EmailModal } from "./email-modal";
import { UserModal } from "./user-modal";

interface CRMUser {
  id: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  createdAt: string;
  updatedAt: string;
  notionId?: string;
  lastSync?: string;
}

interface UserStats {
  totalUsers: number;
  newUsersThisMonth: number;
  recentlyUpdated: number;
}

export function CRMUsers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<CRMUser | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState<CRMUser | null>(null);
  const [newUser, setNewUser] = useState({
    userName: "",
    userEmail: "",
    userPhone: ""
  });

  // Query CRM users
  const { data: users = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<CRMUser[]>({
    queryKey: ['/api/admin/crm/users', searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/admin/crm/users?search=${encodeURIComponent(searchQuery)}`
        : '/api/admin/crm/users';
      
      const response = await fetch(url, {
        headers: {
          'x-user-email': localStorage.getItem('userEmail') || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      return response.json();
    },
    retry: false,
  });

  // Query user stats
  const { data: stats } = useQuery<UserStats>({
    queryKey: ['/api/admin/crm/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/crm/stats', {
        headers: {
          'x-user-email': localStorage.getItem('userEmail') || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      return response.json();
    },
    retry: false,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const response = await fetch('/api/admin/crm/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm/stats'] });
      setIsAddDialogOpen(false);
      setNewUser({ userName: "", userEmail: "", userPhone: "" });
      toast({
        title: "User Created",
        description: "New user has been added to the CRM system."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string; userData: typeof newUser }) => {
      const response = await fetch(`/api/admin/crm/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm/users'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "User Updated",
        description: "User information has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/crm/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': localStorage.getItem('userEmail') || ''
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm/stats'] });
      toast({
        title: "User Deleted",
        description: "User has been removed from the CRM system."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Sync from Notion mutation
  const syncFromNotionMutation = useMutation({
    mutationFn: async (databaseId: string) => {
      const response = await fetch('/api/admin/crm/sync-from-notion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify({ databaseId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync from Notion');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm/stats'] });
      toast({
        title: "Sync Complete",
        description: `Synced ${data.syncedCount} users from Notion`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCreateUser = () => {
    if (!newUser.userName || !newUser.userEmail) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive"
      });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleUpdateUser = () => {
    if (!selectedUser || !newUser.userName || !newUser.userEmail) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive"
      });
      return;
    }
    updateUserMutation.mutate({ userId: selectedUser.id, userData: newUser });
  };

  const handleEditUser = (user: CRMUser) => {
    setSelectedUser(user);
    setNewUser({
      userName: user.userName,
      userEmail: user.userEmail,
      userPhone: user.userPhone
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetchUsers();
  };

  const openReminderModal = (user: CRMUser) => {
    setSelectedUser(user);
    setIsReminderModalOpen(true);
  };

  const openSMSModal = (user: CRMUser) => {
    if (!user.userPhone) {
      toast({
        title: "No Phone Number",
        description: "This user doesn't have a phone number registered",
        variant: "destructive"
      });
      return;
    }
    setSelectedUser(user);
    setIsSMSModalOpen(true);
  };

  const openEmailModal = (user: CRMUser) => {
    setSelectedUser(user);
    setIsEmailModalOpen(true);
  };

  const openUserModal = (user: CRMUser) => {
    setSelectedUserForModal(user);
    setIsUserModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Users</h1>
          <p className="text-gray-600 mt-1">
            Manage user information from Notion databases
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncFromNotionMutation.mutate("DATABASE_ID_PLACEHOLDER")}
            disabled={syncFromNotionMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync from Notion
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="User Name"
                  value={newUser.userName}
                  onChange={(e) => setNewUser({ ...newUser, userName: e.target.value })}
                />
                <Input
                  placeholder="Email Address"
                  type="email"
                  value={newUser.userEmail}
                  onChange={(e) => setNewUser({ ...newUser, userEmail: e.target.value })}
                />
                <Input
                  placeholder="Phone Number"
                  value={newUser.userPhone}
                  onChange={(e) => setNewUser({ ...newUser, userPhone: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active users in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.newUsersThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">
              Added this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recently Updated</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentlyUpdated || 0}</div>
            <p className="text-xs text-muted-foreground">
              Updated this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
            {searchQuery && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  refetchUsers();
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery ? "No users match your search criteria." : "Get started by adding your first user or syncing from Notion."}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First User
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-medium text-left justify-start hover:text-blue-600"
                        onClick={() => openUserModal(user)}
                      >
                        {user.userName}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {user.userEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {user.userPhone || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.notionId ? "default" : "secondary"}>
                        {user.notionId ? "Synced" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReminderModal(user)}
                          title="Set Reminder"
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSMSModal(user)}
                          title="Send SMS"
                          disabled={!user.userPhone}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEmailModal(user)}
                          title="Send Email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="User Name"
              value={newUser.userName}
              onChange={(e) => setNewUser({ ...newUser, userName: e.target.value })}
            />
            <Input
              placeholder="Email Address"
              type="email"
              value={newUser.userEmail}
              onChange={(e) => setNewUser({ ...newUser, userEmail: e.target.value })}
            />
            <Input
              placeholder="Phone Number"
              value={newUser.userPhone}
              onChange={(e) => setNewUser({ ...newUser, userPhone: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Communication Modals */}
      {selectedUser && (
        <>
          <ReminderModal
            isOpen={isReminderModalOpen}
            onClose={() => setIsReminderModalOpen(false)}
            userId={selectedUser.id}
            userName={selectedUser.userName}
          />
          
          <SMSModal
            isOpen={isSMSModalOpen}
            onClose={() => setIsSMSModalOpen(false)}
            userId={selectedUser.id}
            userName={selectedUser.userName}
            userPhone={selectedUser.userPhone}
          />
          
          <EmailModal
            isOpen={isEmailModalOpen}
            onClose={() => setIsEmailModalOpen(false)}
            userId={selectedUser.id}
            userName={selectedUser.userName}
            userEmail={selectedUser.userEmail}
          />
        </>
      )}

      <UserModal
        user={selectedUserForModal}
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />
    </div>
  );
}