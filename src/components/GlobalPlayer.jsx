import React from 'react';
import { Play, Pause, Volume2, Radio, SkipBack, SkipForward, Repeat, Shuffle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const GlobalPlayer = ({ isPlaying, setIsPlaying }) => {
  const { toast } = useToast();
  
  const handleFeature = () => {
    toast({
      title: "Not available in demo",
      description: "This feature will be available in the full version."
    });
  };

  return (
    <div className="w-full poly-surface border-t border-white/10 py-3 px-4 md:px-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
        
        {/* Track Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20 group relative overflow-hidden">
             <img 
               src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop" 
               alt="Album Art" 
               className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"
             />
             <div className="absolute inset-0 bg-black/40" />
             <Radio className="w-6 h-6 text-white absolute" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-sm font-bold text-white truncate drop-shadow-md">Deep Connections</p>
            <p className="text-xs text-muted-foreground truncate hover:text-primary cursor-pointer transition-colors">DJ Fractal</p>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-secondary hidden sm:flex hover:bg-white/5">
             <Heart className="w-4 h-4" />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleFeature} className="text-muted-foreground hover:text-white w-8 h-8 hidden md:flex hover:bg-white/5">
               <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleFeature} className="text-muted-foreground hover:text-white hover:bg-white/5">
               <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-white text-black hover:bg-gray-200 hover:scale-105 transition-all shadow-xl shadow-white/10"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleFeature} className="text-muted-foreground hover:text-white hover:bg-white/5">
               <SkipForward className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleFeature} className="text-muted-foreground hover:text-white w-8 h-8 hidden md:flex hover:bg-white/5">
               <Repeat className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full max-w-md flex items-center gap-3 text-xs text-muted-foreground font-medium">
             <span>2:14</span>
             <div className="flex-1 h-1 bg-[#2D2D2D] rounded-full relative group cursor-pointer">
                <div className="absolute left-0 top-0 bottom-0 w-[40%] bg-gradient-to-r from-primary to-secondary rounded-full">
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md transition-opacity" />
                </div>
             </div>
             <span>5:30</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex-1 flex justify-end items-center gap-2 hidden md:flex">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="w-24 bg-[#2D2D2D] rounded-full h-1.5 overflow-hidden cursor-pointer">
            <div className="w-3/4 h-full bg-muted-foreground hover:bg-primary transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalPlayer;