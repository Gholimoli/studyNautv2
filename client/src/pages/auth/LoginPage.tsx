import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs" // Commented out - Add shadcn Tabs component later
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { Link } from '@tanstack/react-router'; // Using <a> for now for undefined routes
import { GithubIcon, ChromeIcon } from 'lucide-react'; // Example icons for OAuth

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

function LoginPage() {
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
                <div className="mx-auto grid w-[350px] gap-6">
                    {/* --- Tabs Component Placeholder --- */}
                    {/* Remove this comment block and uncomment Tabs below when component is added */}
                    <div className="flex justify-center space-x-4 border-b mb-4">
                         <Button variant="ghost" className="font-semibold text-primary border-b-2 border-primary pb-2">Sign In</Button>
                         <Button variant="ghost" className="text-muted-foreground">Sign Up</Button>
                    </div>
                    {/* --- End Tabs Placeholder --- */}

                     {/* <Tabs defaultValue="sign-in" className="w-full"> */}
                        {/* <TabsList className="grid w-full grid-cols-2"> */}
                        {/*    <TabsTrigger value="sign-in">Sign In</TabsTrigger> */}
                        {/*    <TabsTrigger value="sign-up">Sign Up</TabsTrigger> */}
                        {/* </TabsList> */}
                        {/* <TabsContent value="sign-in"> */}
                             <Card className="border-none shadow-none bg-transparent">
                                <CardHeader className="text-left p-0 pt-2">
                                    <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
                                    <CardDescription>
                                        Sign in to your account to continue your learning journey
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 p-0 pt-6">
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" placeholder="your.email@example.com" required />
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="flex items-center">
                                            <Label htmlFor="password">Password</Label>
                                            {/* Using <a> tag temporarily for undefined route */}
                                            <a href="/forgot-password" 
                                                className="ml-auto inline-block text-sm underline text-muted-foreground hover:text-primary">
                                                Forgot password?
                                            </a>
                                        </div>
                                        <Input id="password" type="password" placeholder="••••••••" required />
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col p-0 pt-6 gap-4">
                                    <Button type="submit" className="w-full">Sign In</Button>
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
                        {/* </TabsContent> */}
                        {/* <TabsContent value="sign-up"> */}
                            {/* TODO: Implement Sign Up Form here when Tabs are active */}
                        {/* </TabsContent> */}
                    {/* </Tabs> */}

                     <p className="mt-4 text-center text-sm text-muted-foreground">
                         Don't have an account?{" "}
                         {/* Using <a> tag temporarily for undefined route */}
                         <a
                            href="/sign-up" // TODO: Update to router Link when sign-up route exists
                            className="underline underline-offset-4 hover:text-primary font-medium"
                         >
                            Sign Up
                         </a>
                    </p>
                     <p className="px-8 text-center text-sm text-muted-foreground">
                        By clicking continue, you agree to our{" "}
                         {/* Using <a> tag temporarily for undefined route */}
                        <a
                            href="/terms" // TODO: Update to router Link when terms route exists
                            className="underline underline-offset-4 hover:text-primary"
                        >
                            Terms of Service
                        </a>{" "}
                        and{" "}
                         {/* Using <a> tag temporarily for undefined route */}
                        <a
                            href="/privacy" // TODO: Update to router Link when privacy route exists
                            className="underline underline-offset-4 hover:text-primary"
                        >
                            Privacy Policy
                        </a>
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