import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserDemo() {
  return (
    <div className="space-y-6">
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">User Demo & Testing</h1>
            <p className="text-muted-foreground">Demo functionality is being restored...</p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
          >
            ← Back to Workspace
          </Button>
        </div>
      </div>
    </div>
  );
}