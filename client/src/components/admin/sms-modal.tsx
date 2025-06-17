import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Send } from "lucide-react";

interface SMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userPhone: string;
}

export function SMSModal({ isOpen, onClose, userId, userName, userPhone }: SMSModalProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");

  // Send SMS mutation
  const sendSMSMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await fetch(`/api/admin/crm/users/${userId}/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify({ message: messageText })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send SMS');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      onClose();
      toast({
        title: "SMS Sent",
        description: `Message sent successfully to ${userName}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "SMS Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSendSMS = () => {
    if (!message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a message",
        variant: "destructive"
      });
      return;
    }

    if (message.length > 160) {
      toast({
        title: "Message Too Long",
        description: "SMS messages should be 160 characters or less",
        variant: "destructive"
      });
      return;
    }

    sendSMSMutation.mutate(message);
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS to {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>Phone:</strong> {userPhone}
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your SMS message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={160}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {message.length}/160 characters
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendSMS}
              disabled={sendSMSMutation.isPending || !message.trim()}
            >
              {sendSMSMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}