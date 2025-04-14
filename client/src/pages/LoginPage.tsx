import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate } from '@tanstack/react-router';
import { useLoginMutation } from '@/hooks/useAuthMutations'; // Import the hook
import { useState } from 'react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const loginMutation = useLoginMutation(); // Initialize the mutation hook

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting login with:', username);
    
    try {
      await loginMutation.mutateAsync({ username, password });
      navigate({ to: '/dashboard' }); // Redirect on success
    } catch (err) {
      console.error("Caught login error in component:", err)
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.24))] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your username below to login to your account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="Your username" 
                required 
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                disabled={loginMutation.isPending} // Use mutation pending state
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={loginMutation.isPending} // Use mutation pending state
              />
            </div>
            {loginMutation.isError && (
              <p className="text-sm text-red-600">{loginMutation.error?.message || 'Login failed'}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-start">
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}> 
              {loginMutation.isPending ? 'Logging in...' : 'Sign in'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
