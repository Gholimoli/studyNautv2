import React from 'react';
import { Link } from '@tanstack/react-router'; // Use TanStack Router
import { 
  BrainCircuit, 
  BookCopy, // Use consistent icon from previous iteration
  HelpCircle, // Use consistent icon from previous iteration
  Plus, 
  FileText,
  Mic,
  Youtube,
  ImageDown as Image, // Use consistent icon from previous iteration
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NoteCard } from '@/components/notes/NoteCard'; // Import updated NoteCard
import { cn } from '@/lib/utils';

// Mock Data (matching updated NoteCard interface)
const mockRecentNotes = [
  { 
    id: '1', 
    title: 'Quantum Mechanics Fundamentals', 
    excerpt: 'Wave functions, Schrödinger equation, and quantum states...',
    date: 'Apr 1, 2025',
    category: 'Physics'
  },
  { 
    id: '2', 
    title: 'Neural Networks Architecture', 
    excerpt: 'Deep learning models, activation functions, and backpropagation...',
    date: 'Mar 30, 2025',
    category: 'Computer Science'
  },
  { 
    id: '3', 
    title: 'World War II Major Events', 
    excerpt: 'Timeline of significant battles and political developments...',
    date: 'Mar 28, 2025',
    category: 'History'
  }
];

const learningTools = [
  {
    title: 'Mind Maps',
    description: 'Visualize connections between concepts',
    icon: <BrainCircuit className="h-6 w-6" />,
    to: '/', // Changed path to satisfy linter
    colorClasses: 'bg-primary/10 text-primary' // Use theme colors
  },
  {
    title: 'Flashcards',
    description: 'Review key concepts with spaced repetition',
    icon: <BookCopy className="h-6 w-6" />,
    to: '/', // Changed path to satisfy linter
    colorClasses: 'bg-primary/10 text-primary'
  },
  {
    title: 'Quizzes',
    description: 'Test your knowledge with AI-generated questions',
    icon: <HelpCircle className="h-6 w-6" />,
    to: '/', // Changed path to satisfy linter
    colorClasses: 'bg-primary/10 text-primary'
  }
];

// Animation variants (can be reused or defined here)
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const cardGridVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const cardItemVariant = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Define icon size for create content cards
const ICON_CREATE_SIZE = "h-6 w-6";

