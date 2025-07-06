import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UnifiedWorkspaceView from "@/components/shared/UnifiedWorkspaceView";

export default function UserDemo() {
  const [testUserEmail, setTestUserEmail] = useState("basiliskan@gmail.com");

  const handleUserEmailChange = (email: string) => {
    setTestUserEmail(email);
  };

  return (
    <div className="space-y-6">
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">User Demo & Testing</h1>
            <p className="text-muted-foreground">Test the application with different user emails</p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
          >
            ← Back to Workspace
          </Button>
        </div>
      </div>

      <UnifiedWorkspaceView 
        userEmail={testUserEmail} 
        isDemoMode={true}
        onUserEmailChange={handleUserEmailChange}
      />
    </div>
  );
}