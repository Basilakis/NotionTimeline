import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2, 
  Mail, 
  MessageSquare,
  Calendar
} from "lucide-react";

interface Reminder {
  id: string;
  userId: string;
  message: string;
  reminderDate: string;
  reminderType: 'email' | 'sms';
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  updatedAt: string;
}

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function ReminderModal({ isOpen, onClose, userId, userName }: ReminderModalProps) {
  const { toast } = useToast();
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [newReminder, setNewReminder] = useState({
    message: "",
    reminderDate: "",
    reminderType: "email" as "email" | "sms"
  });

  // Query reminders for the user
  const { data: reminders = [], isLoading, refetch } = useQuery<Reminder[]>({
    queryKey: [`/api/admin/crm/users/${userId}/reminders`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/crm/users/${userId}/reminders`, {
        headers: {
          'x-user-email': localStorage.getItem('userEmail') || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch reminders');
      }
      
      return response.json();
    },
    enabled: isOpen,
    retry: false,
  });

  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (reminderData: typeof newReminder) => {
      const response = await fetch(`/api/admin/crm/users/${userId}/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify(reminderData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create reminder');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crm/users/${userId}/reminders`] });
      setIsAddingReminder(false);
      setNewReminder({ message: "", reminderDate: "", reminderType: "email" });
      toast({
        title: "Reminder Created",
        description: "The reminder has been scheduled successfully."
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

  // Update reminder mutation
  const updateReminderMutation = useMutation({
    mutationFn: async ({ reminderId, reminderData }: { reminderId: string; reminderData: typeof newReminder }) => {
      const response = await fetch(`/api/admin/crm/reminders/${reminderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify(reminderData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update reminder');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crm/users/${userId}/reminders`] });
      setEditingReminder(null);
      setNewReminder({ message: "", reminderDate: "", reminderType: "email" });
      toast({
        title: "Reminder Updated",
        description: "The reminder has been updated successfully."
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

  // Delete reminder mutation
  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const response = await fetch(`/api/admin/crm/reminders/${reminderId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': localStorage.getItem('userEmail') || ''
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete reminder');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crm/users/${userId}/reminders`] });
      toast({
        title: "Reminder Deleted",
        description: "The reminder has been removed."
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

  const handleCreateReminder = () => {
    if (!newReminder.message || !newReminder.reminderDate) {
      toast({
        title: "Validation Error",
        description: "Message and reminder date are required",
        variant: "destructive"
      });
      return;
    }
    createReminderMutation.mutate(newReminder);
  };

  const handleUpdateReminder = () => {
    if (!editingReminder || !newReminder.message || !newReminder.reminderDate) {
      toast({
        title: "Validation Error",
        description: "Message and reminder date are required",
        variant: "destructive"
      });
      return;
    }
    updateReminderMutation.mutate({ 
      reminderId: editingReminder.id, 
      reminderData: newReminder 
    });
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setNewReminder({
      message: reminder.message,
      reminderDate: reminder.reminderDate.split('T')[0], // Format for date input
      reminderType: reminder.reminderType
    });
    setIsAddingReminder(true);
  };

  const handleDeleteReminder = (reminderId: string) => {
    if (confirm("Are you sure you want to delete this reminder?")) {
      deleteReminderMutation.mutate(reminderId);
    }
  };

  const resetForm = () => {
    setIsAddingReminder(false);
    setEditingReminder(null);
    setNewReminder({ message: "", reminderDate: "", reminderType: "email" });
  };

  const formatReminderDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders for {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit Reminder Form */}
          {isAddingReminder && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-medium mb-4">
                {editingReminder ? 'Edit Reminder' : 'Add New Reminder'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Enter reminder message..."
                    value={newReminder.message}
                    onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="reminderDate">Reminder Date & Time</Label>
                  <Input
                    id="reminderDate"
                    type="datetime-local"
                    value={newReminder.reminderDate}
                    onChange={(e) => setNewReminder({ ...newReminder, reminderDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Reminder Type</Label>
                  <RadioGroup
                    value={newReminder.reminderType}
                    onValueChange={(value: "email" | "sms") => 
                      setNewReminder({ ...newReminder, reminderType: value })
                    }
                    className="flex gap-6 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="email" />
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sms" id="sms" />
                      <Label htmlFor="sms" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        SMS
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={editingReminder ? handleUpdateReminder : handleCreateReminder}
                    disabled={createReminderMutation.isPending || updateReminderMutation.isPending}
                  >
                    {editingReminder ? 'Update Reminder' : 'Create Reminder'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Reminder Button */}
          {!isAddingReminder && (
            <Button onClick={() => setIsAddingReminder(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Reminder
            </Button>
          )}

          {/* Reminders List */}
          <div>
            <h3 className="text-lg font-medium mb-4">Existing Reminders</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
              </div>
            ) : reminders.length === 0 ? (
              <div className="text-center py-8 border rounded-lg">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Reminders</h3>
                <p className="text-gray-600">Create your first reminder to get started.</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Message</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reminders.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell>
                          <div className="max-w-xs truncate">{reminder.message}</div>
                        </TableCell>
                        <TableCell>{formatReminderDate(reminder.reminderDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {reminder.reminderType === 'email' ? (
                              <Mail className="h-4 w-4" />
                            ) : (
                              <MessageSquare className="h-4 w-4" />
                            )}
                            {reminder.reminderType.toUpperCase()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(reminder.status)}>
                            {reminder.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditReminder(reminder)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteReminder(reminder.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}