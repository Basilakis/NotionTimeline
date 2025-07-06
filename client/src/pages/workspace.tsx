import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import UnifiedWorkspaceView from "@/components/shared/UnifiedWorkspaceView";
import proposalBg from "@assets/proposal-background.png";

export default function Workspace() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const userEmail = user?.email || '';
  const isAdmin = userEmail === 'basiliskan@gmail.com';

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

  // Check for proposal background (you can add this logic back if needed)
  const hasProposalRecords = false; // Simplify for now, can be enhanced later

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
      
      <div className={`${hasProposalRecords ? 'relative z-10' : ''}`}>
        <div className="container mx-auto py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {userEmail.split('@')[0]}!</h1>
              <p className="text-muted-foreground mt-1">Your personalized workspace</p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <>
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
                </>
              )}
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
        </div>

        <UnifiedWorkspaceView userEmail={userEmail} />
      </div>
    </>
  );
}