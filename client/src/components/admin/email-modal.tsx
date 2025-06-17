import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Send } from "lucide-react";

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
}

export function EmailModal({ isOpen, onClose, userId, userName, userEmail }: EmailModalProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: { subject: string; htmlBody: string; textBody?: string }) => {
      const response = await fetch(`/api/admin/crm/users/${userId}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': localStorage.getItem('userEmail') || ''
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setSubject("");
      setHtmlBody("");
      setTextBody("");
      onClose();
      toast({
        title: "Email Sent",
        description: `Email sent successfully to ${userName}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Email Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSendEmail = () => {
    if (!subject.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a subject",
        variant: "destructive"
      });
      return;
    }

    if (!htmlBody.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter email content",
        variant: "destructive"
      });
      return;
    }

    sendEmailMutation.mutate({
      subject,
      htmlBody,
      textBody: textBody || undefined
    });
  };

  const handleClose = () => {
    setSubject("");
    setHtmlBody("");
    setTextBody("");
    onClose();
  };

  const generatePlainText = () => {
    // Simple HTML to text conversion
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlBody;
    setTextBody(tempDiv.textContent || tempDiv.innerText || '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>To:</strong> {userEmail}
          </div>

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <Tabs defaultValue="html" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="html">HTML Content</TabsTrigger>
              <TabsTrigger value="text">Plain Text</TabsTrigger>
            </TabsList>
            
            <TabsContent value="html" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="htmlBody">HTML Content</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generatePlainText}
                    type="button"
                  >
                    Generate Plain Text
                  </Button>
                </div>
                <Textarea
                  id="htmlBody"
                  placeholder="Enter HTML email content..."
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="text-xs text-gray-500 mt-1">
                  You can use HTML tags for formatting (e.g., &lt;h1&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;br&gt;)
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="text" className="space-y-4">
              <div>
                <Label htmlFor="textBody">Plain Text Content (Optional)</Label>
                <Textarea
                  id="textBody"
                  placeholder="Enter plain text version of the email..."
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  rows={12}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Plain text version for email clients that don't support HTML
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Email Preview */}
          {htmlBody && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Preview</Label>
              <div className="border bg-white p-4 rounded max-h-40 overflow-y-auto">
                <div className="text-sm font-medium border-b pb-2 mb-2">
                  Subject: {subject || "No subject"}
                </div>
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending || !subject.trim() || !htmlBody.trim()}
            >
              {sendEmailMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}