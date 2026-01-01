'use client';

import { useActionState } from 'react';
import { authenticate } from '@/app/lib/actions'; // We will create this
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
            <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800 text-white">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">KBD Stream</CardTitle>
                    <CardDescription className="text-center text-zinc-400">
                        Login to access your files
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Username
                            </label>
                            <Input
                                name="username"
                                placeholder="admin"
                                className="bg-zinc-950 border-zinc-800 focus:border-white/20"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Password
                            </label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="••••••"
                                className="bg-zinc-950 border-zinc-800 focus:border-white/20"
                                required
                            />
                        </div>
                        {errorMessage && (
                            <p className="text-sm text-red-500 text-center">{errorMessage}</p>
                        )}
                        <Button className="w-full bg-white text-black hover:bg-white/90" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sign In
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