export function DashboardPage() {
  console.log("DashboardPage rendering..."); // Log component render

  // --- Add Data Fetching Hooks Here (Example using mock data for now) ---
  // const { data: recentNotes, isLoading: isLoadingNotes, isError: isErrorNotes } = useQuery(...);
  // const { data: userStats, isLoading: isLoadingStats, isError: isErrorStats } = useQuery(...);

  // Log query status
  // console.log("Recent Notes Query:", { isLoading: isLoadingNotes, isError: isErrorNotes });
  // console.log("User Stats Query:", { isLoading: isLoadingStats, isError: isErrorStats });

  // TODO: Implement actual onClick handlers for non-Link cards/buttons
  const handleCreateTextClick = () => console.log('Create Text Clicked');
  const handleCreateAudioClick = () => console.log('Create Audio Clicked');
  const handleCreateImageClick = () => console.log('Create Image Clicked');

  // Handle loading state
  // if (isLoadingNotes || isLoadingStats) {
  //   return <div>Loading dashboard...</div>; // Or a Skeleton loader
  // }

  // Handle error state (Could check for specific 401 here if needed)
  // if (isErrorNotes || isErrorStats) {
  //   console.error("Error fetching dashboard data");
  //   // Optionally check the error object for status code if available from TanStack Query
  //   return <div>Error loading dashboard data. Please try again later.</div>;
  // }
  
  // --- Log before returning JSX ---
  console.log("DashboardPage proceeding to render JSX");

  return (
    <div className="container mx-auto py-8 px-4 md:px-6"> {/* Added container and padding */}
      {/* Top Section: Welcome + Buttons */}
      <motion.div 
        variants={sectionVariants} initial="hidden" animate="visible"
        className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 md:gap-6"
       >
        <div>
          {/* Adjusted typography to match theme guidelines */}
          <h1 className="text-3xl font-semibold text-foreground mb-1">Welcome to Studynaut</h1>
          <p className="text-base text-muted-foreground">
            Transform your study materials into intelligent learning resources
          </p>
        </div>
        
        <div className="flex w-full md:w-auto space-x-3">
          {/* TODO: Update Link `to` paths if necessary */}
          <Button 
            variant="outline" // Use outline variant
            className="flex-1 md:flex-none justify-start gap-2 group text-sm" // Adjusted size/text
            asChild
          >
            <Link to="/"> 
              <Plus className="h-4 w-4" />
              <span className="flex-1 text-left">New Note</span>
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </Button>
          
          <Button 
            className="flex-1 md:flex-none justify-start gap-2 group text-sm" // Default primary variant
            asChild
          >
            <Link to="/"> 
              <BrainCircuit className="h-4 w-4" />
              <span className="flex-1 text-left">AI Tutor</span>
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </Button>
        </div>
      </motion.div>
      
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8"> {/* Increased spacing */}
          {/* Create New Content Section */}
          <motion.section variants={sectionVariants} initial="hidden" animate="visible">
            <h2 className="text-xl font-semibold text-foreground mb-4">Create New Content</h2>
            <motion.div 
              variants={cardGridVariants} initial="hidden" animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"
            >
              {/* Text Card - Using Card directly */}
              <motion.div variants={cardItemVariant}>
                <Card 
                  className="hover:shadow-md transition-shadow cursor-pointer h-full"
                  onClick={handleCreateTextClick} // Use onClick for non-link cards
                 >
                  <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-primary">
                      <FileText className={ICON_CREATE_SIZE} />
                    </div>
                    <div>
                      <h3 className="font-medium text-base text-foreground">Text</h3>
                      <p className="text-sm text-muted-foreground mt-1">Create note from text</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              
              {/* Audio Card */} 
              <motion.div variants={cardItemVariant}>
                 <Card 
                  className="hover:shadow-md transition-shadow cursor-pointer h-full"
                  onClick={handleCreateAudioClick}
                 >
                   <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-primary">
                      <Mic className={ICON_CREATE_SIZE} />
                    </div>
                    <div>
                      <h3 className="font-medium text-base text-foreground">Audio</h3>
                      <p className="text-sm text-muted-foreground mt-1">Upload or record audio</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* YouTube Card - Wrapped in Link */} 
              <motion.div variants={cardItemVariant}>
                <Link to="/" className="block h-full"> 
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-primary">
                        <Youtube className={ICON_CREATE_SIZE} />
                      </div>
                      <div>
                        <h3 className="font-medium text-base text-foreground">YouTube</h3>
                        <p className="text-sm text-muted-foreground mt-1">Extract from videos</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
              
              {/* Image Card */} 
              <motion.div variants={cardItemVariant}>
                 <Card 
                  className="hover:shadow-md transition-shadow cursor-pointer h-full"
                  onClick={handleCreateImageClick}
                 >
                   <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-primary">
                      <Image className={ICON_CREATE_SIZE} />
                    </div>
                    <div>
                      <h3 className="font-medium text-base text-foreground">Image</h3>
                      <p className="text-sm text-muted-foreground mt-1">Extract text from images</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </motion.section>
          
          {/* Recent Notes Section */}
          <motion.section variants={sectionVariants} initial="hidden" animate="visible">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Recent Notes</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/notes">View all</Link>
              </Button>
            </div>
            
            <motion.div 
              variants={cardGridVariants} initial="hidden" animate="visible"
              className="space-y-4"
            >
              {/* TODO: Replace mockRecentNotes with fetched data */}
              {mockRecentNotes.map(note => (
                <motion.div key={note.id} variants={cardItemVariant}>
                  <NoteCard note={note} />
                </motion.div>
              ))}
              {/* Example: Add loading/error state for notes */}
              {/* {isLoadingNotes && <p>Loading notes...</p>} */}
              {/* {isErrorNotes && <p className="text-destructive">Error loading notes.</p>} */}
            </motion.div>
          </motion.section>
        </div>
        
        {/* Right Column */}
        <div className="space-y-8"> {/* Increased spacing */} 
          {/* Learning Tools Section */} 
          <motion.section variants={sectionVariants} initial="hidden" animate="visible">
            <h2 className="text-xl font-semibold text-foreground mb-4">Learning Tools</h2>
            <motion.div 
              variants={cardGridVariants} initial="hidden" animate="visible"
              className="space-y-3"
            >
              {learningTools.map((tool, index) => (
                <motion.div key={index} variants={cardItemVariant}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-0"> {/* Remove default padding */}
                      <Link to={tool.to} className="flex items-center gap-4 p-4"> {/* Add padding to Link */}
                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", tool.colorClasses)}> {/* Adjusted size/shape */}
                          {tool.icon}
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-medium text-base text-foreground">{tool.title}</h3>
                          <p className="text-sm text-muted-foreground">{tool.description}</p>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
          
          {/* AI Tutor Card */} 
          <motion.section variants={sectionVariants} initial="hidden" animate="visible">
            {/* Use standard Card with primary background */}
            <Card className="bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-primary-foreground">AI Tutor</CardTitle>
                <CardDescription className="text-primary-foreground/80">Get personalized help with your studies</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-primary-foreground/90">
                  Chat with our AI tutor to get explanations, examples, and guidance on any topic.
                </p>
                <Button variant="secondary" className="w-full" asChild>
                  <Link to="/">Start Learning</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </div>
    </div>
  );
} 