'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface VideoPlayerProps {
    url: string;
    title: string;
    parentPath: string;
}

export function VideoPlayer({ url, title, parentPath }: VideoPlayerProps) {
    return (
        <div className="h-screen w-full bg-black flex flex-col items-center justify-center relative">
            {/* Back Button Overlay - Always visible on mobile, hover on desktop */}
            <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/80 to-transparent">
                <Link href={parentPath ? `/?path=${parentPath}` : '/'}>
                    <Button variant="ghost" className="text-white hover:bg-white/10 gap-2 hover:text-white">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="font-medium text-lg drop-shadow-md">Back</span>
                    </Button>
                </Link>
                <h1 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-medium text-lg drop-shadow-md hidden sm:block">
                    {title}
                </h1>
            </div>

            <div className="w-full h-full flex items-center justify-center bg-black">
                <video
                    src={url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain focus:outline-none max-h-screen"
                    preload="metadata"
                    playsInline
                >
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
}
