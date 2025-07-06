import { useEffect, useState } from 'react';
import { ChatInterface } from '@/components/chat/chat-interface';

export default function AgentPage() {
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    // Get user email from localStorage
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      setUserEmail(storedEmail);
    }
  }, []);

  if (!userEmail) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access the AI Agent.</p>
        </div>
      </div>
    );
  }

  return <ChatInterface userEmail={userEmail} />;
}