import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { Link } from '@tanstack/react-router'; // Using <a> for now for undefined routes
import { GithubIcon, ChromeIcon } from 'lucide-react'; // Example icons for OAuth
import { useForm, SubmitHandler } from 'react-hook-form'; // Import useForm
import { zodResolver } from '@hookform/resolvers/zod'; // Import Zod resolver
import * as z from 'zod'; // Import Zod
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { useLoginMutation, useRegisterMutation } from "@/hooks/useAuthMutations"; // Import mutations
import { useNavigate } from '@tanstack/react-router'; // Import for navigation
import { useQueryClient } from '@tanstack/react-query'; // Import useQueryClient
import { fetchAuthStatus } from '@/hooks/useAuthStatus'; // Import fetchAuthStatus

// Placeholder for Logo
const Logo = () => (
    <div className="flex items-center gap-2 text-white mb-4">
        {/* Replace with actual SVG or Image Logo - needs to be white/light for purple bg */}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="font-bold text-2xl">StudyAI</span> {/* Name from screenshot */}
    </div>
);

// Placeholder Testimonial
const Testimonial = () => (
     <blockquote className="mt-auto text-white/80">
        <p className="text-base">"StudyAI has revolutionized the way I prepare for exams. It's like having a personal tutor available 24/7."</p>
        <footer className="text-sm mt-4">JS - Computer Science Student</footer>
    </blockquote>
);

// --- Zod Schemas --- //
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});
type LoginFormInputs = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  displayName: z.string().optional(),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // path of error
});
type RegisterFormInputs = z.infer<typeof registerSchema>;

function LoginPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient(); // Get query client instance

    // --- Form Hooks ---
    const {
        register: registerSignIn,
        handleSubmit: handleSubmitSignIn,
        formState: { errors: errorsSignIn },
    } = useForm<LoginFormInputs>({ resolver: zodResolver(loginSchema) });

    const {
        register: registerSignUp,
        handleSubmit: handleSubmitSignUp,
        formState: { errors: errorsSignUp },
        reset: resetSignUp, // Add reset for signup form
    } = useForm<RegisterFormInputs>({ resolver: zodResolver(registerSchema) });

    // --- Mutations ---
    const loginMutation = useLoginMutation();
    const registerMutation = useRegisterMutation();

    // --- Submit Handlers ---
    const onSubmitSignIn: SubmitHandler<LoginFormInputs> = (data) => {
        console.log('[LoginPage onSubmitSignIn] Attempting to call loginMutation.mutate with data:', data);
        loginMutation.mutate(data, {
            onSuccess: async () => { 
                console.log('[LoginPage onSubmitSignIn] loginMutation.mutate succeeded.');
                toast({ title: "Login Successful", description: "Welcome back!" });
                
                // Explicitly refetch authStatus here before navigating
                try {
                    console.log("Refetching authStatus before navigation...");
                    await queryClient.fetchQuery({ 
                        queryKey: ['authStatus'],
                        queryFn: fetchAuthStatus // Provide the query function
                    });
                    console.log("authStatus refetched successfully.");
                    // No need for delay here usually, navigation waits for await
                    navigate({ to: '/', replace: true }); // Navigate after successful refetch
                } catch (refetchError) {
                    console.error("Error refetching authStatus in component:", refetchError);
                    toast({ 
                        title: "Login Status Error", 
                        description: "Could not verify login status. Please try again.", 
                        variant: "destructive" 
                    });
                    // Decide if you still want to navigate or stay on login page
                    // navigate({ to: '/', replace: true }); 
                }
            },
            onError: (error) => {
                console.error('[LoginPage onSubmitSignIn] loginMutation.mutate failed:', error);
                toast({ 
                    title: "Login Failed", 
                    description: (error as any)?.response?.data?.message || error.message || "An error occurred", 
                    variant: "destructive" 
                });
            }
        });
    };

    const onSignInError = (errors: any) => {
        console.error('[LoginPage onSignInError] Form validation failed:', errors);
        // Optional: Add a generic toast for validation errors if they aren't shown inline
        // toast({ title: "Validation Error", description: "Please check the form fields.", variant: "destructive" });
    };

    const onSubmitSignUp: SubmitHandler<RegisterFormInputs> = (data) => {
        console.log("Sign Up Data:", data);
        // Exclude confirmPassword before sending to API if necessary
        const { confirmPassword, ...signUpData } = data;
        registerMutation.mutate(signUpData, {
             onSuccess: () => {
                toast({ title: "Registration Successful", description: "Welcome! You are now logged in." });
                resetSignUp(); // Reset the sign-up form fields
                navigate({ to: '/' }); // Navigate to dashboard on success
            },
            onError: (error) => {
                toast({ 
                    title: "Registration Failed", 
                    description: (error as any)?.response?.data?.message || error.message || "An error occurred", 
                    variant: "destructive" 
                });
            }
        });
    };

    return (
        <div className="w-full h-screen lg:grid lg:grid-cols-2">
            {/* Left Column - Branding */} 
            <div className="hidden lg:flex flex-col bg-primary p-10 text-white">
                <Logo />
                <div className="mt-8">
                    <h1 className="text-3xl font-bold mb-2">Transform Your Learning Experience</h1>
                    <p className="text-white/90 text-base">
                        StudyAI helps you convert any learning material into structured, engaging study content using AI.
                    </p>
                </div>
                 <Testimonial />
            </div>

            {/* Right Column - Form */} 
            <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
                <div className="mx-auto grid w-[380px] gap-6">
                    
                    {/* Use Tabs component */}
                    <Tabs defaultValue="signin" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                           <TabsTrigger value="signin">Sign In</TabsTrigger>
                           <TabsTrigger value="signup">Sign Up</TabsTrigger>
                        </TabsList>
                        
                        {/* Sign In Form Content */}
                        <TabsContent value="signin">
                            <form onSubmit={handleSubmitSignIn(onSubmitSignIn, onSignInError)}> {/* Added form tag */} 
                                <Card className="border-none shadow-none bg-transparent">
                                    <CardHeader className="text-left p-0 pt-6">
                                        <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
                                        <CardDescription>
                                            Sign in to your account to continue your learning journey
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 p-0 pt-6">
                                        <div className="grid gap-2">
                                            <Label htmlFor="email-signin">Email</Label>
                                            <Input id="email-signin" type="email" placeholder="your.email@example.com" {...registerSignIn("email")} />
                                            {errorsSignIn.email && <p className="text-xs text-destructive mt-1">{errorsSignIn.email.message}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="flex items-center">
                                                <Label htmlFor="password-signin">Password</Label>
                                                <a href="/forgot-password" 
                                                    className="ml-auto inline-block text-sm underline text-muted-foreground hover:text-primary">
                                                    Forgot password?
                                                </a>
                                            </div>
                                            <Input id="password-signin" type="password" placeholder="••••••••" {...registerSignIn("password")} />
                                            {errorsSignIn.password && <p className="text-xs text-destructive mt-1">{errorsSignIn.password.message}</p>}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex flex-col p-0 pt-6 gap-4">
                                        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                                            {loginMutation.isPending ? "Signing In..." : "Sign In"}
                                        </Button>
                                        <div className="relative w-full py-2">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t border-border" />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-background px-2 text-muted-foreground">
                                                    Or continue with
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 w-full">
                                            <Button variant="outline" className="w-full">
                                                <ChromeIcon className="mr-2 h-4 w-4" /> Google
                                            </Button>
                                            <Button variant="outline" className="w-full">
                                                <GithubIcon className="mr-2 h-4 w-4" /> GitHub
                                            </Button>
                                        </div>
                                    </CardFooter>
                                </Card>
                            </form> {/* Closed form tag */} 
                        </TabsContent>
                        
                        {/* Sign Up Form Content */}
                        <TabsContent value="signup">
                           <form onSubmit={handleSubmitSignUp(onSubmitSignUp)}> {/* Added form tag */} 
                               <Card className="border-none shadow-none bg-transparent">
                                    <CardHeader className="text-left p-0 pt-6">
                                        <CardTitle className="text-2xl font-semibold">Create an account</CardTitle>
                                        <CardDescription>
                                            Enter your details below to start your journey with StudyAI.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 p-0 pt-6">
                                        <div className="grid gap-2">
                                            <Label htmlFor="username-signup">Username</Label>
                                            <Input id="username-signup" placeholder="Choose a username" {...registerSignUp("username")} />
                                            {errorsSignUp.username && <p className="text-xs text-destructive mt-1">{errorsSignUp.username.message}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="displayName-signup">Display Name (Optional)</Label>
                                            <Input id="displayName-signup" placeholder="How you want to appear" {...registerSignUp("displayName")} />
                                        </div>
                                         <div className="grid gap-2">
                                            <Label htmlFor="email-signup">Email</Label>
                                            <Input id="email-signup" type="email" placeholder="your.email@example.com" {...registerSignUp("email")} />
                                            {errorsSignUp.email && <p className="text-xs text-destructive mt-1">{errorsSignUp.email.message}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="password-signup">Password</Label>
                                            <Input id="password-signup" type="password" placeholder="Choose a strong password" {...registerSignUp("password")} />
                                            {errorsSignUp.password && <p className="text-xs text-destructive mt-1">{errorsSignUp.password.message}</p>}
                                        </div>
                                         <div className="grid gap-2">
                                            <Label htmlFor="password-confirm">Confirm Password</Label>
                                            <Input id="password-confirm" type="password" placeholder="Re-enter your password" {...registerSignUp("confirmPassword")} />
                                            {errorsSignUp.confirmPassword && <p className="text-xs text-destructive mt-1">{errorsSignUp.confirmPassword.message}</p>}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex flex-col p-0 pt-6 gap-4">
                                        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                                            {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </form> {/* Closed form tag */} 
                        </TabsContent>
                    </Tabs>

                    <p className="px-8 text-center text-sm text-muted-foreground mt-4">
                        By clicking continue, you agree to our{" "}
                        <a href="/terms" className="underline underline-offset-4 hover:text-primary">Terms of Service</a>
                        {" "}and{" "}
                        <a href="/privacy" className="underline underline-offset-4 hover:text-primary">Privacy Policy</a>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}

// Route definition (Example for TanStack Router)
// import { createRoute } from '@tanstack/react-router'
// import { rootRoute } from '../root' // Assuming a root route definition

// export const loginRoute = createRoute({
//   getParentRoute: () => rootRoute, // Or appropriate parent
//   path: '/auth/login',
//   component: LoginPage,
// })

export default LoginPage; 