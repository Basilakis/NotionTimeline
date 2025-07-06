import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, User, History } from "lucide-react";
import vertexLogo from "@assets/Group 2_1751826186442.png";

interface LoginData {
  email: string;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest('POST', '/api/auth/login', data);
      return response.json();
    },
    onSuccess: (user) => {
      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userEmail', user.email);
      toast({
        title: "Login successful",
        description: `Welcome ${user.name || user.email}!`,
      });
      // Force page refresh to update auth state and redirect to main page
      window.location.href = '/';
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message || "Failed to login. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate({ email });
  };

  return (
    <div className="min-h-screen bg-brand-secondary/20 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-material">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center justify-center mb-4">
            <img 
              src={vertexLogo} 
              alt="Vertex Developments" 
              className="h-16 w-16 mb-3"
            />
            <CardTitle className="text-2xl font-bold text-brand-primary">Vertex Project Hub</CardTitle>
          </div>
          <p className="text-brand-primary/70 text-sm">
            Enter your email address to access your project workspace
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>



            <Button 
              type="submit" 
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-brand-secondary/30">
            <p className="text-xs text-brand-primary/60 text-center">
              Your email will be used to access your personalized Notion workspace.
              First-time users will automatically get an account created.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}